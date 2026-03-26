/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
} from 'react'
import {
  sanitizeImportedAnnotations,
  sanitizeImportedCrossLinks,
  sanitizeImportedNodes,
  sanitizeImportedShapes,
} from '../utils/mindMapDocument'
import {
  DEFAULT_NODE_COLOR,
  normalizeTextSize,
  type MindMapAnnotation,
  type MindMapArrow,
  type MindMapCrossLink,
  type MindMapEllipse,
  type MindMapLine,
  type MindMapNode,
  type MindMapRectangle,
  type MindMapRing,
  type MindMapShape,
} from './mindMapModel'

export {
  DEFAULT_NODE_COLOR,
  TEXT_SIZE_CHOICES,
  normalizeTextSize,
} from './mindMapModel'
export type {
  MindMapAnnotation,
  MindMapArrow,
  MindMapCrossLink,
  MindMapEllipse,
  MindMapLine,
  MindMapNode,
  MindMapRectangle,
  MindMapRing,
  MindMapShape,
  TextSize,
} from './mindMapModel'

type MindMapShapeUpdate =
  | Partial<Omit<MindMapRing, 'id' | 'kind'>>
  | Partial<Omit<MindMapEllipse, 'id' | 'kind'>>
  | Partial<Omit<MindMapRectangle, 'id' | 'kind'>>
  | Partial<Omit<MindMapArrow, 'id' | 'kind'>>
  | Partial<Omit<MindMapLine, 'id' | 'kind'>>

const TRANSIENT_SHAPE_KEYS = [
  'x',
  'y',
  'radius',
  'radiusX',
  'radiusY',
  'width',
  'height',
  'thickness',
  'angle',
  'length',
] as const

const TRANSIENT_SHAPE_KEY_SET = new Set<string>(TRANSIENT_SHAPE_KEYS)

interface MindMapSnapshot {
  nodes: MindMapNode[]
  annotations: MindMapAnnotation[]
  shapes: MindMapShape[]
  crossLinks: MindMapCrossLink[]
}

interface MindMapHistory {
  past: MindMapSnapshot[]
  future: MindMapSnapshot[]
}

export interface MindMapState {
  nodes: MindMapNode[]
  annotations: MindMapAnnotation[]
  shapes: MindMapShape[]
  crossLinks: MindMapCrossLink[]
  selectedNodeIds: string[]
  selectedAnnotationId: string | null
  selectedShapeId: string | null
  history: MindMapHistory
}

