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

export interface MindMapAnnotation {
  id: string
  text: string
  x: number
  y: number
}

interface MindMapSnapshot {
  nodes: MindMapNode[]
  annotations: MindMapAnnotation[]
}

interface MindMapHistory {
  past: MindMapSnapshot[]
  future: MindMapSnapshot[]
}

export interface MindMapState {
  nodes: MindMapNode[]
  annotations: MindMapAnnotation[]
  selectedNodeId: string | null
  selectedAnnotationId: string | null
  history: MindMapHistory
}

type MindMapAction =
  | { type: 'ADD_NODE'; node: MindMapNode }
  | { type: 'UPDATE_NODE'; nodeId: string; updates: Partial<Omit<MindMapNode, 'id'>> }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'MOVE_NODE'; nodeId: string; x: number; y: number }
  | { type: 'CLEAR_CHILDREN' }
  | { type: 'ADD_ANNOTATION'; annotation: MindMapAnnotation }
  | { type: 'UPDATE_ANNOTATION'; annotationId: string; updates: Partial<Omit<MindMapAnnotation, 'id'>> }
  | { type: 'MOVE_ANNOTATION'; annotationId: string; x: number; y: number }
  | { type: 'DELETE_ANNOTATION'; annotationId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'IMPORT'; nodes: MindMapNode[]; annotations?: MindMapAnnotation[] }
  | { type: 'EXPORT' }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'SELECT_ANNOTATION'; annotationId: string | null }

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
  annotations: [],
  selectedNodeId: ROOT_NODE_ID,
  selectedAnnotationId: null,
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

