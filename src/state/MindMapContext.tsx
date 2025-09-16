import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react'

export type MindMapNode = {
  id: string
  parentId: string | null
  text: string
  x: number
  y: number
  color: string
}

export type MindMapHistoryEntry = {
  nodes: MindMapNode[]
  selectedNodeId: string | null
}

export type MindMapState = {
  nodes: MindMapNode[]
  selectedNodeId: string | null
  past: MindMapHistoryEntry[]
  future: MindMapHistoryEntry[]
  lastExported: string | null
}

type AddNodeAction = {
  type: 'ADD_NODE'
  payload?: {
    id?: string
    parentId?: string | null
    text?: string
    x?: number
    y?: number
    color?: string
  }
}

type UpdateNodeAction = {
  type: 'UPDATE_NODE'
  payload: {
    id: string
    text?: string
    color?: string
  }
}

type DeleteNodeAction = {
  type: 'DELETE_NODE'
  payload: {
    id: string
  }
}

type MoveNodeAction = {
  type: 'MOVE_NODE'
  payload: {
    id: string
    x: number
    y: number
  }
}

type UndoAction = { type: 'UNDO' }

type RedoAction = { type: 'REDO' }

type ImportAction = {
  type: 'IMPORT'
  payload: {
    nodes: MindMapNode[]
    selectedNodeId?: string | null
  }
}

type ExportAction = { type: 'EXPORT' }

export type MindMapAction =
  | AddNodeAction
  | UpdateNodeAction
  | DeleteNodeAction
  | MoveNodeAction
  | UndoAction
  | RedoAction
  | ImportAction
  | ExportAction

const ROOT_NODE_ID = 'root'
const ROOT_COLOR = '#4f46e5'

const cloneNodes = (nodes: MindMapNode[]): MindMapNode[] => nodes.map((node) => ({ ...node }))

const toHistoryEntry = (state: MindMapState): MindMapHistoryEntry => ({
  nodes: cloneNodes(state.nodes),
  selectedNodeId: state.selectedNodeId,
})

const initialState: MindMapState = {
  nodes: [
    {
      id: ROOT_NODE_ID,
      parentId: null,
      text: 'Root',
      x: 0,
      y: 0,
      color: ROOT_COLOR,
    },
  ],
  selectedNodeId: ROOT_NODE_ID,
  past: [],
  future: [],
  lastExported: null,
}

const ensureId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `node-${Math.random().toString(36).slice(2, 11)}`
}

const findDescendantIds = (nodes: MindMapNode[], targetId: string): Set<string> => {
  const ids = new Set<string>([targetId])
  const queue = [targetId]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    nodes.forEach((node) => {
      if (node.parentId === current) {
        ids.add(node.id)
        queue.push(node.id)
      }
    })
  }

  return ids
}

const workingNodeExists = (nodes: MindMapNode[], id: string): boolean =>
  nodes.some((node) => node.id === id)

const withPast = (state: MindMapState): MindMapState => ({
  ...state,
  past: [...state.past, toHistoryEntry(state)],
  future: [],
})

const mindMapReducer = (state: MindMapState, action: MindMapAction): MindMapState => {
  switch (action.type) {
    case 'ADD_NODE': {
      const workingState = withPast(state)
      const parentId =
        action.payload?.parentId ?? state.selectedNodeId ?? ROOT_NODE_ID
      const newNode: MindMapNode = {
        id: action.payload?.id ?? ensureId(),
        parentId,
        text: action.payload?.text ?? 'New Node',
        x: action.payload?.x ?? 160,
        y: action.payload?.y ?? 0,
        color: action.payload?.color ?? ROOT_COLOR,
      }

      return {
        ...workingState,
        nodes: [...workingState.nodes, newNode],
        selectedNodeId: newNode.id,
        lastExported: null,
      }
    }

    case 'UPDATE_NODE': {
      const { id, text, color } = action.payload
      if (!workingNodeExists(state.nodes, id)) {
        return state
      }
      const workingState = withPast(state)
      return {
        ...workingState,
        nodes: workingState.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                text: text ?? node.text,
                color: color ?? node.color,
              }
            : node,
        ),
        lastExported: null,
      }
    }

    case 'DELETE_NODE': {
      const { id } = action.payload
      if (id === ROOT_NODE_ID) {
        return state
      }

      const nodeToRemove = state.nodes.find((node) => node.id === id)
      if (!nodeToRemove) {
        return state
      }

      const descendantIds = findDescendantIds(state.nodes, id)
      const workingState = withPast(state)
      const remainingNodes = workingState.nodes.filter(
        (node) => !descendantIds.has(node.id),
      )

      const selectedNodeId = descendantIds.has(
        workingState.selectedNodeId ?? '',
      )
        ? nodeToRemove.parentId ?? ROOT_NODE_ID
        : workingState.selectedNodeId

      return {
        ...workingState,
        nodes: remainingNodes,
        selectedNodeId,
        lastExported: null,
      }
    }

    case 'MOVE_NODE': {
      const { id, x, y } = action.payload
      if (!workingNodeExists(state.nodes, id)) {
        return state
      }
      const workingState = withPast(state)
      return {
        ...workingState,
        nodes: workingState.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                x,
                y,
              }
            : node,
        ),
        lastExported: null,
      }
    }

    case 'UNDO': {
      if (state.past.length === 0) {
        return state
      }

      const previous = state.past[state.past.length - 1]
      const newPast = state.past.slice(0, -1)
      const futureEntry = toHistoryEntry(state)

      return {
        ...state,
        nodes: cloneNodes(previous.nodes),
        selectedNodeId: previous.selectedNodeId,
        past: newPast,
        future: [...state.future, futureEntry],
        lastExported: null,
      }
    }

    case 'REDO': {
      if (state.future.length === 0) {
        return state
      }

      const next = state.future[state.future.length - 1]
      const newFuture = state.future.slice(0, -1)
      const pastEntry = toHistoryEntry(state)

      return {
        ...state,
        nodes: cloneNodes(next.nodes),
        selectedNodeId: next.selectedNodeId,
        past: [...state.past, pastEntry],
        future: newFuture,
        lastExported: null,
      }
    }

    case 'IMPORT': {
      const { nodes, selectedNodeId } = action.payload
      if (nodes.length === 0) {
        return state
      }

      const workingState = withPast(state)
      const sanitizedNodes = cloneNodes(nodes)
      const fallbackSelected = sanitizedNodes[0]?.id ?? null

      return {
        ...workingState,
        nodes: sanitizedNodes,
        selectedNodeId: selectedNodeId ?? fallbackSelected,
        lastExported: null,
      }
    }

    case 'EXPORT': {
      return {
        ...state,
        lastExported: JSON.stringify({
          nodes: state.nodes,
          selectedNodeId: state.selectedNodeId,
        }),
      }
    }

    default:
      return state
  }
}

const MindMapContext = createContext<{
  state: MindMapState
  dispatch: Dispatch<MindMapAction>
} | null>(null)

export const MindMapProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(mindMapReducer, initialState)
  const value = useMemo(
    () => ({
      state,
      dispatch,
    }),
    [state],
  )

  return <MindMapContext.Provider value={value}>{children}</MindMapContext.Provider>
}

export const useMindMap = () => {
  const context = useContext(MindMapContext)
  if (!context) {
    throw new Error('useMindMap must be used within a MindMapProvider')
  }

  return context
}

export type MindMapDispatch = Dispatch<MindMapAction>
export { initialState as mindMapInitialState, mindMapReducer }
