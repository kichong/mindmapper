/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
} from 'react'

export interface MindMapNode {
  id: string
  parentId: string | null
  text: string
  x: number
  y: number
  color: string
}

interface MindMapHistory {
  past: MindMapNode[][]
  future: MindMapNode[][]
}

export interface MindMapState {
  nodes: MindMapNode[]
  selectedNodeId: string | null
  history: MindMapHistory
}

type MindMapAction =
  | { type: 'ADD_NODE'; node: MindMapNode }
  | { type: 'UPDATE_NODE'; nodeId: string; updates: Partial<Omit<MindMapNode, 'id'>> }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'MOVE_NODE'; nodeId: string; x: number; y: number }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'IMPORT'; nodes: MindMapNode[] }
  | { type: 'EXPORT' }
  | { type: 'SELECT_NODE'; nodeId: string | null }

interface MindMapContextValue {
  state: MindMapState
  dispatch: Dispatch<MindMapAction>
}

const MindMapContext = createContext<MindMapContextValue | undefined>(undefined)

const ROOT_NODE_ID = 'root'

const initialState: MindMapState = {
  nodes: [
    {
      id: ROOT_NODE_ID,
      parentId: null,
      text: 'Root',
      x: 0,
      y: 0,
      color: '#4f46e5',
    },
  ],
  selectedNodeId: ROOT_NODE_ID,
  history: {
    past: [],
    future: [],
  },
}

const STORAGE_KEY = 'mindmapper:snapshot'

function isMindMapNode(value: unknown): value is MindMapNode {
  if (!value || typeof value !== 'object') {
    return false
  }

  const node = value as Partial<MindMapNode>
  if (typeof node.id !== 'string') {
    return false
  }

  if (!(typeof node.parentId === 'string' || node.parentId === null)) {
    return false
  }

  if (typeof node.text !== 'string') {
    return false
  }

  if (typeof node.x !== 'number' || typeof node.y !== 'number') {
    return false
  }

  if (typeof node.color !== 'string') {
    return false
  }

  return true
}

function loadPersistedState(): MindMapState {
  if (typeof window === 'undefined') {
    return initialState
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return initialState
    }

    const parsed = JSON.parse(raw) as {
      nodes?: unknown
      selectedNodeId?: unknown
    }

    if (!Array.isArray(parsed.nodes)) {
      return initialState
    }

    const nodes = parsed.nodes.filter(isMindMapNode)
    if (nodes.length === 0) {
      return initialState
    }

    const selectedNodeId =
      typeof parsed.selectedNodeId === 'string' && nodes.some((node) => node.id === parsed.selectedNodeId)
        ? parsed.selectedNodeId
        : nodes[0]?.id ?? null

    return {
      nodes: nodes.map((node) => ({ ...node })),
      selectedNodeId,
      history: {
        past: [],
        future: [],
      },
    }
  } catch (error) {
    console.error('Failed to load persisted mind map state', error)
    return initialState
  }
}

function cloneNodes(nodes: MindMapNode[]) {
  return nodes.map((node) => ({ ...node }))
}

function commitState(
  state: MindMapState,
  nextNodes: MindMapNode[],
  overrides: Partial<Omit<MindMapState, 'history' | 'nodes'>> = {},
): MindMapState {
  return {
    nodes: nextNodes,
    selectedNodeId:
      overrides.selectedNodeId !== undefined ? overrides.selectedNodeId : state.selectedNodeId,
    history: {
      past: [...state.history.past, cloneNodes(state.nodes)],
      future: [],
    },
  }
}

function removeNodeAndDescendants(nodes: MindMapNode[], nodeId: string) {
  const idsToRemove = new Set<string>()

  const visit = (id: string) => {
    idsToRemove.add(id)
    nodes
      .filter((node) => node.parentId === id)
      .forEach((child) => visit(child.id))
  }

  visit(nodeId)
  return nodes.filter((node) => !idsToRemove.has(node.id))
}

function mindMapReducer(state: MindMapState, action: MindMapAction): MindMapState {
  switch (action.type) {
    case 'ADD_NODE': {
      const nextNodes = [...state.nodes, { ...action.node }]
      return commitState(state, nextNodes, { selectedNodeId: action.node.id })
    }
    case 'UPDATE_NODE': {
      const nextNodes = state.nodes.map((node) =>
        node.id === action.nodeId ? { ...node, ...action.updates, id: node.id } : node,
      )
      return commitState(state, nextNodes)
    }
    case 'DELETE_NODE': {
      const target = state.nodes.find((node) => node.id === action.nodeId)
      if (!target) {
        return state
      }

      const nextNodes = removeNodeAndDescendants(state.nodes, action.nodeId)
      const selectedNodeId = nextNodes.some((node) => node.id === state.selectedNodeId)
        ? state.selectedNodeId
        : target.parentId

      return commitState(state, nextNodes, {
        selectedNodeId: selectedNodeId ?? null,
      })
    }
    case 'MOVE_NODE': {
      const nextNodes = state.nodes.map((node) =>
        node.id === action.nodeId
          ? {
              ...node,
              x: action.x,
              y: action.y,
            }
          : node,
      )
      return commitState(state, nextNodes)
    }
    case 'UNDO': {
      if (state.history.past.length === 0) {
        return state
      }
      const previousNodes = state.history.past[state.history.past.length - 1]
      const past = state.history.past.slice(0, -1)
      const future = [cloneNodes(state.nodes), ...state.history.future]
      const selectedNodeId = state.selectedNodeId && previousNodes.some((node) => node.id === state.selectedNodeId)
        ? state.selectedNodeId
        : previousNodes[0]?.id ?? null

      return {
        nodes: cloneNodes(previousNodes),
        selectedNodeId,
        history: {
          past,
          future,
        },
      }
    }
    case 'REDO': {
      if (state.history.future.length === 0) {
        return state
      }
      const [nextNodes, ...restFuture] = state.history.future
      const past = [...state.history.past, cloneNodes(state.nodes)]
      const selectedNodeId = state.selectedNodeId && nextNodes.some((node) => node.id === state.selectedNodeId)
        ? state.selectedNodeId
        : nextNodes[0]?.id ?? null

      return {
        nodes: cloneNodes(nextNodes),
        selectedNodeId,
        history: {
          past,
          future: restFuture,
        },
      }
    }
    case 'IMPORT': {
      const imported = cloneNodes(action.nodes)
      return {
        nodes: imported,
        selectedNodeId: imported[0]?.id ?? null,
        history: {
          past: [],
          future: [],
        },
      }
    }
    case 'EXPORT': {
      return state
    }
    case 'SELECT_NODE': {
      if (action.nodeId && !state.nodes.some((node) => node.id === action.nodeId)) {
        return state
      }
      return {
        ...state,
        selectedNodeId: action.nodeId,
      }
    }
    default:
      return state
  }
}

export function MindMapProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mindMapReducer, undefined, loadPersistedState)
  const value = useMemo(() => ({ state, dispatch }), [state])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const payload = JSON.stringify({
      nodes: state.nodes,
      selectedNodeId: state.selectedNodeId,
    })

    try {
      window.localStorage.setItem(STORAGE_KEY, payload)
    } catch (error) {
      console.error('Failed to persist mind map state', error)
    }
  }, [state.nodes, state.selectedNodeId])

  return <MindMapContext.Provider value={value}>{children}</MindMapContext.Provider>
}

export function useMindMap() {
  const context = useContext(MindMapContext)
  if (!context) {
    throw new Error('useMindMap must be used within a MindMapProvider')
  }
  return context
}

export type { MindMapAction }
