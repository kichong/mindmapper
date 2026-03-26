import {
  ARROW_DEFAULT_COLOR,
  ARROW_MIN_HEIGHT,
  ARROW_MIN_THICKNESS,
  ARROW_MIN_WIDTH,
  ELLIPSE_DEFAULT_COLOR,
  ELLIPSE_MIN_RADIUS_X,
  ELLIPSE_MIN_RADIUS_Y,
  LINE_DEFAULT_COLOR,
  LINE_MIN_LENGTH,
  LINE_MIN_THICKNESS,
  RECTANGLE_DEFAULT_COLOR,
  RECTANGLE_MIN_HEIGHT,
  RECTANGLE_MIN_WIDTH,
  RING_DEFAULT_COLOR,
  RING_MIN_RADIUS,
} from '../constants/mindMap'
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
  type MindMapShape,
} from '../state/mindMapModel'
import { enforceArrowHeadHeights } from './geometry'

export type MindMapDocument = {
  nodes: MindMapNode[]
  annotations: MindMapAnnotation[]
  shapes: MindMapShape[]
  crossLinks: MindMapCrossLink[]
}

export const serializeMindMapDocument = (document: MindMapDocument) =>
  JSON.stringify(
    {
      nodes: document.nodes.map((node) => ({ ...node })),
      annotations: document.annotations.map((annotation) => ({ ...annotation })),
      shapes: document.shapes.map((shape) => ({ ...shape })),
      crossLinks: document.crossLinks.map((link) => ({ ...link })),
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  )

export const sanitizeImportedNodes = (value: unknown): MindMapNode[] | null => {
  if (!Array.isArray(value)) {
    return null
  }

  const sanitized = value
    .filter((item): item is MindMapNode => {
      if (!item || typeof item !== 'object') {
        return false
      }

      const node = item as Partial<MindMapNode>
      return (
        typeof node.id === 'string' &&
        (typeof node.parentId === 'string' || node.parentId === null) &&
        typeof node.text === 'string' &&
        typeof node.x === 'number' &&
        typeof node.y === 'number'
      )
    })
    .map((node) => ({
      ...node,
      color: typeof node.color === 'string' ? node.color : DEFAULT_NODE_COLOR,
      textSize: normalizeTextSize((node as { textSize?: unknown }).textSize),
    }))

  return sanitized.length > 0 ? sanitized : null
}

export const sanitizeImportedAnnotations = (value: unknown): MindMapAnnotation[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is MindMapAnnotation => {
      if (!item || typeof item !== 'object') {
        return false
      }

      const annotation = item as Partial<MindMapAnnotation>
      return (
        typeof annotation.id === 'string' &&
        typeof annotation.text === 'string' &&
        typeof annotation.x === 'number' &&
        typeof annotation.y === 'number'
      )
    })
    .map((annotation) => ({
      ...annotation,
      textSize: normalizeTextSize((annotation as { textSize?: unknown }).textSize),
    }))
}