type MindMapAction =
  | { type: 'ADD_NODES'; nodes: MindMapNode[]; selectedNodeIds?: string[] }
  | { type: 'ADD_NODE'; node: MindMapNode }
  | { type: 'UPDATE_NODE'; nodeId: string; updates: Partial<Omit<MindMapNode, 'id'>> }
  | {
      type: 'UPDATE_NODES'
      updates: { nodeId: string; updates: Partial<Omit<MindMapNode, 'id'>> }[]
    }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'DELETE_NODES'; nodeIds: string[] }
  | { type: 'MOVE_NODE'; nodeId: string; x: number; y: number }
  | { type: 'MOVE_NODES'; updates: { nodeId: string; x: number; y: number }[] }
  | { type: 'SET_SELECTED_NODES'; nodeIds: string[] }
  | { type: 'TOGGLE_NODE_SELECTION'; nodeId: string }
  | { type: 'CLEAR_SELECTED_NODES' }
  | { type: 'CLEAR_ALL' }
  | { type: 'ADD_ANNOTATION'; annotation: MindMapAnnotation }
  | { type: 'UPDATE_ANNOTATION'; annotationId: string; updates: Partial<Omit<MindMapAnnotation, 'id'>> }
  | { type: 'MOVE_ANNOTATION'; annotationId: string; x: number; y: number }
  | { type: 'DELETE_ANNOTATION'; annotationId: string }
  | { type: 'ADD_SHAPE'; shape: MindMapShape }
  | { type: 'UPDATE_SHAPE'; shapeId: string; updates: MindMapShapeUpdate }
  | { type: 'MOVE_SHAPE'; shapeId: string; x: number; y: number }
  | { type: 'DELETE_SHAPE'; shapeId: string }
  | { type: 'ADD_CROSS_LINK'; crossLink: MindMapCrossLink }
  | { type: 'DELETE_CROSS_LINK'; crossLinkId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | {
      type: 'IMPORT'
      nodes: MindMapNode[]
      annotations?: MindMapAnnotation[]
      shapes?: MindMapShape[]
      crossLinks?: MindMapCrossLink[]
    }
  | { type: 'SELECT_ANNOTATION'; annotationId: string | null }
  | { type: 'SELECT_SHAPE'; shapeId: string | null }

interface MindMapContextValue {
  state: MindMapState
  dispatch: Dispatch<MindMapAction>
}

const MindMapContext = createContext<MindMapContextValue | undefined>(undefined)

export const ROOT_NODE_ID = 'root'

const initialState: MindMapState = {
  nodes: [
    {
      id: ROOT_NODE_ID,
      parentId: null,
      text: 'Root',
      x: 0,
      y: 0,
      color: DEFAULT_NODE_COLOR,
      textSize: 'medium',
    },
  ],
  annotations: [],
  shapes: [],
  crossLinks: [],
  selectedNodeIds: [ROOT_NODE_ID],
  selectedAnnotationId: null,
  selectedShapeId: null,
  history: {
    past: [],
    future: [],
  },
}

const STORAGE_KEY = 'mindmapper:snapshot'

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
      selectedNodeIds?: unknown
      selectedAnnotationId?: unknown
      shapes?: unknown
      crossLinks?: unknown
      selectedShapeId?: unknown
    }

    const nodes = sanitizeImportedNodes(parsed.nodes)
    if (!nodes || nodes.length === 0) {
      return initialState
    }

    const annotations = sanitizeImportedAnnotations(parsed.annotations)
    const shapes = sanitizeImportedShapes(parsed.shapes)
    const existingNodeIds = new Set(nodes.map((node) => node.id))
    const crossLinks = sanitizeImportedCrossLinks(parsed.crossLinks, nodes)
    const parsedNodeIds = Array.isArray(parsed.selectedNodeIds)
      ? parsed.selectedNodeIds.filter((value): value is string => typeof value === 'string')
      : []

    const selectedNodeIds = parsedNodeIds.filter((id) => existingNodeIds.has(id))

    if (selectedNodeIds.length === 0) {
      if (typeof parsed.selectedNodeId === 'string' && existingNodeIds.has(parsed.selectedNodeId)) {
        selectedNodeIds.push(parsed.selectedNodeId)
      } else if (parsed.selectedNodeId !== null) {
        const fallbackId = nodes[0]?.id
        if (fallbackId) {
          selectedNodeIds.push(fallbackId)
        }
      }
    }

    const selectedAnnotationId =
      typeof parsed.selectedAnnotationId === 'string' &&
      annotations.some((annotation) => annotation.id === parsed.selectedAnnotationId)
        ? parsed.selectedAnnotationId
        : annotations[0]?.id ?? null

    const selectedShapeId =
      typeof parsed.selectedShapeId === 'string' &&
      shapes.some((shape) => shape.id === parsed.selectedShapeId)
        ? parsed.selectedShapeId
        : shapes[0]?.id ?? null

    return {
      nodes: nodes.map((node) => ({ ...node })),
      annotations: annotations.map((annotation) => ({ ...annotation })),
      shapes: shapes.map((shape) => ({ ...shape })),
      crossLinks: crossLinks.map((link) => ({ ...link })),
      selectedNodeIds,
      selectedAnnotationId,
      selectedShapeId,
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

function cloneShapes(shapes: MindMapShape[]) {
  return shapes.map((shape) => ({ ...shape }))
}

function cloneCrossLinks(crossLinks: MindMapCrossLink[]) {
  return crossLinks.map((link) => ({ ...link }))
}

function cloneSnapshot(state: MindMapState): MindMapSnapshot {
  return {
    nodes: cloneNodes(state.nodes),
    annotations: cloneAnnotations(state.annotations),
    shapes: cloneShapes(state.shapes),
    crossLinks: cloneCrossLinks(state.crossLinks),
  }
}

function mergeLayoutSnapshot(
  snapshot: MindMapSnapshot,
  state: MindMapState,
): MindMapSnapshot {
  const nodeLayout = new Map(state.nodes.map((node) => [node.id, node]))
  const annotationLayout = new Map(state.annotations.map((annotation) => [annotation.id, annotation]))
  const shapeLayout = new Map(state.shapes.map((shape) => [shape.id, shape]))

  const nodes = snapshot.nodes.map((node) => {
    const live = nodeLayout.get(node.id)
    if (!live) {
      return { ...node }
    }

    return { ...node, x: live.x, y: live.y }
  })

  const annotations = snapshot.annotations.map((annotation) => {
    const live = annotationLayout.get(annotation.id)
    if (!live) {
      return { ...annotation }
    }

    return { ...annotation, x: live.x, y: live.y }
  })

  const shapes = snapshot.shapes.map((shape) => {
    const live = shapeLayout.get(shape.id)
    if (!live) {
      return { ...shape }
    }

    const merged = { ...shape } as MindMapShape
    const mergedRecord = merged as unknown as Record<string, unknown>
    const liveRecord = live as unknown as Record<string, unknown>

    TRANSIENT_SHAPE_KEY_SET.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(liveRecord, key)) {
        mergedRecord[key] = liveRecord[key]
      }
    })

    return merged
  })

  return {
    nodes,
    annotations,
    shapes,
    crossLinks: snapshot.crossLinks.map((link) => ({ ...link })),
  }
}

