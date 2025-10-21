import {
  ANNOTATION_MIN_WIDTH,
  ANNOTATION_PADDING_Y,
  CROSS_LINK_COLOR_DARK,
  CROSS_LINK_COLOR_LIGHT,
  CROSS_LINK_CURVE_SCALE,
  CROSS_LINK_MIN_CURVE_OFFSET,
  CROSS_LINK_STROKE_WIDTH,
  LINE_DEFAULT_COLOR,
  LINE_MIN_THICKNESS,
  RING_DEFAULT_COLOR,
  RECTANGLE_DEFAULT_COLOR,
  ELLIPSE_DEFAULT_COLOR,
  ARROW_DEFAULT_COLOR,
} from '../constants/mindMap'
import {
  type MindMapAnnotation,
  type MindMapCrossLink,
  type MindMapNode,
  type MindMapShape,
  normalizeTextSize,
  DEFAULT_NODE_COLOR,
} from '../state/MindMapContext'
import {
  calculateNodeLabelLayout,
  getAnnotationFont,
  getAnnotationLineHeight,
  getNodeFont,
  measureAnnotationMetrics,
  type AnnotationMetrics,
  type NodeLabelLayout,
} from './typography'
import {
  buildArrowPolygon,
  getLineGeometry,
  normalizeVector,
  rotateAndTranslate,
  tracePolygon,
  type Point,
} from './geometry'

type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type ExportScene = {
  nodes: MindMapNode[]
  annotations: MindMapAnnotation[]
  shapes: MindMapShape[]
  crossLinks: MindMapCrossLink[]
}

export type ExportBackgroundTheme = 'dark' | 'light'

export type ExportSceneOptions = {
  backgroundTheme: ExportBackgroundTheme
  padding?: number
}

export type ExportSceneResult = {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

const createInitialBounds = (): Bounds => ({
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
})

const expandBoundsWithPoint = (bounds: Bounds, x: number, y: number) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return
  }
  bounds.minX = Math.min(bounds.minX, x)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxY = Math.max(bounds.maxY, y)
}

const expandBoundsWithCircle = (bounds: Bounds, centerX: number, centerY: number, radius: number) => {
  const safeRadius = Math.max(radius, 0)
  expandBoundsWithPoint(bounds, centerX - safeRadius, centerY - safeRadius)
  expandBoundsWithPoint(bounds, centerX + safeRadius, centerY + safeRadius)
}

const expandBoundsWithRect = (
  bounds: Bounds,
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
) => {
  const width = Math.max(halfWidth, 0)
  const height = Math.max(halfHeight, 0)
  expandBoundsWithPoint(bounds, centerX - width, centerY - height)
  expandBoundsWithPoint(bounds, centerX + width, centerY + height)
}

const evaluateQuadraticPoint = (t: number, start: Point, control: Point, end: Point): Point => {
  const oneMinusT = 1 - t
  const oneMinusTSquared = oneMinusT * oneMinusT
  const tSquared = t * t
  return {
    x: oneMinusTSquared * start.x + 2 * oneMinusT * t * control.x + tSquared * end.x,
    y: oneMinusTSquared * start.y + 2 * oneMinusT * t * control.y + tSquared * end.y,
  }
}

const addQuadraticExtrema = (start: number, control: number, end: number, targets: Set<number>) => {
  const denominator = start - 2 * control + end
  if (Math.abs(denominator) < 1e-6) {
    return
  }
  const t = (start - control) / denominator
  if (t > 0 && t < 1) {
    targets.add(t)
  }
}

const expandBoundsWithQuadratic = (
  bounds: Bounds,
  start: Point,
  control: Point,
  end: Point,
  padding: number,
) => {
  const candidates = new Set<number>([0, 1])
  addQuadraticExtrema(start.x, control.x, end.x, candidates)
  addQuadraticExtrema(start.y, control.y, end.y, candidates)

  candidates.forEach((t) => {
    const point = evaluateQuadraticPoint(t, start, control, end)
    expandBoundsWithCircle(bounds, point.x, point.y, padding)
  })

  expandBoundsWithCircle(bounds, control.x, control.y, padding)
}

const createMeasurementContext = (): CanvasRenderingContext2D | null => {
  const canvas = document.createElement('canvas')
  return canvas.getContext('2d')
}

const measureNodeLayout = (
  context: CanvasRenderingContext2D,
  node: MindMapNode,
): NodeLabelLayout => {
  const textSize = normalizeTextSize(node.textSize)
  const label = node.text.length > 0 ? node.text : 'New Idea'
  const previousFont = context.font
  context.font = getNodeFont(textSize)
  const layout = calculateNodeLabelLayout(context, label, textSize)
  context.font = previousFont
  return layout
}

