/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
} from 'react'

export type TextSize = 'small' | 'medium' | 'large'

export const TEXT_SIZE_CHOICES: readonly TextSize[] = ['small', 'medium', 'large']

export function normalizeTextSize(value: unknown): TextSize {
  return value === 'small' || value === 'medium' || value === 'large'
    ? (value as TextSize)
    : 'medium'
}


export const DEFAULT_NODE_COLOR = '#4f46e5'

export interface MindMapNode {
  id: string
  parentId: string | null
  text: string
  x: number
  y: number
  color: string
  textSize: TextSize
}

export interface MindMapAnnotation {
  id: string
  text: string
  x: number
  y: number
  textSize: TextSize
}

export interface MindMapRing {
  id: string
  kind: 'ring'
  x: number
  y: number
  radius: number
  thickness: number
  color: string
}

export interface MindMapEllipse {
  id: string
  kind: 'ellipse'
  x: number
  y: number
  radiusX: number
  radiusY: number
  thickness: number
  color: string
}

export interface MindMapRectangle {
  id: string
  kind: 'rectangle'
  x: number
  y: number
  width: number
  height: number
  thickness: number
  color: string
}

export interface MindMapArrow {
  id: string
  kind: 'arrow'
  x: number
  y: number
  width: number
  height: number
  thickness: number
  angle: number
  color: string
}

export interface MindMapLine {
  id: string
  kind: 'line'
  x: number
  y: number
  length: number
  thickness: number
  angle: number
  color: string
}

export type MindMapShape =
  | MindMapRing
  | MindMapEllipse
  | MindMapRectangle
  | MindMapArrow
  | MindMapLine

type MindMapShapeUpdate =
  | Partial<Omit<MindMapRing, 'id' | 'kind'>>
  | Partial<Omit<MindMapEllipse, 'id' | 'kind'>>
  | Partial<Omit<MindMapRectangle, 'id' | 'kind'>>
  | Partial<Omit<MindMapArrow, 'id' | 'kind'>>
  | Partial<Omit<MindMapLine, 'id' | 'kind'>>

interface MindMapSnapshot {
  nodes: MindMapNode[]
  annotations: MindMapAnnotation[]
  shapes: MindMapShape[]
}

interface MindMapHistory {
  past: MindMapSnapshot[]
  future: MindMapSnapshot[]
}

export interface MindMapState {
  nodes: MindMapNode[]
  annotations: MindMapAnnotation[]
  shapes: MindMapShape[]
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
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | {
      type: 'IMPORT'
      nodes: MindMapNode[]
      annotations?: MindMapAnnotation[]
      shapes?: MindMapShape[]
    }
  | { type: 'EXPORT' }
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
  selectedNodeIds: [ROOT_NODE_ID],
  selectedAnnotationId: null,
  selectedShapeId: null,
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

  const normalizedSize = normalizeTextSize((node as { textSize?: unknown }).textSize)
  const typedNode = node as { textSize: TextSize }
  typedNode.textSize = normalizedSize

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

  const normalizedSize = normalizeTextSize((annotation as { textSize?: unknown }).textSize)
  const typedAnnotation = annotation as { textSize: TextSize }
  typedAnnotation.textSize = normalizedSize

  return true
}