export const sanitizeImportedShapes = (value: unknown): MindMapShape[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<MindMapShape[]>((accumulator, item) => {
    if (!item || typeof item !== 'object') {
      return accumulator
    }

    const shape = item as Partial<MindMapShape> & { kind?: string }

    if (shape.kind === 'ring') {
      if (
        typeof shape.id !== 'string' ||
        typeof shape.x !== 'number' ||
        typeof shape.y !== 'number' ||
        typeof shape.radius !== 'number' ||
        typeof shape.thickness !== 'number'
      ) {
        return accumulator
      }

      const radius = Math.max(RING_MIN_RADIUS, Math.abs(shape.radius))
      const thickness = Math.max(1, Math.abs(shape.thickness))
      const color = typeof shape.color === 'string' ? shape.color : RING_DEFAULT_COLOR

      accumulator.push({
        id: shape.id,
        kind: 'ring',
        x: shape.x,
        y: shape.y,
        radius,
        thickness: Math.min(thickness, radius * 1.5),
        color,
      })
      return accumulator
    }

    if (shape.kind === 'ellipse') {
      const ellipse = shape as Partial<MindMapEllipse>
      if (
        typeof ellipse.id !== 'string' ||
        typeof ellipse.x !== 'number' ||
        typeof ellipse.y !== 'number' ||
        typeof ellipse.radiusX !== 'number' ||
        typeof ellipse.radiusY !== 'number' ||
        typeof ellipse.thickness !== 'number'
      ) {
        return accumulator
      }

      const radiusX = Math.max(ELLIPSE_MIN_RADIUS_X, Math.abs(ellipse.radiusX))
      const radiusY = Math.max(ELLIPSE_MIN_RADIUS_Y, Math.abs(ellipse.radiusY))
      const thickness = Math.max(1, Math.abs(ellipse.thickness))
      const color = typeof ellipse.color === 'string' ? ellipse.color : ELLIPSE_DEFAULT_COLOR

      accumulator.push({
        id: ellipse.id,
        kind: 'ellipse',
        x: ellipse.x,
        y: ellipse.y,
        radiusX,
        radiusY,
        thickness: Math.min(thickness, Math.min(radiusX, radiusY)),
        color,
      })
      return accumulator
    }

    if (shape.kind === 'rectangle') {
      const rectangle = shape as Partial<MindMapRectangle>
      if (
        typeof rectangle.id !== 'string' ||
        typeof rectangle.x !== 'number' ||
        typeof rectangle.y !== 'number' ||
        typeof rectangle.width !== 'number' ||
        typeof rectangle.height !== 'number' ||
        typeof rectangle.thickness !== 'number'
      ) {
        return accumulator
      }

      const width = Math.max(RECTANGLE_MIN_WIDTH, Math.abs(rectangle.width))
      const height = Math.max(RECTANGLE_MIN_HEIGHT, Math.abs(rectangle.height))
      const thickness = Math.max(1, Math.abs(rectangle.thickness))
      const color =
        typeof rectangle.color === 'string' ? rectangle.color : RECTANGLE_DEFAULT_COLOR

      accumulator.push({
        id: rectangle.id,
        kind: 'rectangle',
        x: rectangle.x,
        y: rectangle.y,
        width,
        height,
        thickness: Math.min(thickness, Math.min(width, height) / 2),
        color,
      })
      return accumulator
    }

    if (shape.kind === 'arrow') {
      const arrow = shape as Partial<MindMapArrow>
      if (
        typeof arrow.id !== 'string' ||
        typeof arrow.x !== 'number' ||
        typeof arrow.y !== 'number' ||
        typeof arrow.width !== 'number' ||
        typeof arrow.height !== 'number' ||
        typeof arrow.thickness !== 'number'
      ) {
        return accumulator
      }

      const width = Math.max(ARROW_MIN_WIDTH, Math.abs(arrow.width))
      const rawHeight = Math.max(ARROW_MIN_HEIGHT, Math.abs(arrow.height))
      const thickness = Math.max(ARROW_MIN_THICKNESS, Math.abs(arrow.thickness))
      const angle =
        typeof arrow.angle === 'number' && Number.isFinite(arrow.angle) ? arrow.angle : 0
      const color = typeof arrow.color === 'string' ? arrow.color : ARROW_DEFAULT_COLOR
      const halfThickness = Math.max(thickness / 2, ARROW_MIN_THICKNESS / 2)
      const { headHalfHeight } = enforceArrowHeadHeights(rawHeight / 2, halfThickness)
      const height = headHalfHeight * 2

      accumulator.push({
        id: arrow.id,
        kind: 'arrow',
        x: arrow.x,
        y: arrow.y,
        width,
        height,
        thickness: Math.max(ARROW_MIN_THICKNESS, Math.min(thickness, height)),
        angle,
        color,
      })
      return accumulator
    }

    if (shape.kind === 'line') {
      const line = shape as Partial<MindMapLine>
      if (
        typeof line.id !== 'string' ||
        typeof line.x !== 'number' ||
        typeof line.y !== 'number' ||
        typeof line.length !== 'number' ||
        typeof line.thickness !== 'number'
      ) {
        return accumulator
      }

      accumulator.push({
        id: line.id,
        kind: 'line',
        x: line.x,
        y: line.y,
        length: Math.max(LINE_MIN_LENGTH, Math.abs(line.length)),
        thickness: Math.max(LINE_MIN_THICKNESS, Math.abs(line.thickness)),
        color: typeof line.color === 'string' ? line.color : LINE_DEFAULT_COLOR,
        angle: typeof line.angle === 'number' && Number.isFinite(line.angle) ? line.angle : 0,
      })
    }

    return accumulator
  }, [])
}

export const sanitizeImportedCrossLinks = (
  value: unknown,
  nodeList: MindMapNode[],
): MindMapCrossLink[] => {
  if (!Array.isArray(value) || nodeList.length === 0) {
    return []
  }

  const nodeIds = new Set(nodeList.map((node) => node.id))
  const seenPairs = new Set<string>()
  const seenIds = new Set<string>()

  return value.reduce<MindMapCrossLink[]>((accumulator, item) => {
    if (!item || typeof item !== 'object') {
      return accumulator
    }

    const link = item as Partial<MindMapCrossLink>
    if (
      typeof link.id !== 'string' ||
      seenIds.has(link.id) ||
      typeof link.sourceId !== 'string' ||
      typeof link.targetId !== 'string' ||
      link.sourceId === link.targetId ||
      !nodeIds.has(link.sourceId) ||
      !nodeIds.has(link.targetId)
    ) {
      return accumulator
    }

    const [sourceId, targetId] =
      link.sourceId < link.targetId
        ? [link.sourceId, link.targetId]
        : [link.targetId, link.sourceId]
    const pairKey = `${sourceId}::${targetId}`

    if (seenPairs.has(pairKey)) {
      return accumulator
    }

    seenPairs.add(pairKey)
    seenIds.add(link.id)
    accumulator.push({
      id: link.id,
      sourceId: link.sourceId,
      targetId: link.targetId,
    })
    return accumulator
  }, [])
}

export const parseImportedMindMapDocument = (value: unknown): MindMapDocument | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const parsed = value as {
    nodes?: unknown
    annotations?: unknown
    shapes?: unknown
    crossLinks?: unknown
  }

  const nodes = sanitizeImportedNodes(parsed.nodes)
  if (!nodes) {
    return null
  }

  const annotations = sanitizeImportedAnnotations(parsed.annotations)
  const shapes = sanitizeImportedShapes(parsed.shapes)
  const crossLinks = sanitizeImportedCrossLinks(parsed.crossLinks, nodes)

  return {
    nodes,
    annotations,
    shapes,
    crossLinks,
  }
}