const resolveCrossLinkCurve = (
  link: MindMapCrossLink,
  nodeMap: Map<string, MindMapNode>,
  nodeLayouts: Map<string, NodeLabelLayout>,
): { start: Point; control: Point; end: Point } | null => {
  const source = nodeMap.get(link.sourceId)
  const target = nodeMap.get(link.targetId)
  if (!source || !target) {
    return null
  }

  const sourceLayout = nodeLayouts.get(source.id)
  const targetLayout = nodeLayouts.get(target.id)
  if (!sourceLayout || !targetLayout) {
    return null
  }

  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.hypot(dx, dy)
  if (!Number.isFinite(distance) || distance < 1) {
    return null
  }

  const midpointX = (source.x + target.x) / 2
  const midpointY = (source.y + target.y) / 2
  const baseOffset = Math.max(CROSS_LINK_MIN_CURVE_OFFSET, distance * CROSS_LINK_CURVE_SCALE)
  const perpX = (-dy / distance) * baseOffset
  const perpY = (dx / distance) * baseOffset

  const controlCandidates: Point[] = [
    { x: midpointX + perpX, y: midpointY + perpY },
    { x: midpointX - perpX, y: midpointY - perpY },
  ]

  const clearanceScores = controlCandidates.map((candidate) => {
    let clearance = Infinity
    nodeLayouts.forEach((layout, nodeId) => {
      const node = nodeMap.get(nodeId)
      if (!node) {
        return
      }
      const radius = layout.radius
      const distanceToCandidate = Math.hypot(candidate.x - node.x, candidate.y - node.y) - radius
      clearance = Math.min(clearance, distanceToCandidate)
    })
    return clearance
  })

  const bestIndex = clearanceScores[0] >= clearanceScores[1] ? 0 : 1
  const control = controlCandidates[bestIndex]

  const startDirection = normalizeVector(control.x - source.x, control.y - source.y)
  const endDirection = normalizeVector(target.x - control.x, target.y - control.y)

  const start: Point = {
    x: source.x + startDirection.x * sourceLayout.radius,
    y: source.y + startDirection.y * sourceLayout.radius,
  }

  const end: Point = {
    x: target.x - endDirection.x * targetLayout.radius,
    y: target.y - endDirection.y * targetLayout.radius,
  }

  return { start, control, end }
}