function isMindMapShape(value: unknown): value is MindMapShape {
  if (!value || typeof value !== 'object') {
    return false
  }

  const shape = value as Partial<MindMapShape> & { kind?: string }
  if (typeof shape.id !== 'string') {
    return false
  }

  if (shape.kind === 'ring') {
    const ring = shape as Partial<MindMapRing>

    if (typeof ring.x !== 'number' || typeof ring.y !== 'number') {
      return false
    }

    if (typeof ring.radius !== 'number' || typeof ring.thickness !== 'number') {
      return false
    }

    if (typeof ring.color !== 'string') {
      return false
    }

    return Number.isFinite(ring.radius) && Number.isFinite(ring.thickness) && ring.thickness > 0
  }

  if (shape.kind === 'ellipse') {
    const ellipse = shape as Partial<MindMapEllipse>

    if (typeof ellipse.x !== 'number' || typeof ellipse.y !== 'number') {
      return false
    }

    if (typeof ellipse.radiusX !== 'number' || typeof ellipse.radiusY !== 'number') {
      return false
    }

    if (typeof ellipse.thickness !== 'number') {
      return false
    }

    if (typeof ellipse.color !== 'string') {
      return false
    }

    return (
      Number.isFinite(ellipse.radiusX) &&
      Number.isFinite(ellipse.radiusY) &&
      ellipse.radiusX > 0 &&
      ellipse.radiusY > 0 &&
      Number.isFinite(ellipse.thickness) &&
      ellipse.thickness > 0
    )
  }

  if (shape.kind === 'rectangle') {
    const rectangle = shape as Partial<MindMapRectangle>

    if (typeof rectangle.x !== 'number' || typeof rectangle.y !== 'number') {
      return false
    }

    if (typeof rectangle.width !== 'number' || typeof rectangle.height !== 'number') {
      return false
    }

    if (typeof rectangle.thickness !== 'number') {
      return false
    }

    if (typeof rectangle.color !== 'string') {
      return false
    }

    return (
      Number.isFinite(rectangle.width) &&
      Number.isFinite(rectangle.height) &&
      rectangle.width > 0 &&
      rectangle.height > 0 &&
      Number.isFinite(rectangle.thickness) &&
      rectangle.thickness > 0
    )
  }

  if (shape.kind === 'arrow') {
    const arrow = shape as Partial<MindMapArrow>

    if (typeof arrow.x !== 'number' || typeof arrow.y !== 'number') {
      return false
    }

    if (typeof arrow.width !== 'number' || typeof arrow.height !== 'number') {
      return false
    }

    if (typeof arrow.thickness !== 'number') {
      return false
    }

    if (typeof arrow.color !== 'string') {
      return false
    }

    const angle = typeof arrow.angle === 'number' && Number.isFinite(arrow.angle) ? arrow.angle : 0
    ;(arrow as { angle: number }).angle = angle

    return (
      Number.isFinite(arrow.width) &&
      Number.isFinite(arrow.height) &&
      arrow.width > 0 &&
      arrow.height > 0 &&
      Number.isFinite(arrow.thickness) &&
      arrow.thickness > 0
    )
  }

  if (shape.kind === 'line') {
    const line = shape as Partial<MindMapLine>

    if (typeof line.x !== 'number' || typeof line.y !== 'number') {
      return false
    }

    if (typeof line.length !== 'number' || typeof line.thickness !== 'number') {
      return false
    }

    if (typeof line.color !== 'string') {
      return false
    }

    const angle = typeof line.angle === 'number' && Number.isFinite(line.angle) ? line.angle : 0
    ;(line as { angle: number }).angle = angle

    return (
      Number.isFinite(line.length) &&
      line.length > 0 &&
      Number.isFinite(line.thickness) &&
      line.thickness > 0
    )
  }

  return false
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
      selectedNodeIds?: unknown
      selectedAnnotationId?: unknown
      shapes?: unknown
      selectedShapeId?: unknown
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

    const shapes = Array.isArray(parsed.shapes) ? parsed.shapes.filter(isMindMapShape) : []

    const existingNodeIds = new Set(nodes.map((node) => node.id))
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

function cloneSnapshot(state: MindMapState): MindMapSnapshot {
  return {
    nodes: cloneNodes(state.nodes),
    annotations: cloneAnnotations(state.annotations),
    shapes: cloneShapes(state.shapes),
  }
}

function commitState(
  state: MindMapState,
  {
    nodes = state.nodes,
    annotations = state.annotations,
    shapes = state.shapes,
    selectedNodeIds = state.selectedNodeIds,
    selectedAnnotationId = state.selectedAnnotationId,
    selectedShapeId = state.selectedShapeId,
  }: {
    nodes?: MindMapNode[]
    annotations?: MindMapAnnotation[]
    shapes?: MindMapShape[]
    selectedNodeIds?: string[]
    selectedAnnotationId?: string | null
    selectedShapeId?: string | null
  } = {},
): MindMapState {
  return {
    nodes,
    annotations,
    shapes,
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

  const updateMap = new Map<string, { x: number; y: number }>()
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

    if (node.x === position.x && node.y === position.y) {
      return node
    }

    didChange = true
    return {
      ...node,
      x: position.x,
      y: position.y,
    }
  })

  if (!didChange) {
    return state
  }

  return commitState(state, { nodes: nextNodes })
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

      if (!hasExtraNodes && state.annotations.length === 0 && !hasShapes) {
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
      const nextShapes = state.shapes.map((shape) => {
        if (shape.id !== action.shapeId) {
          return shape
        }

        if (shape.kind === 'ring') {
          const updates = action.updates as Partial<Omit<MindMapRing, 'id' | 'kind'>>
          return { ...shape, ...updates, id: shape.id, kind: 'ring' as const }
        }

        if (shape.kind === 'ellipse') {
          const updates = action.updates as Partial<Omit<MindMapEllipse, 'id' | 'kind'>>
          return { ...shape, ...updates, id: shape.id, kind: 'ellipse' as const }
        }

        if (shape.kind === 'rectangle') {
          const updates = action.updates as Partial<Omit<MindMapRectangle, 'id' | 'kind'>>
          return { ...shape, ...updates, id: shape.id, kind: 'rectangle' as const }
        }

        if (shape.kind === 'arrow') {
          const updates = action.updates as Partial<Omit<MindMapArrow, 'id' | 'kind'>>
          return { ...shape, ...updates, id: shape.id, kind: 'arrow' as const }
        }

        const updates = action.updates as Partial<Omit<MindMapLine, 'id' | 'kind'>>
        return { ...shape, ...updates, id: shape.id, kind: 'line' as const }
      })
      return commitState(state, { shapes: nextShapes })
    }
    case 'MOVE_SHAPE': {
      const nextShapes = state.shapes.map((shape) =>
        shape.id === action.shapeId
          ? {
              ...shape,
              x: action.x,
              y: action.y,
            }
          : shape,
      )
      return commitState(state, { shapes: nextShapes })
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
    case 'UNDO': {
      if (state.history.past.length === 0) {
        return state
      }
      const previousSnapshot = state.history.past[state.history.past.length - 1]
      const past = state.history.past.slice(0, -1)
      const future = [cloneSnapshot(state), ...state.history.future]

      const normalizedSelection = normalizeSelectedNodeIds(
        state.selectedNodeIds,
        previousSnapshot.nodes,
      )
      const fallbackNodeId = previousSnapshot.nodes[0]?.id
      const selectedNodeIds =
        normalizedSelection.length > 0
          ? normalizedSelection
          : fallbackNodeId
          ? [fallbackNodeId]
          : []

      const selectedAnnotationId =
        state.selectedAnnotationId &&
        previousSnapshot.annotations.some(
          (annotation) => annotation.id === state.selectedAnnotationId,
        )
          ? state.selectedAnnotationId
          : previousSnapshot.annotations[0]?.id ?? null

      const selectedShapeId =
        state.selectedShapeId &&
        previousSnapshot.shapes.some((shape) => shape.id === state.selectedShapeId)
          ? state.selectedShapeId
          : previousSnapshot.shapes[0]?.id ?? null

      return {
        nodes: cloneNodes(previousSnapshot.nodes),
        annotations: cloneAnnotations(previousSnapshot.annotations),
        shapes: cloneShapes(previousSnapshot.shapes),
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

      const normalizedSelection = normalizeSelectedNodeIds(
        state.selectedNodeIds,
        nextSnapshot.nodes,
      )
      const fallbackNodeId = nextSnapshot.nodes[0]?.id
      const selectedNodeIds =
        normalizedSelection.length > 0
          ? normalizedSelection
          : fallbackNodeId
          ? [fallbackNodeId]
          : []

      const selectedAnnotationId =
        state.selectedAnnotationId &&
        nextSnapshot.annotations.some((annotation) => annotation.id === state.selectedAnnotationId)
          ? state.selectedAnnotationId
          : nextSnapshot.annotations[0]?.id ?? null

      const selectedShapeId =
        state.selectedShapeId &&
        nextSnapshot.shapes.some((shape) => shape.id === state.selectedShapeId)
          ? state.selectedShapeId
          : nextSnapshot.shapes[0]?.id ?? null

      return {
        nodes: cloneNodes(nextSnapshot.nodes),
        annotations: cloneAnnotations(nextSnapshot.annotations),
        shapes: cloneShapes(nextSnapshot.shapes),
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
      return {
        nodes: importedNodes,
        annotations: importedAnnotations,
        shapes: importedShapes,
        selectedNodeIds: importedNodes[0] ? [importedNodes[0].id] : [],
        selectedAnnotationId: importedAnnotations[0]?.id ?? null,
        selectedShapeId: importedShapes[0]?.id ?? null,
        history: {
          past: [],
          future: [],
        },
      }
    }
    case 'EXPORT': {
      return state
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