function isMindMapAnnotation(value: unknown): value is MindMapAnnotation {
  if (!value || typeof value !== 'object') {
    return false
  }

  const annotation = value as Partial<MindMapAnnotation>
  if (typeof annotation.id !== 'string') {
    return false
  }

  if (typeof annotation.text !== 'string') {
    return false
  }

  if (typeof annotation.x !== 'number' || typeof annotation.y !== 'number') {
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
      annotations?: unknown
      selectedNodeId?: unknown
      selectedAnnotationId?: unknown
    }

    if (!Array.isArray(parsed.nodes)) {
      return initialState
    }

    const nodes = parsed.nodes.filter(isMindMapNode)
    if (nodes.length === 0) {
      return initialState
    }

    const annotations = Array.isArray(parsed.annotations)
      ? parsed.annotations.filter(isMindMapAnnotation)
      : []

    const selectedNodeId =
      typeof parsed.selectedNodeId === 'string' && nodes.some((node) => node.id === parsed.selectedNodeId)
        ? parsed.selectedNodeId
        : nodes[0]?.id ?? null

    const selectedAnnotationId =
      typeof parsed.selectedAnnotationId === 'string' &&
      annotations.some((annotation) => annotation.id === parsed.selectedAnnotationId)
        ? parsed.selectedAnnotationId
        : annotations[0]?.id ?? null

    return {
      nodes: nodes.map((node) => ({ ...node })),
      annotations: annotations.map((annotation) => ({ ...annotation })),
      selectedNodeId,
      selectedAnnotationId,
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

function cloneAnnotations(annotations: MindMapAnnotation[]) {
  return annotations.map((annotation) => ({ ...annotation }))
}

function cloneSnapshot(state: MindMapState): MindMapSnapshot {
  return {
    nodes: cloneNodes(state.nodes),
    annotations: cloneAnnotations(state.annotations),
  }
}

function commitState(
  state: MindMapState,
  {
    nodes = state.nodes,
    annotations = state.annotations,
    selectedNodeId = state.selectedNodeId,
    selectedAnnotationId = state.selectedAnnotationId,
  }: {
    nodes?: MindMapNode[]
    annotations?: MindMapAnnotation[]
    selectedNodeId?: string | null
    selectedAnnotationId?: string | null
  } = {},
): MindMapState {
  return {
    nodes,
    annotations,
    selectedNodeId,
    selectedAnnotationId,
    history: {
      past: [...state.history.past, cloneSnapshot(state)],
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
      return commitState(state, {
        nodes: nextNodes,
        selectedNodeId: action.node.id,
        selectedAnnotationId: null,
      })
    }
    case 'UPDATE_NODE': {
      const nextNodes = state.nodes.map((node) =>
        node.id === action.nodeId ? { ...node, ...action.updates, id: node.id } : node,
      )
      return commitState(state, { nodes: nextNodes })
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

      return commitState(state, {
        nodes: nextNodes,
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
      return commitState(state, { nodes: nextNodes })
    }
    case 'CLEAR_CHILDREN': {
      const roots = state.nodes.filter((node) => node.parentId === null)
      if (roots.length === 0) {
        return state
      }

      const nextNodes = roots.map((node) => ({ ...node }))
      return commitState(state, {
        nodes: nextNodes,
        selectedNodeId: roots[0].id,
      })
    }
    case 'ADD_ANNOTATION': {
      const nextAnnotations = [...state.annotations, { ...action.annotation }]
      return commitState(state, {
        annotations: nextAnnotations,
        selectedAnnotationId: action.annotation.id,
        selectedNodeId: null,
      })
    }
    case 'UPDATE_ANNOTATION': {
      const nextAnnotations = state.annotations.map((annotation) =>
        annotation.id === action.annotationId
          ? { ...annotation, ...action.updates, id: annotation.id }
          : annotation,
      )
      return commitState(state, { annotations: nextAnnotations })
    }
    case 'MOVE_ANNOTATION': {
      const nextAnnotations = state.annotations.map((annotation) =>
        annotation.id === action.annotationId
          ? {
              ...annotation,
              x: action.x,
              y: action.y,
            }
          : annotation,
      )
      return commitState(state, { annotations: nextAnnotations })
    }
    case 'DELETE_ANNOTATION': {
      if (!state.annotations.some((annotation) => annotation.id === action.annotationId)) {
        return state
      }

      const nextAnnotations = state.annotations.filter(
        (annotation) => annotation.id !== action.annotationId,
      )

      const selectedAnnotationId =
        state.selectedAnnotationId && state.selectedAnnotationId === action.annotationId
          ? null
          : state.selectedAnnotationId

      return commitState(state, {
        annotations: nextAnnotations,
        selectedAnnotationId,
      })
    }
    case 'UNDO': {
      if (state.history.past.length === 0) {
        return state
      }
      const previousSnapshot = state.history.past[state.history.past.length - 1]
      const past = state.history.past.slice(0, -1)
      const future = [cloneSnapshot(state), ...state.history.future]

      const selectedNodeId =
        state.selectedNodeId &&
        previousSnapshot.nodes.some((node) => node.id === state.selectedNodeId)
          ? state.selectedNodeId
          : previousSnapshot.nodes[0]?.id ?? null

      const selectedAnnotationId =
        state.selectedAnnotationId &&
        previousSnapshot.annotations.some(
          (annotation) => annotation.id === state.selectedAnnotationId,
        )
          ? state.selectedAnnotationId
          : previousSnapshot.annotations[0]?.id ?? null

      return {
        nodes: cloneNodes(previousSnapshot.nodes),
        annotations: cloneAnnotations(previousSnapshot.annotations),
        selectedNodeId,
        selectedAnnotationId,
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
      const [nextSnapshot, ...restFuture] = state.history.future
      const past = [...state.history.past, cloneSnapshot(state)]

      const selectedNodeId =
        state.selectedNodeId && nextSnapshot.nodes.some((node) => node.id === state.selectedNodeId)
          ? state.selectedNodeId
          : nextSnapshot.nodes[0]?.id ?? null

      const selectedAnnotationId =
        state.selectedAnnotationId &&
        nextSnapshot.annotations.some((annotation) => annotation.id === state.selectedAnnotationId)
          ? state.selectedAnnotationId
          : nextSnapshot.annotations[0]?.id ?? null

      return {
        nodes: cloneNodes(nextSnapshot.nodes),
        annotations: cloneAnnotations(nextSnapshot.annotations),
        selectedNodeId,
        selectedAnnotationId,
        history: {
          past,
          future: restFuture,
        },
      }
    }
    case 'IMPORT': {
      const importedNodes = cloneNodes(action.nodes)
      const importedAnnotations = action.annotations
        ? cloneAnnotations(action.annotations)
        : []
      return {
        nodes: importedNodes,
        annotations: importedAnnotations,
        selectedNodeId: importedNodes[0]?.id ?? null,
        selectedAnnotationId: importedAnnotations[0]?.id ?? null,
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
        selectedAnnotationId: action.nodeId ? null : state.selectedAnnotationId,
      }
    }
    case 'SELECT_ANNOTATION': {
      if (
        action.annotationId &&
        !state.annotations.some((annotation) => annotation.id === action.annotationId)
      ) {
        return state
      }
      return {
        ...state,
        selectedAnnotationId: action.annotationId,
        selectedNodeId: action.annotationId ? null : state.selectedNodeId,
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
      annotations: state.annotations,
      selectedNodeId: state.selectedNodeId,
      selectedAnnotationId: state.selectedAnnotationId,
    })

    try {
      window.localStorage.setItem(STORAGE_KEY, payload)
    } catch (error) {
      console.error('Failed to persist mind map state', error)
    }
  }, [state.annotations, state.nodes, state.selectedAnnotationId, state.selectedNodeId])

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