export const renderMindMapSceneToCanvas = (
  scene: ExportScene,
  options: ExportSceneOptions,
): ExportSceneResult | null => {
  const measurementContext = createMeasurementContext()
  if (!measurementContext) {
    return null
  }

  const nodeLayouts = new Map<string, NodeLabelLayout>()
  const annotationMetrics = new Map<string, AnnotationMetrics>()
  const nodeMap = new Map(scene.nodes.map((node) => [node.id, node]))
  const bounds = createInitialBounds()

  scene.nodes.forEach((node) => {
    const layout = measureNodeLayout(measurementContext, node)
    nodeLayouts.set(node.id, layout)
    expandBoundsWithCircle(bounds, node.x, node.y, layout.radius)
  })

  scene.annotations.forEach((annotation) => {
    const metrics = measureAnnotationMetrics(
      measurementContext,
      annotation.text,
      normalizeTextSize(annotation.textSize),
    )
    annotationMetrics.set(annotation.id, metrics)
    expandBoundsWithRect(bounds, annotation.x, annotation.y, metrics.width / 2, metrics.height / 2)
  })

  scene.shapes.forEach((shape) => {
    if (shape.kind === 'ring') {
      const radius = Math.max(shape.radius, 0)
      const strokeWidth = Math.max(shape.thickness, 0)
      expandBoundsWithCircle(bounds, shape.x, shape.y, radius + strokeWidth / 2)
      return
    }

    if (shape.kind === 'ellipse') {
      const radiusX = Math.max(shape.radiusX, 0)
      const radiusY = Math.max(shape.radiusY, 0)
      const strokeWidth = Math.max(shape.thickness, 0)
      expandBoundsWithRect(bounds, shape.x, shape.y, radiusX + strokeWidth / 2, radiusY + strokeWidth / 2)
      return
    }

    if (shape.kind === 'rectangle') {
      const halfWidth = Math.max(shape.width, 0) / 2
      const halfHeight = Math.max(shape.height, 0) / 2
      const strokeWidth = Math.max(shape.thickness, 0)
      expandBoundsWithRect(bounds, shape.x, shape.y, halfWidth + strokeWidth / 2, halfHeight + strokeWidth / 2)
      return
    }

    if (shape.kind === 'arrow') {
      const polygon = buildArrowPolygon(shape)
      polygon.forEach((point) => {
        expandBoundsWithPoint(bounds, point.x, point.y)
      })
      return
    }

    if (shape.kind === 'line') {
      const geometry = getLineGeometry(shape)
      const angle = shape.angle ?? 0
      const center = { x: shape.x, y: shape.y }
      const start = rotateAndTranslate({ x: -geometry.halfLength, y: 0 }, center, angle)
      const end = rotateAndTranslate({ x: geometry.halfLength, y: 0 }, center, angle)
      const strokeWidth = Math.max(geometry.halfThickness * 2, LINE_MIN_THICKNESS)
      const padding = strokeWidth / 2
      expandBoundsWithCircle(bounds, start.x, start.y, padding)
      expandBoundsWithCircle(bounds, end.x, end.y, padding)
      expandBoundsWithCircle(bounds, center.x, center.y, padding)
    }
  })

  scene.crossLinks.forEach((link) => {
    const curve = resolveCrossLinkCurve(link, nodeMap, nodeLayouts)
    if (!curve) {
      return
    }
    expandBoundsWithQuadratic(bounds, curve.start, curve.control, curve.end, CROSS_LINK_STROKE_WIDTH / 2)
  })

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxY)) {
    return null
  }

  const padding = options.padding ?? 96
  const minX = Math.floor(bounds.minX) - padding
  const minY = Math.floor(bounds.minY) - padding
  const maxX = Math.ceil(bounds.maxX) + padding
  const maxY = Math.ceil(bounds.maxY) + padding

  const contentWidth = Math.max(maxX - minX, 1)
  const contentHeight = Math.max(maxY - minY, 1)

  const scale = window.devicePixelRatio || 1
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = Math.round(contentWidth * scale)
  exportCanvas.height = Math.round(contentHeight * scale)

  const context = exportCanvas.getContext('2d')
  if (!context) {
    return null
  }

  context.scale(scale, scale)

  const gradientCenterX = contentWidth / 2
  const gradientCenterY = contentHeight / 2
  const gradientRadius = Math.max(contentWidth, contentHeight) * 0.6
  const gradient = context.createRadialGradient(
    gradientCenterX,
    gradientCenterY,
    0,
    gradientCenterX,
    gradientCenterY,
    gradientRadius,
  )

  if (options.backgroundTheme === 'dark') {
    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.08)')
    gradient.addColorStop(1, '#020409')
  } else {
    gradient.addColorStop(0, '#fff7ed')
    gradient.addColorStop(1, '#dbeafe')
  }

  context.fillStyle = gradient
  context.fillRect(0, 0, contentWidth, contentHeight)

  context.translate(-minX, -minY)

  scene.shapes.forEach((shape) => {
    context.save()

    if (shape.kind === 'ring') {
      const radius = Math.max(shape.radius, 0)
      const strokeWidth = Math.max(shape.thickness, 1)
      context.lineWidth = strokeWidth
      context.strokeStyle = shape.color || RING_DEFAULT_COLOR
      context.beginPath()
      context.arc(shape.x, shape.y, radius, 0, Math.PI * 2)
      context.stroke()
      context.restore()
      return
    }

    if (shape.kind === 'ellipse') {
      const radiusX = Math.max(shape.radiusX, 0)
      const radiusY = Math.max(shape.radiusY, 0)
      const strokeWidth = Math.max(shape.thickness, 1)
      context.lineWidth = strokeWidth
      context.strokeStyle = shape.color || ELLIPSE_DEFAULT_COLOR
      context.beginPath()
      context.ellipse(shape.x, shape.y, radiusX, radiusY, 0, 0, Math.PI * 2)
      context.stroke()
      context.restore()
      return
    }

    if (shape.kind === 'rectangle') {
      const width = Math.max(shape.width, 0)
      const height = Math.max(shape.height, 0)
      const halfWidth = width / 2
      const halfHeight = height / 2
      const strokeWidth = Math.max(shape.thickness, 1)
      context.lineWidth = strokeWidth
      context.strokeStyle = shape.color || RECTANGLE_DEFAULT_COLOR
      context.strokeRect(shape.x - halfWidth, shape.y - halfHeight, width, height)
      context.restore()
      return
    }

    if (shape.kind === 'arrow') {
      const polygon = buildArrowPolygon(shape)
      const fillColor = shape.color || ARROW_DEFAULT_COLOR
      context.lineJoin = 'round'
      context.lineCap = 'round'
      tracePolygon(context, polygon)
      context.fillStyle = fillColor
      context.fill()
      const outlineWidth = Math.max(1.2, Math.min(shape.thickness / 10, 2.6))
      context.lineWidth = outlineWidth
      context.strokeStyle = fillColor
      context.stroke()
      context.restore()
      return
    }

    if (shape.kind === 'line') {
      const geometry = getLineGeometry(shape)
      const angle = shape.angle ?? 0
      const center = { x: shape.x, y: shape.y }
      const start = rotateAndTranslate({ x: -geometry.halfLength, y: 0 }, center, angle)
      const end = rotateAndTranslate({ x: geometry.halfLength, y: 0 }, center, angle)
      const strokeWidth = Math.max(geometry.halfThickness * 2, LINE_MIN_THICKNESS)
      context.lineCap = 'round'
      context.strokeStyle = shape.color || LINE_DEFAULT_COLOR
      context.lineWidth = strokeWidth
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
      context.stroke()
      context.restore()
      return
    }

    context.restore()
  })

  const connectionStrokeStyle =
    options.backgroundTheme === 'dark'
      ? 'rgba(226, 232, 240, 0.8)'
      : 'rgba(15, 23, 42, 0.7)'

  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = 3
  context.strokeStyle = connectionStrokeStyle

  scene.nodes.forEach((node) => {
    if (!node.parentId) {
      return
    }
    const parent = nodeMap.get(node.parentId)
    if (!parent) {
      return
    }
    context.beginPath()
    context.moveTo(parent.x, parent.y)
    context.lineTo(node.x, node.y)
    context.stroke()
  })

  if (scene.crossLinks.length > 0) {
    context.lineWidth = CROSS_LINK_STROKE_WIDTH
    context.strokeStyle =
      options.backgroundTheme === 'dark' ? CROSS_LINK_COLOR_DARK : CROSS_LINK_COLOR_LIGHT

    scene.crossLinks.forEach((link) => {
      const curve = resolveCrossLinkCurve(link, nodeMap, nodeLayouts)
      if (!curve) {
        return
      }
      context.beginPath()
      context.moveTo(curve.start.x, curve.start.y)
      context.quadraticCurveTo(curve.control.x, curve.control.y, curve.end.x, curve.end.y)
      context.stroke()
    })

    context.lineWidth = 3
    context.strokeStyle = connectionStrokeStyle
  }

  scene.nodes.forEach((node) => {
    const layout = nodeLayouts.get(node.id)
    if (!layout) {
      return
    }

    context.fillStyle = node.color || DEFAULT_NODE_COLOR
    context.beginPath()
    context.arc(node.x, node.y, layout.radius, 0, Math.PI * 2)
    context.fill()

    const previousFont = context.font
    const nodeTextSize = normalizeTextSize(node.textSize)
    context.fillStyle = '#ffffff'
    context.font = getNodeFont(nodeTextSize)
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    const lines = layout.lines
    const lineHeight = layout.lineHeight
    const lineCount = lines.length
    if (lineCount > 0) {
      const firstLineY = node.y - ((lineCount - 1) * lineHeight) / 2
      lines.forEach((line, index) => {
        const lineY = firstLineY + index * lineHeight
        context.fillText(line, node.x, lineY)
      })
    }

    context.font = previousFont
  })

  scene.annotations.forEach((annotation) => {
    const metrics = annotationMetrics.get(annotation.id)
    const textSize = normalizeTextSize(annotation.textSize)
    const width = metrics?.width ?? ANNOTATION_MIN_WIDTH
    const height =
      metrics?.height ?? getAnnotationLineHeight(textSize) + ANNOTATION_PADDING_Y * 2
    const rectX = annotation.x - width / 2
    const rectY = annotation.y - height / 2

    context.fillStyle = 'rgba(15, 23, 42, 0.78)'
    context.fillRect(rectX, rectY, width, height)

    context.lineWidth = 1.5
    context.strokeStyle = 'rgba(148, 163, 184, 0.55)'
    context.strokeRect(rectX, rectY, width, height)

    const previousFont = context.font
    context.fillStyle = '#f8fafc'
    context.font = metrics?.font ?? getAnnotationFont(textSize)
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const text = annotation.text.length > 0 ? annotation.text : 'New text'
    context.fillText(text, annotation.x, annotation.y)
    context.font = previousFont
  })

  return {
    canvas: exportCanvas,
    width: contentWidth,
    height: contentHeight,
  }
}