function commitState(
  state: MindMapState,
  {
    nodes = state.nodes,
    annotations = state.annotations,
    shapes = state.shapes,
    crossLinks = state.crossLinks,
    selectedNodeIds = state.selectedNodeIds,
    selectedAnnotationId = state.selectedAnnotationId,
    selectedShapeId = state.selectedShapeId,
  }: {
    nodes?: MindMapNode[]
    annotations?: MindMapAnnotation[]
    shapes?: MindMapShape[]
    crossLinks?: MindMapCrossLink[]
    selectedNodeIds?: string[]
    selectedAnnotationId?: string | null
    selectedShapeId?: string | null
  } = {},
): MindMapState {
  return {
    nodes,
    annotations,
    shapes,
    crossLinks,
    selectedNodeIds: [...selectedNodeIds],
    selectedAnnotationId,
    selectedShapeId,
    history: {
      past: [...state.history.past, cloneSnapshot(state)],
      future: [],
    },
  }
}

function normalizeSelectedNodeIds(nodeIds: string[], nodes: MindMapNode[]) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
    return []
  }

  const existingIds = new Set(nodes.map((node) => node.id))
  const seen = new Set<string>()
  const normalized: string[] = []

  nodeIds.forEach((id) => {
    if (typeof id !== 'string' || !existingIds.has(id) || seen.has(id)) {
      return
    }
    normalized.push(id)
    seen.add(id)
  })

  return normalized
}

function removeNodesAndDescendants(nodes: MindMapNode[], nodeIds: string[]) {
  if (nodeIds.length === 0) {
    return null
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const childrenByParent = new Map<string | null, MindMapNode[]>()
  nodes.forEach((node) => {
    const list = childrenByParent.get(node.parentId)
    if (list) {
      list.push(node)
      return
    }
    childrenByParent.set(node.parentId, [node])
  })

  const idsToRemove = new Set<string>()
  const removalRoots: MindMapNode[] = []

  const visit = (id: string) => {
    if (idsToRemove.has(id)) {
      return
    }

    const node = nodeMap.get(id)
    if (!node) {
      return
    }

    idsToRemove.add(id)
    const children = childrenByParent.get(id)
    if (children) {
      children.forEach((child) => visit(child.id))
    }
  }

  nodeIds.forEach((id) => {
    if (idsToRemove.has(id)) {
      return
    }

    const node = nodeMap.get(id)
    if (!node) {
      return
    }

    removalRoots.push(node)
    visit(id)
  })

  if (idsToRemove.size === 0) {
    return null
  }

  const nextNodes = nodes.filter((node) => !idsToRemove.has(node.id))

  return { nextNodes, removedIds: idsToRemove, removalRoots }
}

function deleteNodes(state: MindMapState, nodeIds: string[]): MindMapState {
  const result = removeNodesAndDescendants(state.nodes, nodeIds)
  if (!result) {
    return state
  }

  const { nextNodes, removedIds, removalRoots } = result
  const remainingSelection = state.selectedNodeIds.filter((id) => !removedIds.has(id))
  const remainingNodeIds = new Set(nextNodes.map((node) => node.id))

  const nextCrossLinks = state.crossLinks.filter(
    (link) => !removedIds.has(link.sourceId) && !removedIds.has(link.targetId),
  )

  let selectedNodeIds = [...remainingSelection]

  if (selectedNodeIds.length === 0) {
    const parentFallback = removalRoots
      .map((node) => node.parentId)
      .find((parentId) => parentId && !removedIds.has(parentId) && remainingNodeIds.has(parentId))

    if (parentFallback) {
      selectedNodeIds = [parentFallback]
    } else {
      const fallbackId = nextNodes[0]?.id
      selectedNodeIds = fallbackId ? [fallbackId] : []
    }
  }

  return commitState(state, {
    nodes: nextNodes,
    crossLinks: nextCrossLinks,
    selectedNodeIds,
  })
}

function moveNodes(
  state: MindMapState,
  updates: { nodeId: string; x: number; y: number }[],
): MindMapState {
  if (updates.length === 0) {
    return state
  }

  const updateMap = new Map<string, Partial<MindMapNode>>()
  updates.forEach((update) => {
    if (typeof update.nodeId !== 'string') {
      return
    }
    updateMap.set(update.nodeId, { x: update.x, y: update.y })
  })

  if (updateMap.size === 0) {
    return state
  }

  let didChange = false
  const nextNodes = state.nodes.map((node) => {
    const position = updateMap.get(node.id)
    if (!position) {
      return node
    }

    const { x, y } = position

    if (typeof x !== 'number' || typeof y !== 'number') {
      return node
    }

    if (node.x === x && node.y === y) {
      return node
    }

    didChange = true
    return {
      ...node,
      x,
      y,
    }
  })

  if (!didChange) {
    return state
  }

  return {
    ...state,
    nodes: nextNodes,
  }
}

function moveAnnotation(
  state: MindMapState,
  annotationId: string,
  position: { x: number; y: number },
): MindMapState {
  let didChange = false

  const nextAnnotations = state.annotations.map((annotation) => {
    if (annotation.id !== annotationId) {
      return annotation
    }

    const { x, y } = position

    if (typeof x !== 'number' || typeof y !== 'number') {
      return annotation
    }

    if (annotation.x === x && annotation.y === y) {
      return annotation
    }

    didChange = true
    return { ...annotation, x, y }
  })

  if (!didChange) {
    return state
  }

  return {
    ...state,
    annotations: nextAnnotations,
  }
}

function moveShape(
  state: MindMapState,
  shapeId: string,
  position: { x: number; y: number },
): MindMapState {
  let didChange = false

  const nextShapes = state.shapes.map((shape) => {
    if (shape.id !== shapeId) {
      return shape
    }

    const { x, y } = position

    if (typeof x !== 'number' || typeof y !== 'number') {
      return shape
    }

    if (shape.x === x && shape.y === y) {
      return shape
    }

    didChange = true
    return { ...shape, x, y }
  })

  if (!didChange) {
    return state
  }

  return {
    ...state,
    shapes: nextShapes,
  }
}

function updateNodes(
  state: MindMapState,
  updates: { nodeId: string; updates: Partial<Omit<MindMapNode, 'id'>> }[],
): MindMapState {
  if (updates.length === 0) {
    return state
  }

  const updateMap = new Map<string, Partial<Omit<MindMapNode, 'id'>>>()

  updates.forEach((entry) => {
    if (!entry || typeof entry.nodeId !== 'string') {
      return
    }

    const { nodeId, updates: partialUpdates } = entry
    if (!partialUpdates || typeof partialUpdates !== 'object') {
      return
    }

    const sanitized: Partial<Omit<MindMapNode, 'id'>> = { ...partialUpdates }

    if ('textSize' in sanitized && sanitized.textSize !== undefined) {
      sanitized.textSize = normalizeTextSize(sanitized.textSize)
    }

    const existing = updateMap.get(nodeId)
    if (existing) {
      updateMap.set(nodeId, { ...existing, ...sanitized })
    } else {
      updateMap.set(nodeId, sanitized)
    }
  })

  if (updateMap.size === 0) {
    return state
  }

  let didChange = false

  const nextNodes = state.nodes.map((node) => {
    const nodeUpdates = updateMap.get(node.id)
    if (!nodeUpdates) {
      return node
    }

    const merged: MindMapNode = { ...node, ...nodeUpdates, id: node.id }
    const changedKeys = Object.keys(nodeUpdates) as (keyof MindMapNode)[]
    const hasDifference = changedKeys.some((key) => merged[key] !== node[key])

    if (!hasDifference) {
      return node
    }

    didChange = true
    return merged
  })

  if (!didChange) {
    return state
  }

  return commitState(state, { nodes: nextNodes })
}

function mindMapReducer(state: MindMapState, action: MindMapAction): MindMapState {
  switch (action.type) {
    case 'ADD_NODES': {
      const existingIds = new Set(state.nodes.map((node) => node.id))
      const newNodes: MindMapNode[] = []

      action.nodes.forEach((node) => {
        if (!node || typeof node.id !== 'string') {
          return
        }

        if (existingIds.has(node.id)) {
          return
        }

        existingIds.add(node.id)
        newNodes.push({ ...node })
      })

      if (newNodes.length === 0) {
        return state
      }

      const nextNodes = [...state.nodes, ...newNodes]
      const desiredSelection = action.selectedNodeIds ?? newNodes.map((node) => node.id)
      const selectedNodeIds = normalizeSelectedNodeIds(desiredSelection, nextNodes)
      const hasSelection = selectedNodeIds.length > 0

      return commitState(state, {
        nodes: nextNodes,
        selectedNodeIds,
        selectedAnnotationId: hasSelection ? null : state.selectedAnnotationId,
        selectedShapeId: hasSelection ? null : state.selectedShapeId,
      })
    }
    case 'ADD_NODE': {
      const nextNodes = [...state.nodes, { ...action.node }]
      return commitState(state, {
        nodes: nextNodes,
        selectedNodeIds: [action.node.id],
        selectedAnnotationId: null,
        selectedShapeId: null,
      })
    }
    case 'UPDATE_NODE': {
      const nextNodes = state.nodes.map((node) =>
        node.id === action.nodeId ? { ...node, ...action.updates, id: node.id } : node,
      )
      return commitState(state, { nodes: nextNodes })
    }
    case 'UPDATE_NODES': {
      return updateNodes(state, action.updates)
    }
    case 'DELETE_NODE': {
      return deleteNodes(state, [action.nodeId])
    }
    case 'DELETE_NODES': {
      return deleteNodes(state, action.nodeIds)
    }
    case 'MOVE_NODE': {
      return moveNodes(state, [{ nodeId: action.nodeId, x: action.x, y: action.y }])
    }
    case 'MOVE_NODES': {
      return moveNodes(state, action.updates)
    }
    case 'CLEAR_ALL': {
      const hasExtraNodes =
        state.nodes.length !== 1 ||
        state.nodes[0]?.id !== ROOT_NODE_ID ||
        state.nodes[0]?.parentId !== null ||
        state.nodes[0]?.text !== 'Root' ||
        state.nodes[0]?.x !== 0 ||
        state.nodes[0]?.y !== 0 ||
        state.nodes[0]?.color !== DEFAULT_NODE_COLOR ||
        state.nodes[0]?.textSize !== 'medium'

      const hasShapes = state.shapes.length > 0
      const hasCrossLinks = state.crossLinks.length > 0

      if (!hasExtraNodes && state.annotations.length === 0 && !hasShapes && !hasCrossLinks) {
        return state
      }

      const resetRoot: MindMapNode = {
        id: ROOT_NODE_ID,
        parentId: null,
        text: 'Root',
        x: 0,
        y: 0,
        color: DEFAULT_NODE_COLOR,
        textSize: 'medium',
      }

      return commitState(state, {
        nodes: [resetRoot],
        annotations: [],
        shapes: [],
        crossLinks: [],
        selectedNodeIds: [ROOT_NODE_ID],
        selectedAnnotationId: null,
        selectedShapeId: null,
      })
    }
    case 'ADD_ANNOTATION': {
      const nextAnnotations = [...state.annotations, { ...action.annotation }]
      return commitState(state, {
        annotations: nextAnnotations,
        selectedAnnotationId: action.annotation.id,
        selectedNodeIds: [],
        selectedShapeId: null,
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
      return moveAnnotation(state, action.annotationId, { x: action.x, y: action.y })
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
    case 'ADD_SHAPE': {
      const nextShapes = [...state.shapes, { ...action.shape }]
      return commitState(state, {
        shapes: nextShapes,
        selectedShapeId: action.shape.id,
        selectedNodeIds: [],
        selectedAnnotationId: null,
      })
    }
    case 'UPDATE_SHAPE': {
      const updateEntries = Object.entries(action.updates).filter(
        ([, value]) => value !== undefined,
      ) as [keyof MindMapShapeUpdate, unknown][]

      if (updateEntries.length === 0) {
        return state
      }

      let didChange = false
      let changedEntries: [string, unknown][] = []

      const nextShapes = state.shapes.map((shape) => {
        if (shape.id !== action.shapeId) {
          return shape
        }

        const nextShape: MindMapShape = { ...shape }
        const localChanges: [string, unknown][] = []

        updateEntries.forEach(([key, value]) => {
          const keyName = key as string
          if (keyName === 'id' || keyName === 'kind') {
            return
          }

          const typedKey = key as keyof MindMapShape
          if ((nextShape as MindMapShape)[typedKey] === value) {
            return
          }

          localChanges.push([keyName, value])
          ;(nextShape as Record<keyof MindMapShape, unknown>)[typedKey] = value
        })

        if (localChanges.length === 0) {
          return shape
        }

        didChange = true
        changedEntries = localChanges
        return nextShape
      })

      if (!didChange || changedEntries.length === 0) {
        return state
      }

      const isTransient = changedEntries.every(([key]) => TRANSIENT_SHAPE_KEY_SET.has(key))

      if (!isTransient) {
        return commitState(state, { shapes: nextShapes })
      }

      return {
        ...state,
        shapes: nextShapes,
      }
    }
    case 'MOVE_SHAPE': {
      return moveShape(state, action.shapeId, { x: action.x, y: action.y })
    }
    case 'DELETE_SHAPE': {
      if (!state.shapes.some((shape) => shape.id === action.shapeId)) {
        return state
      }

      const nextShapes = state.shapes.filter((shape) => shape.id !== action.shapeId)

      const selectedShapeId =
        state.selectedShapeId && state.selectedShapeId === action.shapeId
          ? null
          : state.selectedShapeId

      return commitState(state, {
        shapes: nextShapes,
        selectedShapeId,
      })
    }
    case 'ADD_CROSS_LINK': {
      const { sourceId, targetId } = action.crossLink
      if (sourceId === targetId) {
        return state
      }

      const hasSource = state.nodes.some((node) => node.id === sourceId)
      const hasTarget = state.nodes.some((node) => node.id === targetId)
      if (!hasSource || !hasTarget) {
        return state
      }

      const isDuplicate = state.crossLinks.some(
        (link) =>
          (link.sourceId === sourceId && link.targetId === targetId) ||
          (link.sourceId === targetId && link.targetId === sourceId),
      )

      if (isDuplicate) {
        return state
      }

      const nextCrossLinks = [...state.crossLinks, { ...action.crossLink }]
      return commitState(state, { crossLinks: nextCrossLinks })
    }
    case 'DELETE_CROSS_LINK': {
      if (!state.crossLinks.some((link) => link.id === action.crossLinkId)) {
        return state
      }

      const nextCrossLinks = state.crossLinks.filter((link) => link.id !== action.crossLinkId)
      return commitState(state, { crossLinks: nextCrossLinks })
    }
    case 'UNDO': {
      if (state.history.past.length === 0) {
        return state
      }
      const previousSnapshot = state.history.past[state.history.past.length - 1]
      const past = state.history.past.slice(0, -1)
      const future = [cloneSnapshot(state), ...state.history.future]

      const mergedSnapshot = mergeLayoutSnapshot(previousSnapshot, state)

      const normalizedSelection = normalizeSelectedNodeIds(
        state.selectedNodeIds,
        mergedSnapshot.nodes,
      )
      const fallbackNodeId = mergedSnapshot.nodes[0]?.id
      const selectedNodeIds =
        normalizedSelection.length > 0
          ? normalizedSelection
          : fallbackNodeId
          ? [fallbackNodeId]
          : []

      const selectedAnnotationId =
        state.selectedAnnotationId &&
        mergedSnapshot.annotations.some(
          (annotation) => annotation.id === state.selectedAnnotationId,
        )
          ? state.selectedAnnotationId
          : mergedSnapshot.annotations[0]?.id ?? null

      const selectedShapeId =
        state.selectedShapeId &&
        mergedSnapshot.shapes.some((shape) => shape.id === state.selectedShapeId)
          ? state.selectedShapeId
          : mergedSnapshot.shapes[0]?.id ?? null

      return {
        nodes: cloneNodes(mergedSnapshot.nodes),
        annotations: cloneAnnotations(mergedSnapshot.annotations),
        shapes: cloneShapes(mergedSnapshot.shapes),
        crossLinks: cloneCrossLinks(mergedSnapshot.crossLinks),
        selectedNodeIds,
        selectedAnnotationId,
        selectedShapeId,
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

      const mergedSnapshot = mergeLayoutSnapshot(nextSnapshot, state)

      const normalizedSelection = normalizeSelectedNodeIds(
        state.selectedNodeIds,
        mergedSnapshot.nodes,
      )
      const fallbackNodeId = mergedSnapshot.nodes[0]?.id
      const selectedNodeIds =
        normalizedSelection.length > 0
          ? normalizedSelection
          : fallbackNodeId
          ? [fallbackNodeId]
          : []

      const selectedAnnotationId =
        state.selectedAnnotationId &&
        mergedSnapshot.annotations.some(
          (annotation) => annotation.id === state.selectedAnnotationId,
        )
          ? state.selectedAnnotationId
          : mergedSnapshot.annotations[0]?.id ?? null

      const selectedShapeId =
        state.selectedShapeId &&
        mergedSnapshot.shapes.some((shape) => shape.id === state.selectedShapeId)
          ? state.selectedShapeId
          : mergedSnapshot.shapes[0]?.id ?? null

      return {
        nodes: cloneNodes(mergedSnapshot.nodes),
        annotations: cloneAnnotations(mergedSnapshot.annotations),
        shapes: cloneShapes(mergedSnapshot.shapes),
        crossLinks: cloneCrossLinks(mergedSnapshot.crossLinks),
        selectedNodeIds,
        selectedAnnotationId,
        selectedShapeId,
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
      const importedShapes = action.shapes ? cloneShapes(action.shapes) : []
      const importedCrossLinks = action.crossLinks ? cloneCrossLinks(action.crossLinks) : []
      return {
        nodes: importedNodes,
        annotations: importedAnnotations,
        shapes: importedShapes,
        crossLinks: importedCrossLinks,
        selectedNodeIds: importedNodes[0] ? [importedNodes[0].id] : [],
        selectedAnnotationId: importedAnnotations[0]?.id ?? null,
        selectedShapeId: importedShapes[0]?.id ?? null,
        history: {
          past: [],
          future: [],
        },
      }
    }
    case 'SET_SELECTED_NODES': {
      const selectedNodeIds = normalizeSelectedNodeIds(action.nodeIds, state.nodes)

      if (
        selectedNodeIds.length === state.selectedNodeIds.length &&
        selectedNodeIds.every((id, index) => id === state.selectedNodeIds[index])
      ) {
        return state
      }

      const hasSelection = selectedNodeIds.length > 0
      return {
        ...state,
        selectedNodeIds,
        selectedAnnotationId: hasSelection ? null : state.selectedAnnotationId,
        selectedShapeId: hasSelection ? null : state.selectedShapeId,
      }
    }
    case 'TOGGLE_NODE_SELECTION': {
      const exists = state.nodes.some((node) => node.id === action.nodeId)
      if (!exists) {
        return state
      }

      const isSelected = state.selectedNodeIds.includes(action.nodeId)
      const nextSelection = isSelected
        ? state.selectedNodeIds.filter((id) => id !== action.nodeId)
        : [...state.selectedNodeIds, action.nodeId]

      const selectedNodeIds = normalizeSelectedNodeIds(nextSelection, state.nodes)

      if (
        selectedNodeIds.length === state.selectedNodeIds.length &&
        selectedNodeIds.every((id, index) => id === state.selectedNodeIds[index])
      ) {
        return state
      }

      const hasSelection = selectedNodeIds.length > 0
      return {
        ...state,
        selectedNodeIds,
        selectedAnnotationId: hasSelection ? null : state.selectedAnnotationId,
        selectedShapeId: hasSelection ? null : state.selectedShapeId,
      }
    }
    case 'CLEAR_SELECTED_NODES': {
      if (state.selectedNodeIds.length === 0) {
        return state
      }

      return {
        ...state,
        selectedNodeIds: [],
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
        selectedNodeIds: action.annotationId ? [] : state.selectedNodeIds,
        selectedShapeId: action.annotationId ? null : state.selectedShapeId,
      }
    }
    case 'SELECT_SHAPE': {
      if (action.shapeId && !state.shapes.some((shape) => shape.id === action.shapeId)) {
        return state
      }
      return {
        ...state,
        selectedShapeId: action.shapeId,
        selectedNodeIds: action.shapeId ? [] : state.selectedNodeIds,
        selectedAnnotationId: action.shapeId ? null : state.selectedAnnotationId,
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
      shapes: state.shapes,
      crossLinks: state.crossLinks,
      selectedNodeIds: state.selectedNodeIds,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedShapeId: state.selectedShapeId,
    })

    try {
      window.localStorage.setItem(STORAGE_KEY, payload)
    } catch (error) {
      console.error('Failed to persist mind map state', error)
    }
  }, [
    state.annotations,
    state.crossLinks,
    state.nodes,
    state.selectedAnnotationId,
    state.selectedNodeIds,
    state.selectedShapeId,
    state.shapes,
  ])

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
