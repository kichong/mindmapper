import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  DEFAULT_NODE_COLOR,
  ROOT_NODE_ID,
  TEXT_SIZE_CHOICES,
  normalizeTextSize,
  type MindMapAnnotation,
  type MindMapEllipse,
  type MindMapArrow,
  type MindMapNode,
  type MindMapRectangle,
  type MindMapLine,
  type MindMapShape,
  type TextSize,
  useMindMap,
} from './state/MindMapContext'
import { convertDataUrlToBytes, createPdfBytesFromJpeg } from './utils/pdf'
import './App.css'

const NODE_BASE_RADIUS = 40
const NODE_TEXT_PADDING = 18
const NODE_FONT_SIZES: Record<TextSize, number> = {
  small: 12,
  medium: 20,
  large: 30,
}
const NODE_LINE_HEIGHTS: Record<TextSize, number> = {
  small: 18,
  medium: 30,
  large: 45,
}
const NODE_WRAP_STEP = 24
const NODE_RADIUS_EPSILON = 0.5
const LINK_DISTANCE = 160

type NodeColorOption = { value: string; label: string; isDefault: boolean }
const NODE_COLOR_OPTIONS: readonly NodeColorOption[] = [
  { value: DEFAULT_NODE_COLOR, label: 'Indigo', isDefault: true },
  { value: '#22d3ee', label: 'Teal', isDefault: true },
  { value: '#a855f7', label: 'Purple', isDefault: true },
  { value: '#10b981', label: 'Green', isDefault: true },
  { value: '#f97316', label: 'Orange', isDefault: true },
  { value: '#facc15', label: 'Yellow', isDefault: true },
  { value: '#ef4444', label: 'Red', isDefault: false },
  { value: '#6b7280', label: 'Slate Gray', isDefault: false },
  { value: '#9ca3af', label: 'Mist Gray', isDefault: false },
  { value: '#111827', label: 'Black', isDefault: false },
]
const FALLBACK_COLORS = NODE_COLOR_OPTIONS.filter((option) => option.isDefault).map(
  (option) => option.value,
)
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.5
const ZOOM_STEP = 1.2
const KEYBOARD_PAN_STEP = 80
const AUTO_CENTER_PADDING = 160
const ANNOTATION_FONT_SIZES: Record<TextSize, number> = {
  small: 16,
  medium: 26,
  large: 38,
}
const ANNOTATION_LINE_HEIGHTS: Record<TextSize, number> = {
  small: 26,
  medium: 40,
  large: 56,
}
const ANNOTATION_PADDING_X = 14
const ANNOTATION_PADDING_Y = 10
const ANNOTATION_MIN_WIDTH = 120
const RING_DEFAULT_RADIUS = 160
const RING_DEFAULT_THICKNESS = 18
const RING_MIN_RADIUS = 48
const SHAPE_HANDLE_SCREEN_SIZE = 28
const RING_HIT_PADDING = 6
const RING_DEFAULT_COLOR = '#38bdf8'
const ELLIPSE_DEFAULT_RADIUS_X = 200
const ELLIPSE_DEFAULT_RADIUS_Y = 120
const ELLIPSE_MIN_RADIUS_X = 60
const ELLIPSE_MIN_RADIUS_Y = 45
const ELLIPSE_DEFAULT_THICKNESS = 14
const ELLIPSE_HIT_PADDING = 8
const ELLIPSE_DEFAULT_COLOR = '#a855f7'
const RECTANGLE_DEFAULT_WIDTH = 320
const RECTANGLE_DEFAULT_HEIGHT = 200
const RECTANGLE_MIN_WIDTH = 120
const RECTANGLE_MIN_HEIGHT = 80
const RECTANGLE_DEFAULT_THICKNESS = 12
const RECTANGLE_HIT_PADDING = 6
const RECTANGLE_DEFAULT_COLOR = '#34d399'
const ARROW_DEFAULT_WIDTH = 340
const ARROW_DEFAULT_HEIGHT = 180
const ARROW_MIN_WIDTH = 36
const ARROW_MIN_HEIGHT = 6
const ARROW_DEFAULT_THICKNESS = 48
const ARROW_MIN_THICKNESS = 2
const ARROW_HIT_PADDING = 10
const ARROW_DEFAULT_COLOR = '#f97316'
const ARROW_HEAD_RATIO = 0.72
const ARROW_MIN_HEAD_LENGTH = 26
const ARROW_MIN_SHAFT_HALF_HEIGHT = 1.2
const ARROW_HEAD_BASE_RATIO = 2.8
const ARROW_HEAD_BASE_PADDING = 6
const ARROW_MIN_HEAD_HALF_HEIGHT = 7
const ARROW_DEFAULT_ANGLE = 0
const LINE_DEFAULT_LENGTH = 280
const LINE_DEFAULT_THICKNESS = 8
const LINE_MIN_LENGTH = 20
const LINE_MIN_THICKNESS = 1.2
const LINE_HIT_PADDING = 6
const LINE_DEFAULT_COLOR = '#22d3ee'
const LINE_DEFAULT_ANGLE = 0

type Point = { x: number; y: number }

type ArrowGeometry = {
  halfWidth: number
  halfHeight: number
  headLength: number
  shaftHalfHeight: number
}

type LineGeometry = {
  halfLength: number
  halfThickness: number
}

const tracePolygon = (context: CanvasRenderingContext2D, points: Point[]) => {
  if (points.length === 0) {
    return
  }

  context.beginPath()
  context.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0)
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    context.lineTo(point.x, point.y)
  }
  context.closePath()
}

const rotatePoint = (point: Point, angle: number): Point => {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

const rotateAndTranslate = (point: Point, center: Point, angle: number): Point => {
  const rotated = rotatePoint(point, angle)
  return {
    x: rotated.x + center.x,
    y: rotated.y + center.y,
  }
}

const enforceArrowHeadHeights = (rawHalfHeight: number, halfThickness: number) => {
  // Keep the arrow head leg (the perpendicular edge) bold enough to read
  const limitedShaftHalfHeight = Math.max(
    ARROW_MIN_SHAFT_HALF_HEIGHT,
    Math.min(halfThickness, rawHalfHeight),
  )

  const headHalfHeight = Math.max(
    rawHalfHeight,
    limitedShaftHalfHeight * ARROW_HEAD_BASE_RATIO,
    limitedShaftHalfHeight + ARROW_HEAD_BASE_PADDING,
    ARROW_MIN_HEAD_HALF_HEIGHT,
  )

  const shaftHalfHeight = Math.max(
    ARROW_MIN_SHAFT_HALF_HEIGHT,
    Math.min(halfThickness, headHalfHeight),
  )

  return { headHalfHeight, shaftHalfHeight }
}

const toLocalCoordinates = (point: Point, center: Point, angle: number): Point => {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  }
}

const getArrowGeometry = (shape: MindMapArrow): ArrowGeometry => {
  const halfWidth = Math.max(Math.abs(shape.width) / 2, ARROW_MIN_WIDTH / 2)
  const rawHalfHeight = Math.max(Math.abs(shape.height) / 2, ARROW_MIN_HEIGHT / 2)
  const baseHeadLength = Math.max(halfWidth * ARROW_HEAD_RATIO, ARROW_MIN_HEAD_LENGTH)
  const headLength = Math.min(baseHeadLength, halfWidth)
  const halfThickness = Math.max(Math.abs(shape.thickness) / 2, ARROW_MIN_THICKNESS / 2)
  const { headHalfHeight, shaftHalfHeight } = enforceArrowHeadHeights(
    rawHalfHeight,
    halfThickness,
  )

  return {
    halfWidth,
    halfHeight: headHalfHeight,
    headLength,
    shaftHalfHeight,
  }
}

const getLineGeometry = (shape: MindMapLine): LineGeometry => {
  const halfLength = Math.max(Math.abs(shape.length) / 2, LINE_MIN_LENGTH / 2)
  const halfThickness = Math.max(Math.abs(shape.thickness) / 2, LINE_MIN_THICKNESS / 2)

  return {
    halfLength,
    halfThickness,
  }
}

const buildArrowPolygon = (shape: MindMapArrow, extraPadding = 0): Point[] => {
  const { halfWidth, halfHeight, headLength, shaftHalfHeight } = getArrowGeometry(shape)
  const paddedHalfWidth = halfWidth + extraPadding
  const paddedHalfHeight = halfHeight + extraPadding
  const paddedHeadLength = Math.min(paddedHalfWidth, headLength + extraPadding)
  const paddedShaftHalfHeight = Math.max(
    ARROW_MIN_SHAFT_HALF_HEIGHT,
    Math.min(shaftHalfHeight + extraPadding, paddedHalfHeight),
  )

  const angle = shape.angle ?? 0
  const center = { x: shape.x, y: shape.y }
  const headStartX = paddedHalfWidth - paddedHeadLength

  const localPoints: Point[] = [
    { x: -paddedHalfWidth, y: -paddedShaftHalfHeight },
    { x: headStartX, y: -paddedShaftHalfHeight },
    { x: headStartX, y: -paddedHalfHeight },
    { x: paddedHalfWidth, y: 0 },
    { x: headStartX, y: paddedHalfHeight },
    { x: headStartX, y: paddedShaftHalfHeight },
    { x: -paddedHalfWidth, y: paddedShaftHalfHeight },
  ]

  return localPoints.map((point) => rotateAndTranslate(point, center, angle))
}

const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; index += 1) {
    const vertex = polygon[index]
    const previous = polygon[previousIndex]

    const intersects =
      (vertex.y > point.y) !== (previous.y > point.y) &&
      point.x <
        ((previous.x - vertex.x) * (point.y - vertex.y)) /
          ((previous.y - vertex.y) || Number.EPSILON) +
          vertex.x

    if (intersects) {
      inside = !inside
    }

    previousIndex = index
  }

  return inside
}

type ViewTransform = {
  scale: number
  offsetX: number
  offsetY: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const NODE_FONT_FAMILY = 'Inter, system-ui, sans-serif'
const ANNOTATION_FONT_FAMILY = 'Inter, system-ui, sans-serif'

const getNodeFont = (size: TextSize) => `${NODE_FONT_SIZES[size]}px ${NODE_FONT_FAMILY}`
const getNodeLineHeight = (size: TextSize) => NODE_LINE_HEIGHTS[size]
const getAnnotationFont = (size: TextSize) => `${ANNOTATION_FONT_SIZES[size]}px ${ANNOTATION_FONT_FAMILY}`
const getAnnotationLineHeight = (size: TextSize) => ANNOTATION_LINE_HEIGHTS[size]

const calculateNodeRadius = (contentWidth: number, contentHeight: number) => {
  const paddedWidth = contentWidth + NODE_TEXT_PADDING * 2
  const paddedHeight = contentHeight + NODE_TEXT_PADDING * 2
  const diagonal = Math.sqrt(paddedWidth * paddedWidth + paddedHeight * paddedHeight)
  return Math.max(NODE_BASE_RADIUS, diagonal / 2)
}

const calculateNodeLabelLayout = (
  context: CanvasRenderingContext2D,
  rawLabel: string,
  textSize: TextSize,
): NodeLabelLayout => {
  const label = rawLabel.trim().length > 0 ? rawLabel : 'New Idea'
  const lineHeight = getNodeLineHeight(textSize)
  const words = label.split(/\s+/).filter((word) => word.length > 0)

  if (words.length === 0) {
    words.push(label)
  }

  const spaceWidth = context.measureText(' ').width
  const wordWidths = words.map((word) => context.measureText(word).width)
  const prefixWidths = new Array<number>(wordWidths.length + 1)
  prefixWidths[0] = 0

  for (let index = 0; index < wordWidths.length; index += 1) {
    prefixWidths[index + 1] = prefixWidths[index] + wordWidths[index]
  }

  const computeLineWidth = (start: number, end: number) =>
    prefixWidths[end + 1] - prefixWidths[start] + spaceWidth * (end - start)

  const singleLineWidth = context.measureText(label).width
  let maxWordWidth = wordWidths.reduce((max, width) => Math.max(max, width), 0)

  if (!Number.isFinite(maxWordWidth)) {
    maxWordWidth = singleLineWidth
  }

  const minWidth = Math.max(maxWordWidth, 1)
  const maxWidth = Math.max(singleLineWidth, minWidth)
  const candidateWidths = new Set<number>([maxWidth, minWidth])

  if (maxWidth > minWidth) {
    for (let width = maxWidth - NODE_WRAP_STEP; width > minWidth; width -= NODE_WRAP_STEP) {
      candidateWidths.add(width)
    }
  }

  for (let start = 0; start < words.length; start += 1) {
    for (let end = start; end < words.length; end += 1) {
      const width = computeLineWidth(start, end)
      if (width >= minWidth && width <= maxWidth) {
        candidateWidths.add(width)
      }
    }
  }

  const wrapWithWidth = (limit: number) => {
    const segments: Array<{ start: number; end: number; width: number }> = []
    let start = 0

    while (start < words.length) {
      let end = start
      let width = computeLineWidth(start, end)

      while (end + 1 < words.length) {
        const nextWidth = computeLineWidth(start, end + 1)
        if (nextWidth > limit && (width <= limit || end === start)) {
          break
        }

        if (nextWidth > limit && width > limit) {
          break
        }

        end += 1
        width = nextWidth
      }

      segments.push({ start, end, width })
      start = end + 1
    }

    const lines = segments.map(({ start: lineStart, end: lineEnd }) =>
      words.slice(lineStart, lineEnd + 1).join(' '),
    )
    const width = segments.reduce((max, segment) => Math.max(max, segment.width), 0)
    const height = Math.max(lineHeight, lines.length * lineHeight)

    return { lines, width, height }
  }

  let bestLayout = wrapWithWidth(maxWidth)
  let bestRadius = calculateNodeRadius(bestLayout.width, bestLayout.height)

  candidateWidths.forEach((candidate) => {
    if (!Number.isFinite(candidate) || candidate <= 0) {
      return
    }

    const layout = wrapWithWidth(candidate)
    const radius = calculateNodeRadius(layout.width, layout.height)

    if (radius + NODE_RADIUS_EPSILON < bestRadius) {
      bestLayout = layout
      bestRadius = radius
      return
    }

    if (Math.abs(radius - bestRadius) <= NODE_RADIUS_EPSILON) {
      if (layout.width < bestLayout.width - NODE_RADIUS_EPSILON) {
        bestLayout = layout
        bestRadius = radius
      }
    }
  })

  const radius = Math.max(NODE_BASE_RADIUS, bestRadius)

  return {
    lines: bestLayout.lines.length > 0 ? bestLayout.lines : [label],
    width: bestLayout.width,
    height: bestLayout.height,
    lineHeight,
    radius,
  }
}

const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

type InteractionState =
  | {
      mode: 'node'
      pointerId: number
      nodeId: string
      offsetX: number
      offsetY: number
    }
  | {
      mode: 'annotation'
      pointerId: number
      annotationId: string
      offsetX: number
      offsetY: number
    }
  | {
      mode: 'shape-move'
      pointerId: number
      shapeId: string
      offsetX: number
      offsetY: number
    }
  | {
      mode: 'shape-resize'
      pointerId: number
      shapeId: string
    }
  | {
      mode: 'pan'
      pointerId: number
      startClientX: number
      startClientY: number
      startOffsetX: number
      startOffsetY: number
      moved: boolean
    }
  | null

type CanvasSize = {
  width: number
  height: number
}

type AnnotationMetrics = {
  width: number
  height: number
  font: string
}

type NodeLabelLayout = {
  lines: string[]
  width: number
  height: number
  lineHeight: number
  radius: number
}

function calculateFitView(
  nodes: MindMapNode[],
  size: CanvasSize,
  getNodeRadius: (node: MindMapNode) => number,
): ViewTransform | null {
  const { width, height } = size
  if (nodes.length === 0 || width === 0 || height === 0) {
    return null
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  nodes.forEach((node) => {
    const radius = getNodeRadius(node)
    minX = Math.min(minX, node.x - radius)
    maxX = Math.max(maxX, node.x + radius)
    minY = Math.min(minY, node.y - radius)
    maxY = Math.max(maxY, node.y + radius)
  })

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null
  }

  const paddedMinX = minX - AUTO_CENTER_PADDING
  const paddedMaxX = maxX + AUTO_CENTER_PADDING
  const paddedMinY = minY - AUTO_CENTER_PADDING
  const paddedMaxY = maxY + AUTO_CENTER_PADDING

  const contentWidth = Math.max(paddedMaxX - paddedMinX, 1)
  const contentHeight = Math.max(paddedMaxY - paddedMinY, 1)

  const scaleX = width / contentWidth
  const scaleY = height / contentHeight
  const nextScale = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, MAX_ZOOM)

  const centerX = (paddedMinX + paddedMaxX) / 2
  const centerY = (paddedMinY + paddedMaxY) / 2

  return {
    scale: nextScale,
    offsetX: -centerX * nextScale,
    offsetY: -centerY * nextScale,
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0 })
  const interactionRef = useRef<InteractionState>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textInputRef = useRef<HTMLInputElement | null>(null)
  const pendingTextFocusRef = useRef(false)
  const {
    state: { nodes, annotations, shapes, selectedNodeIds, selectedAnnotationId, selectedShapeId, history },
    dispatch,
  } = useMindMap()

  const { past, future } = history

  const nodesRef = useRef(nodes)
  const annotationsRef = useRef(annotations)
  const selectedNodeRef = useRef<string[]>([...selectedNodeIds])
  const selectedAnnotationRef = useRef(selectedAnnotationId)
  const shapesRef = useRef(shapes)
  const selectedShapeRef = useRef(selectedShapeId)

  const primarySelectedNodeId = selectedNodeIds[0] ?? null

  const selectedNode = useMemo(
    () =>
      primarySelectedNodeId
        ? nodes.find((node) => node.id === primarySelectedNodeId) ?? null
        : null,
    [nodes, primarySelectedNodeId],
  )

  const selectedAnnotation = useMemo(
    () =>
      selectedAnnotationId
        ? annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null
        : null,
    [annotations, selectedAnnotationId],
  )

  const selectedShape = useMemo(
    () => (selectedShapeId ? shapes.find((shape) => shape.id === selectedShapeId) ?? null : null),
    [shapes, selectedShapeId],
  )

  const selectedNodeColor = selectedNode?.color ?? DEFAULT_NODE_COLOR

  const selectedTextTarget = useMemo(() => {
    if (selectedNode) {
      return {
        kind: 'node' as const,
        id: selectedNode.id,
        text: selectedNode.text,
        textSize: selectedNode.textSize,
      }
    }

    if (selectedAnnotation) {
      return {
        kind: 'annotation' as const,
        id: selectedAnnotation.id,
        text: selectedAnnotation.text,
        textSize: selectedAnnotation.textSize,
      }
    }

    return null
  }, [selectedAnnotation, selectedNode])

  const [textDraft, setTextDraft] = useState(() => selectedTextTarget?.text ?? '')
  const selectedTextSize: TextSize = selectedTextTarget?.textSize ?? 'medium'
  const [viewTransform, setViewTransform] = useState<ViewTransform>(() => ({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }))
  const viewRef = useRef(viewTransform)
  const hasAutoCenteredRef = useRef(false)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const [isExportMenuOpen, setExportMenuOpen] = useState(false)
  const [isToolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [backgroundTheme, setBackgroundTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    if (!isLocked) {
      return
    }

    const interaction = interactionRef.current
    interactionRef.current = null

    const canvas = canvasRef.current
    if (canvas && interaction && canvas.hasPointerCapture(interaction.pointerId)) {
      canvas.releasePointerCapture(interaction.pointerId)
    }

    if (canvas) {
      canvas.style.cursor = 'grab'
    }

    pendingTextFocusRef.current = false
  }, [isLocked])

  useEffect(() => {
    // Keep the rest of the page in step with the canvas background choice
    const darkColor = '#0f172a'
    const lightColor = '#f8fafc'
    document.body.style.backgroundColor = backgroundTheme === 'dark' ? darkColor : lightColor

    return () => {
      document.body.style.backgroundColor = darkColor
    }
  }, [backgroundTheme])

  const focusInput = useCallback((input: HTMLInputElement | null) => {
    if (!input) {
      return
    }

    requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  }, [])

  const requestTextEditorFocus = useCallback(() => {
    if (isToolbarCollapsed) {
      pendingTextFocusRef.current = true
      setToolbarCollapsed(false)
      return
    }

    pendingTextFocusRef.current = false
    focusInput(textInputRef.current)
  }, [focusInput, isToolbarCollapsed, setToolbarCollapsed])

  const measureAnnotation = useCallback(
    (annotation: MindMapAnnotation): AnnotationMetrics | null => {
      const context = contextRef.current
      if (!context) {
        return null
      }

      const previousFont = context.font
      const textSize = normalizeTextSize(annotation.textSize)
      const annotationFont = getAnnotationFont(textSize)
      context.font = annotationFont
      const content = annotation.text.length > 0 ? annotation.text : 'New text'
      const metrics = context.measureText(content)
      const textWidth = Math.max(
        metrics.width,
        ANNOTATION_MIN_WIDTH - ANNOTATION_PADDING_X * 2,
      )
      const width = textWidth + ANNOTATION_PADDING_X * 2
      const lineHeight = getAnnotationLineHeight(textSize)
      const height = lineHeight + ANNOTATION_PADDING_Y * 2
      context.font = previousFont

      return { width, height, font: annotationFont }
    },
    [],
  )

  const measureNodeLabel = useCallback(
    (node: MindMapNode): NodeLabelLayout => {
      const context = contextRef.current
      const textSize = normalizeTextSize(node.textSize)
      const label = node.text.length > 0 ? node.text : 'New Idea'

      if (!context) {
        const lineHeight = getNodeLineHeight(textSize)
        return {
          lines: [label],
          width: 0,
          height: lineHeight,
          lineHeight,
          radius: calculateNodeRadius(0, lineHeight),
        }
      }

      const previousFont = context.font
      context.font = getNodeFont(textSize)
      const layout = calculateNodeLabelLayout(context, label, textSize)
      context.font = previousFont

      return layout
    },
    [],
  )

  const getNodeRadius = useCallback(
    (node: MindMapNode) => {
      const context = contextRef.current
      if (!context) {
        const textSize = normalizeTextSize(node.textSize)
        return calculateNodeRadius(0, getNodeLineHeight(textSize))
      }

      const layout = measureNodeLabel(node)
      return layout.radius
    },
    [measureNodeLabel],
  )

  useEffect(() => {
    setTextDraft(selectedTextTarget?.text ?? '')
  }, [selectedTextTarget])

  useEffect(() => {
    if (!isToolbarCollapsed && pendingTextFocusRef.current) {
      pendingTextFocusRef.current = false
      focusInput(textInputRef.current)
    }
  }, [focusInput, isToolbarCollapsed, selectedTextTarget])

  const closeExportMenu = useCallback(() => {
    setExportMenuOpen(false)
  }, [])

  const toggleExportMenu = useCallback(() => {
    setExportMenuOpen((previous) => !previous)
  }, [])

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((previous) => !previous)
  }, [])

  const toggleLock = useCallback(() => {
    setIsLocked((previous) => !previous)
  }, [])

  const toggleBackgroundTheme = useCallback(() => {
    setBackgroundTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))
  }, [])

  const drawScene = useCallback(() => {
    const context = contextRef.current
    if (!context) {
      return
    }

    const { width, height } = sizeRef.current
    if (width === 0 || height === 0) {
      return
    }

    const nodesToDraw = nodesRef.current
    const selectedIds = new Set(selectedNodeRef.current)
    const annotationsToDraw = annotationsRef.current
    const selectedAnnotationId = selectedAnnotationRef.current
    const shapesToDraw = shapesRef.current
    const selectedShapeId = selectedShapeRef.current
    const { scale, offsetX, offsetY } = viewRef.current

    context.clearRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2
    const nodeMap = new Map(nodesToDraw.map((node) => [node.id, node]))

    context.save()
    context.translate(centerX + offsetX, centerY + offsetY)
    context.scale(scale, scale)

    shapesToDraw.forEach((shape) => {
      context.save()

      if (shape.kind === 'ring') {
        const radius = Math.max(shape.radius, 0)
        const strokeWidth = Math.max(1, shape.thickness)
        context.lineWidth = strokeWidth
        context.strokeStyle = shape.color || RING_DEFAULT_COLOR
        context.beginPath()
        context.arc(shape.x, shape.y, radius, 0, Math.PI * 2)
        context.stroke()

        if (shape.id === selectedShapeId) {
          const highlightWidth = Math.min(strokeWidth, Math.max(2 / scale, 1.5))
          context.lineWidth = highlightWidth
          context.strokeStyle = '#f97316'
          context.beginPath()
          context.arc(shape.x, shape.y, radius, 0, Math.PI * 2)
          context.stroke()

          const handleSize = SHAPE_HANDLE_SCREEN_SIZE / scale
          const handleHalf = handleSize / 2
          const handleX = shape.x + radius
          const handleY = shape.y
          context.fillStyle = '#facc15'
          context.fillRect(handleX - handleHalf, handleY - handleHalf, handleSize, handleSize)
          context.lineWidth = Math.max(1.5 / scale, 1 / scale)
          context.strokeStyle = '#0f172a'
          context.strokeRect(handleX - handleHalf, handleY - handleHalf, handleSize, handleSize)
        }

        context.restore()
        return
      }

      if (shape.kind === 'ellipse') {
        const radiusX = Math.max(shape.radiusX, 0)
        const radiusY = Math.max(shape.radiusY, 0)
        const strokeWidth = Math.max(1, shape.thickness)
        const strokeColor = shape.color || ELLIPSE_DEFAULT_COLOR

        context.beginPath()
        context.ellipse(shape.x, shape.y, radiusX, radiusY, 0, 0, Math.PI * 2)
        context.lineWidth = strokeWidth
        context.strokeStyle = strokeColor
        context.stroke()

        if (shape.id === selectedShapeId) {
          const highlightWidth = Math.min(strokeWidth, Math.max(2 / scale, 1.5))
          context.lineWidth = highlightWidth
          context.strokeStyle = '#f97316'
          context.beginPath()
          context.ellipse(shape.x, shape.y, radiusX, radiusY, 0, 0, Math.PI * 2)
          context.stroke()

          const handleSize = SHAPE_HANDLE_SCREEN_SIZE / scale
          const handleHalf = handleSize / 2
          const handleX = shape.x + radiusX
          const handleY = shape.y + radiusY
          context.fillStyle = '#facc15'
          context.fillRect(handleX - handleHalf, handleY - handleHalf, handleSize, handleSize)
          context.lineWidth = Math.max(1.5 / scale, 1 / scale)
          context.strokeStyle = '#0f172a'
          context.strokeRect(handleX - handleHalf, handleY - handleHalf, handleSize, handleSize)
        }

        context.restore()
        return
      }

      if (shape.kind === 'rectangle') {
        const width = Math.max(shape.width, 0)
        const height = Math.max(shape.height, 0)
        const halfWidth = width / 2
        const halfHeight = height / 2
        const strokeWidth = Math.max(1, shape.thickness)
        const strokeColor = shape.color || RECTANGLE_DEFAULT_COLOR

        context.lineWidth = strokeWidth
        context.strokeStyle = strokeColor
        context.strokeRect(shape.x - halfWidth, shape.y - halfHeight, width, height)

        if (shape.id === selectedShapeId) {
          const highlightWidth = Math.min(strokeWidth, Math.max(2 / scale, 1.5))
          context.lineWidth = highlightWidth
          context.strokeStyle = '#f97316'
          context.strokeRect(shape.x - halfWidth, shape.y - halfHeight, width, height)

          const handleSize = SHAPE_HANDLE_SCREEN_SIZE / scale
          const handleHalf = handleSize / 2
          const handleX = shape.x + halfWidth
          const handleY = shape.y + halfHeight
          context.fillStyle = '#facc15'
          context.fillRect(handleX - handleHalf, handleY - handleHalf, handleSize, handleSize)
          context.lineWidth = Math.max(1.5 / scale, 1 / scale)
          context.strokeStyle = '#0f172a'
          context.strokeRect(handleX - handleHalf, handleY - handleHalf, handleSize, handleSize)
        }

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

        if (shape.id === selectedShapeId) {
          const highlightWidth = Math.max(Math.max(2 / scale, 1.5), outlineWidth)
          context.lineWidth = highlightWidth
          context.strokeStyle = '#f97316'
          context.stroke()

          const geometry = getArrowGeometry(shape)
          const handleSize = SHAPE_HANDLE_SCREEN_SIZE / scale
          const handleHalf = handleSize / 2
          const handlePoint = rotateAndTranslate(
            { x: geometry.halfWidth, y: geometry.halfHeight },
            { x: shape.x, y: shape.y },
            shape.angle ?? 0,
          )
          context.fillStyle = '#facc15'
          context.fillRect(
            handlePoint.x - handleHalf,
            handlePoint.y - handleHalf,
            handleSize,
            handleSize,
          )
          context.lineWidth = Math.max(1.5 / scale, 1 / scale)
          context.strokeStyle = '#0f172a'
          context.strokeRect(
            handlePoint.x - handleHalf,
            handlePoint.y - handleHalf,
            handleSize,
            handleSize,
          )
        }

        context.restore()
        return
      }

      if (shape.kind === 'line') {
        const geometry = getLineGeometry(shape)
        const angle = shape.angle ?? 0
        const center = { x: shape.x, y: shape.y }
        const color = shape.color || LINE_DEFAULT_COLOR
        const start = rotateAndTranslate({ x: -geometry.halfLength, y: 0 }, center, angle)
        const end = rotateAndTranslate({ x: geometry.halfLength, y: 0 }, center, angle)
        const strokeWidth = Math.max(geometry.halfThickness * 2, LINE_MIN_THICKNESS)

        context.lineCap = 'round'
        context.strokeStyle = color
        context.lineWidth = strokeWidth
        context.beginPath()
        context.moveTo(start.x, start.y)
        context.lineTo(end.x, end.y)
        context.stroke()

        if (shape.id === selectedShapeId) {
          const highlightWidth = Math.max(Math.max(2 / scale, 1.5), strokeWidth)
          context.beginPath()
          context.moveTo(start.x, start.y)
          context.lineTo(end.x, end.y)
          context.lineWidth = highlightWidth
          context.strokeStyle = '#f97316'
          context.stroke()

          const handleSize = SHAPE_HANDLE_SCREEN_SIZE / scale
          const handleHalf = handleSize / 2
          const handlePoint = rotateAndTranslate(
            { x: geometry.halfLength, y: 0 },
            center,
            angle,
          )
          context.fillStyle = '#facc15'
          context.fillRect(
            handlePoint.x - handleHalf,
            handlePoint.y - handleHalf,
            handleSize,
            handleSize,
          )
          context.lineWidth = Math.max(1.5 / scale, 1 / scale)
          context.strokeStyle = '#0f172a'
          context.strokeRect(
            handlePoint.x - handleHalf,
            handlePoint.y - handleHalf,
            handleSize,
            handleSize,
          )
        }

        context.restore()
        return
      }

      context.restore()
    })

    const connectionStrokeStyle =
      backgroundTheme === 'dark' ? 'rgba(226, 232, 240, 0.8)' : 'rgba(15, 23, 42, 0.7)'
    const connectionLineWidth = 3
    const connectionHighlightWidth = Math.max(connectionLineWidth + 1.5, 4)

    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = connectionLineWidth
    context.strokeStyle = connectionStrokeStyle

    nodesToDraw.forEach((node) => {
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

    nodesToDraw.forEach((node) => {
      const nodeX = node.x
      const nodeY = node.y
      const layout = measureNodeLabel(node)
      const radius = layout.radius

      context.fillStyle = node.color || DEFAULT_NODE_COLOR
      context.beginPath()
      context.arc(nodeX, nodeY, radius, 0, Math.PI * 2)
      context.fill()

      if (selectedIds.has(node.id)) {
        context.lineWidth = connectionHighlightWidth
        context.strokeStyle = '#f97316'
        context.stroke()
        context.lineWidth = connectionLineWidth
        context.strokeStyle = connectionStrokeStyle
      }

      context.fillStyle = '#ffffff'
      const previousFont = context.font
      const nodeTextSize = normalizeTextSize(node.textSize)
      context.font = getNodeFont(nodeTextSize)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const lines = layout.lines
      const lineHeight = layout.lineHeight
      const lineCount = lines.length
      if (lineCount === 0) {
        context.font = previousFont
        return
      }
      const firstLineY = nodeY - ((lineCount - 1) * lineHeight) / 2

      lines.forEach((line, index) => {
        const lineY = firstLineY + index * lineHeight
        context.fillText(line, nodeX, lineY)
      })
      context.font = previousFont
    })

    context.textAlign = 'center'
    context.textBaseline = 'middle'

    annotationsToDraw.forEach((annotation) => {
      const metrics = measureAnnotation(annotation)
      const annotationTextSize = normalizeTextSize(annotation.textSize)
      const defaultHeight =
        getAnnotationLineHeight(annotationTextSize) + ANNOTATION_PADDING_Y * 2
      const widthWithPadding = metrics?.width ?? ANNOTATION_MIN_WIDTH
      const heightWithPadding = metrics?.height ?? defaultHeight
      const rectX = annotation.x - widthWithPadding / 2
      const rectY = annotation.y - heightWithPadding / 2

      context.fillStyle = 'rgba(15, 23, 42, 0.78)'
      context.fillRect(rectX, rectY, widthWithPadding, heightWithPadding)

      context.lineWidth = annotation.id === selectedAnnotationId ? 3 : 1.5
      context.strokeStyle =
        annotation.id === selectedAnnotationId ? '#38bdf8' : 'rgba(148, 163, 184, 0.55)'
      context.strokeRect(rectX, rectY, widthWithPadding, heightWithPadding)

      context.fillStyle = '#f8fafc'
      const previousFont = context.font
      const annotationFont = metrics?.font ?? getAnnotationFont(annotationTextSize)
      context.font = annotationFont
      context.fillText(
        annotation.text.length > 0 ? annotation.text : 'New text',
        annotation.x,
        annotation.y,
      )
      context.font = previousFont
    })

    context.restore()
  }, [backgroundTheme, measureAnnotation, measureNodeLabel])

  useEffect(() => {
    viewRef.current = viewTransform
    drawScene()
  }, [viewTransform, drawScene])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const context = contextRef.current
    if (!canvas || !context) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const cssWidth = window.innerWidth
    const cssHeight = window.innerHeight

    sizeRef.current = { width: cssWidth, height: cssHeight }

    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawScene()

    if (!hasAutoCenteredRef.current) {
      const fitTransform = calculateFitView(nodesRef.current, sizeRef.current, getNodeRadius)
      if (fitTransform) {
        hasAutoCenteredRef.current = true
        setViewTransform(fitTransform)
      }
    }
  }, [drawScene, getNodeRadius])

  useEffect(() => {
    nodesRef.current = nodes
    annotationsRef.current = annotations
    selectedNodeRef.current = [...selectedNodeIds]
    selectedAnnotationRef.current = selectedAnnotationId
    shapesRef.current = shapes
    selectedShapeRef.current = selectedShapeId
    drawScene()
  }, [
    annotations,
    nodes,
    selectedAnnotationId,
    selectedNodeIds,
    selectedShapeId,
    shapes,
    drawScene,
  ])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const menu = exportMenuRef.current
      if (!menu) {
        return
      }

      if (event.target instanceof Node && !menu.contains(event.target)) {
        closeExportMenu()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeExportMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeExportMenu])

  const adjustZoom = useCallback((factor: number, pivot?: { screenX: number; screenY: number }) => {
    setViewTransform((previous) => {
      hasAutoCenteredRef.current = true
      const nextScale = clamp(previous.scale * factor, MIN_ZOOM, MAX_ZOOM)
      if (nextScale === previous.scale) {
        return previous
      }

      if (pivot) {
        const { width, height } = sizeRef.current
        const centerX = width / 2
        const centerY = height / 2
        const worldX = (pivot.screenX - centerX - previous.offsetX) / previous.scale
        const worldY = (pivot.screenY - centerY - previous.offsetY) / previous.scale

        return {
          scale: nextScale,
          offsetX: pivot.screenX - centerX - nextScale * worldX,
          offsetY: pivot.screenY - centerY - nextScale * worldY,
        }
      }

      const worldCenterX = -previous.offsetX / previous.scale
      const worldCenterY = -previous.offsetY / previous.scale

      return {
        scale: nextScale,
        offsetX: -worldCenterX * nextScale,
        offsetY: -worldCenterY * nextScale,
      }
    })
  }, [])

  const handleZoomIn = useCallback(() => {
    adjustZoom(ZOOM_STEP)
  }, [adjustZoom])

  const handleZoomOut = useCallback(() => {
    adjustZoom(1 / ZOOM_STEP)
  }, [adjustZoom])

  const handleResetView = useCallback(() => {
    const fitTransform = calculateFitView(nodes, sizeRef.current, getNodeRadius)
    if (fitTransform) {
      hasAutoCenteredRef.current = true
      setViewTransform(fitTransform)
      return
    }

    setViewTransform({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    })
  }, [getNodeRadius, nodes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    contextRef.current = context
    resizeCanvas()

    canvas.style.cursor = 'grab'

    const getCanvasPoint = (event: PointerEvent | WheelEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    }

    const getScenePointFromCanvas = (x: number, y: number) => {
      const { width, height } = sizeRef.current
      const { scale, offsetX, offsetY } = viewRef.current
      const centerX = width / 2
      const centerY = height / 2

      return {
        x: (x - centerX - offsetX) / scale,
        y: (y - centerY - offsetY) / scale,
      }
    }

    const getScenePoint = (event: PointerEvent) => {
      const { x, y } = getCanvasPoint(event)
      return getScenePointFromCanvas(x, y)
    }

    const finishInteraction = (pointerId: number, shouldDeselect: boolean) => {
      const interaction = interactionRef.current
      if (!interaction || interaction.pointerId !== pointerId) {
        return
      }

      if (interaction.mode === 'pan' && shouldDeselect && !interaction.moved) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
      }

      interactionRef.current = null

      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId)
      }

      canvas.style.cursor = 'grab'
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        return
      }

      const scenePoint = getScenePoint(event)
      const { scale } = viewRef.current
      const handleHalfSize = SHAPE_HANDLE_SCREEN_SIZE / scale / 2

      const hitResizeShape = [...shapesRef.current]
        .reverse()
        .find((shape) => {
          if (shape.kind === 'ring') {
            const radius = Math.max(shape.radius, 0)
            const handleX = shape.x + radius
            const handleY = shape.y

            return (
              scenePoint.x >= handleX - handleHalfSize &&
              scenePoint.x <= handleX + handleHalfSize &&
              scenePoint.y >= handleY - handleHalfSize &&
              scenePoint.y <= handleY + handleHalfSize
            )
          }

          if (shape.kind === 'ellipse') {
            const radiusX = Math.max(shape.radiusX, 0)
            const radiusY = Math.max(shape.radiusY, 0)
            const handleX = shape.x + radiusX
            const handleY = shape.y + radiusY

            return (
              scenePoint.x >= handleX - handleHalfSize &&
              scenePoint.x <= handleX + handleHalfSize &&
              scenePoint.y >= handleY - handleHalfSize &&
              scenePoint.y <= handleY + handleHalfSize
            )
          }

          if (shape.kind === 'rectangle') {
            const halfWidth = Math.max(shape.width, 0) / 2
            const halfHeight = Math.max(shape.height, 0) / 2
            const handleX = shape.x + halfWidth
            const handleY = shape.y + halfHeight

            return (
              scenePoint.x >= handleX - handleHalfSize &&
              scenePoint.x <= handleX + handleHalfSize &&
              scenePoint.y >= handleY - handleHalfSize &&
              scenePoint.y <= handleY + handleHalfSize
            )
          }

          if (shape.kind === 'arrow') {
            const geometry = getArrowGeometry(shape)
            const localPoint = toLocalCoordinates(
              scenePoint,
              { x: shape.x, y: shape.y },
              shape.angle ?? 0,
            )

            return (
              localPoint.x >= geometry.halfWidth - handleHalfSize &&
              localPoint.x <= geometry.halfWidth + handleHalfSize &&
              localPoint.y >= geometry.halfHeight - handleHalfSize &&
              localPoint.y <= geometry.halfHeight + handleHalfSize
            )
          }

          if (shape.kind === 'line') {
            const geometry = getLineGeometry(shape)
            const localPoint = toLocalCoordinates(
              scenePoint,
              { x: shape.x, y: shape.y },
              shape.angle ?? 0,
            )

            return (
              localPoint.x >= geometry.halfLength - handleHalfSize &&
              localPoint.x <= geometry.halfLength + handleHalfSize &&
              localPoint.y >= -handleHalfSize &&
              localPoint.y <= handleHalfSize
            )
          }

          return false
        })

      if (hitResizeShape) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: hitResizeShape.id })

        if (isLocked) {
          event.preventDefault()
          return
        }

        interactionRef.current = {
          mode: 'shape-resize',
          pointerId: event.pointerId,
          shapeId: hitResizeShape.id,
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
        return
      }

      const hitNode = [...nodesRef.current]
        .reverse()
        .find((node) => Math.hypot(scenePoint.x - node.x, scenePoint.y - node.y) <= getNodeRadius(node))

      if (hitNode) {
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SET_SELECTED_NODES', nodeIds: [hitNode.id] })

        if (isLocked) {
          event.preventDefault()
          return
        }

        interactionRef.current = {
          mode: 'node',
          pointerId: event.pointerId,
          nodeId: hitNode.id,
          offsetX: scenePoint.x - hitNode.x,
          offsetY: scenePoint.y - hitNode.y,
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
        return
      }

      const hitAnnotation = [...annotationsRef.current]
        .reverse()
        .find((annotation) => {
          const metrics = measureAnnotation(annotation)
          if (!metrics) {
            return false
          }

          const halfWidth = metrics.width / 2
          const halfHeight = metrics.height / 2

          return (
            scenePoint.x >= annotation.x - halfWidth &&
            scenePoint.x <= annotation.x + halfWidth &&
            scenePoint.y >= annotation.y - halfHeight &&
            scenePoint.y <= annotation.y + halfHeight
          )
        })

      if (hitAnnotation) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: hitAnnotation.id })

        if (isLocked) {
          event.preventDefault()
          return
        }

        interactionRef.current = {
          mode: 'annotation',
          pointerId: event.pointerId,
          annotationId: hitAnnotation.id,
          offsetX: scenePoint.x - hitAnnotation.x,
          offsetY: scenePoint.y - hitAnnotation.y,
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
        return
      }

      const hitShape = [...shapesRef.current]
        .reverse()
        .find((shape) => {
          if (shape.kind === 'ring') {
            const radius = Math.max(shape.radius, 0)
            const distance = Math.hypot(scenePoint.x - shape.x, scenePoint.y - shape.y)
            const hitBand = Math.max(1, shape.thickness / 2 + RING_HIT_PADDING)
            const outerRadius = radius + hitBand
            const innerRadius = Math.max(0, radius - hitBand)

            return distance <= outerRadius && distance >= innerRadius
          }

          if (shape.kind === 'ellipse') {
            const radiusX = Math.max(shape.radiusX, 1)
            const radiusY = Math.max(shape.radiusY, 1)
            const dx = scenePoint.x - shape.x
            const dy = scenePoint.y - shape.y
            const hitBand = Math.max(1, shape.thickness / 2 + ELLIPSE_HIT_PADDING)
            const outerRadiusX = radiusX + hitBand
            const outerRadiusY = radiusY + hitBand

            const outerNormalized =
              (dx * dx) / (outerRadiusX * outerRadiusX) + (dy * dy) / (outerRadiusY * outerRadiusY)

            if (!Number.isFinite(outerNormalized) || outerNormalized > 1) {
              return false
            }

            const innerRadiusX = radiusX - hitBand
            const innerRadiusY = radiusY - hitBand

            if (innerRadiusX <= 0 || innerRadiusY <= 0) {
              return true
            }

            const innerNormalized =
              (dx * dx) / (innerRadiusX * innerRadiusX) + (dy * dy) / (innerRadiusY * innerRadiusY)

            return !Number.isFinite(innerNormalized) || innerNormalized >= 1
          }

          if (shape.kind === 'rectangle') {
            const halfWidth = Math.max(shape.width, 1) / 2
            const halfHeight = Math.max(shape.height, 1) / 2
            const hitBand = Math.max(1, shape.thickness / 2 + RECTANGLE_HIT_PADDING)
            const outerHalfWidth = halfWidth + hitBand
            const outerHalfHeight = halfHeight + hitBand

            const withinOuter =
              scenePoint.x >= shape.x - outerHalfWidth &&
              scenePoint.x <= shape.x + outerHalfWidth &&
              scenePoint.y >= shape.y - outerHalfHeight &&
              scenePoint.y <= shape.y + outerHalfHeight

            if (!withinOuter) {
              return false
            }

            const innerHalfWidth = halfWidth - hitBand
            const innerHalfHeight = halfHeight - hitBand

            if (innerHalfWidth <= 0 || innerHalfHeight <= 0) {
              return true
            }

            const withinInner =
              scenePoint.x > shape.x - innerHalfWidth &&
              scenePoint.x < shape.x + innerHalfWidth &&
              scenePoint.y > shape.y - innerHalfHeight &&
              scenePoint.y < shape.y + innerHalfHeight

            return !withinInner
          }

          if (shape.kind === 'arrow') {
            const polygon = buildArrowPolygon(shape, ARROW_HIT_PADDING)
            return isPointInPolygon(scenePoint, polygon)
          }

          if (shape.kind === 'line') {
            const geometry = getLineGeometry(shape)
            const localPoint = toLocalCoordinates(
              scenePoint,
              { x: shape.x, y: shape.y },
              shape.angle ?? 0,
            )
            const padding = LINE_HIT_PADDING
            const halfLength = geometry.halfLength
            const halfThickness = geometry.halfThickness

            const withinLength =
              localPoint.x >= -halfLength - padding && localPoint.x <= halfLength + padding

            if (!withinLength) {
              return false
            }

            return Math.abs(localPoint.y) <= halfThickness + padding
          }

          return false
        })

      if (hitShape) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: hitShape.id })

        if (isLocked) {
          event.preventDefault()
          return
        }

        interactionRef.current = {
          mode: 'shape-move',
          pointerId: event.pointerId,
          shapeId: hitShape.id,
          offsetX: scenePoint.x - hitShape.x,
          offsetY: scenePoint.y - hitShape.y,
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
        return
      }

      if (event.button === 0 || event.button === 1) {
        interactionRef.current = {
          mode: 'pan',
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startOffsetX: viewRef.current.offsetX,
          startOffsetY: viewRef.current.offsetY,
          moved: false,
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current
      if (!interaction) {
        return
      }

      if (isLocked && interaction.mode !== 'pan') {
        return
      }

      if (interaction.mode === 'node') {
        const scenePoint = getScenePoint(event)

        dispatch({
          type: 'MOVE_NODE',
          nodeId: interaction.nodeId,
          x: scenePoint.x - interaction.offsetX,
          y: scenePoint.y - interaction.offsetY,
        })
        return
      }

      if (interaction.mode === 'annotation') {
        const scenePoint = getScenePoint(event)

        dispatch({
          type: 'MOVE_ANNOTATION',
          annotationId: interaction.annotationId,
          x: scenePoint.x - interaction.offsetX,
          y: scenePoint.y - interaction.offsetY,
        })
        return
      }

      if (interaction.mode === 'shape-move') {
        const scenePoint = getScenePoint(event)
        const shape = shapesRef.current.find((item) => item.id === interaction.shapeId)
        if (!shape) {
          return
        }

        const nextX = scenePoint.x - interaction.offsetX
        const nextY = scenePoint.y - interaction.offsetY

        if (Math.abs(nextX - shape.x) < 0.5 && Math.abs(nextY - shape.y) < 0.5) {
          return
        }

        dispatch({
          type: 'MOVE_SHAPE',
          shapeId: interaction.shapeId,
          x: nextX,
          y: nextY,
        })
        return
      }

      if (interaction.mode === 'shape-resize') {
        const scenePoint = getScenePoint(event)
        const shape = shapesRef.current.find((item) => item.id === interaction.shapeId)
        if (!shape) {
          return
        }

        if (shape.kind === 'ring') {
          const distance = Math.hypot(scenePoint.x - shape.x, scenePoint.y - shape.y)
          const minRadius = Math.max(RING_MIN_RADIUS, shape.thickness / 2 + 4)
          const nextRadius = Math.max(minRadius, distance)

          if (Math.abs(nextRadius - shape.radius) < 0.5) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: { radius: nextRadius },
          })
          return
        }

        if (shape.kind === 'ellipse') {
          const deltaX = Math.abs(scenePoint.x - shape.x)
          const deltaY = Math.abs(scenePoint.y - shape.y)
          const minRadiusX = Math.max(ELLIPSE_MIN_RADIUS_X, shape.thickness / 2 + 6)
          const minRadiusY = Math.max(ELLIPSE_MIN_RADIUS_Y, shape.thickness / 2 + 6)
          const nextRadiusX = Math.max(minRadiusX, deltaX)
          const nextRadiusY = Math.max(minRadiusY, deltaY)

          if (
            Math.abs(nextRadiusX - shape.radiusX) < 0.5 &&
            Math.abs(nextRadiusY - shape.radiusY) < 0.5
          ) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: { radiusX: nextRadiusX, radiusY: nextRadiusY },
          })
          return
        }

        if (shape.kind === 'rectangle') {
          const deltaX = Math.abs(scenePoint.x - shape.x)
          const deltaY = Math.abs(scenePoint.y - shape.y)
          const minHalfWidth = Math.max(RECTANGLE_MIN_WIDTH / 2, shape.thickness / 2 + 6)
          const minHalfHeight = Math.max(RECTANGLE_MIN_HEIGHT / 2, shape.thickness / 2 + 6)
          const nextHalfWidth = Math.max(minHalfWidth, deltaX)
          const nextHalfHeight = Math.max(minHalfHeight, deltaY)
          const nextWidth = nextHalfWidth * 2
          const nextHeight = nextHalfHeight * 2

          if (
            Math.abs(nextWidth - shape.width) < 0.5 &&
            Math.abs(nextHeight - shape.height) < 0.5
          ) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: { width: nextWidth, height: nextHeight },
          })
          return
        }

        if (shape.kind === 'arrow') {
          const dx = scenePoint.x - shape.x
          const dy = scenePoint.y - shape.y
          const distance = Math.hypot(dx, dy)
          if (distance < 0.5) {
            return
          }

          const nextAngle = Math.atan2(dy, dx)
          const localPoint = toLocalCoordinates(
            scenePoint,
            { x: shape.x, y: shape.y },
            nextAngle,
          )
          const minHalfWidth = ARROW_MIN_WIDTH / 2
          const minHalfHeight = ARROW_MIN_HEIGHT / 2
          const nextHalfWidth = Math.max(minHalfWidth, Math.abs(localPoint.x))
          const rawHalfHeight = Math.max(minHalfHeight, Math.abs(localPoint.y))
          const nextWidth = nextHalfWidth * 2
          const thicknessLimit = Math.min(shape.thickness, rawHalfHeight * 2)
          const nextThickness = Math.max(ARROW_MIN_THICKNESS, thicknessLimit)
          const halfThickness = Math.max(nextThickness / 2, ARROW_MIN_THICKNESS / 2)
          const { headHalfHeight } = enforceArrowHeadHeights(rawHalfHeight, halfThickness)
          const nextHeight = headHalfHeight * 2

          if (
            Math.abs(nextWidth - shape.width) < 0.5 &&
            Math.abs(nextHeight - shape.height) < 0.5 &&
            Math.abs(nextThickness - shape.thickness) < 0.5 &&
            Math.abs(nextAngle - (shape.angle ?? 0)) < 0.01
          ) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: {
              width: nextWidth,
              height: nextHeight,
              thickness: nextThickness,
              angle: nextAngle,
            },
          })
          return
        }

        if (shape.kind === 'line') {
          const dx = scenePoint.x - shape.x
          const dy = scenePoint.y - shape.y
          const distance = Math.hypot(dx, dy)
          if (distance < 0.25) {
            return
          }

          const nextAngle = Math.atan2(dy, dx)
          const localPoint = toLocalCoordinates(
            scenePoint,
            { x: shape.x, y: shape.y },
            nextAngle,
          )
          const nextHalfLength = Math.max(LINE_MIN_LENGTH / 2, Math.abs(localPoint.x))
          const nextLength = nextHalfLength * 2
          const nextThickness = Math.max(LINE_MIN_THICKNESS, Math.abs(localPoint.y) * 2)

          if (
            Math.abs(nextLength - shape.length) < 0.5 &&
            Math.abs(nextThickness - shape.thickness) < 0.5 &&
            Math.abs(nextAngle - (shape.angle ?? 0)) < 0.01
          ) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: {
              length: nextLength,
              thickness: nextThickness,
              angle: nextAngle,
            },
          })
          return
        }

        return
      }

      const deltaX = event.clientX - interaction.startClientX
      const deltaY = event.clientY - interaction.startClientY

      if (!interaction.moved && Math.hypot(deltaX, deltaY) > 2) {
        interaction.moved = true
      }

      setViewTransform((previous) => {
        hasAutoCenteredRef.current = true
        return {
          ...previous,
          offsetX: interaction.startOffsetX + deltaX,
          offsetY: interaction.startOffsetY + deltaY,
        }
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      finishInteraction(event.pointerId, true)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      finishInteraction(event.pointerId, false)
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { x, y } = getCanvasPoint(event)
      const zoomFactor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      adjustZoom(zoomFactor, { screenX: x, screenY: y })
    }

    const handleDoubleClick = (event: MouseEvent) => {
      const { x, y } = getCanvasPoint(event)
      const scenePoint = getScenePointFromCanvas(x, y)

      const hitNode = [...nodesRef.current]
        .reverse()
        .find((node) => Math.hypot(scenePoint.x - node.x, scenePoint.y - node.y) <= getNodeRadius(node))

      if (hitNode) {
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SET_SELECTED_NODES', nodeIds: [hitNode.id] })
        setTextDraft(hitNode.text)
        if (isLocked) {
          event.preventDefault()
          return
        }
        requestTextEditorFocus()
        event.preventDefault()
        return
      }

      const hitAnnotation = [...annotationsRef.current]
        .reverse()
        .find((annotation) => {
          const metrics = measureAnnotation(annotation)
          if (!metrics) {
            return false
          }

          const halfWidth = metrics.width / 2
          const halfHeight = metrics.height / 2

          return (
            scenePoint.x >= annotation.x - halfWidth &&
            scenePoint.x <= annotation.x + halfWidth &&
            scenePoint.y >= annotation.y - halfHeight &&
            scenePoint.y <= annotation.y + halfHeight
          )
        })

      if (hitAnnotation) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: hitAnnotation.id })
        setTextDraft(hitAnnotation.text)
        if (isLocked) {
          event.preventDefault()
          return
        }
        requestTextEditorFocus()
        event.preventDefault()
      }
    }

    window.addEventListener('resize', resizeCanvas)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerCancel)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('dblclick', handleDoubleClick)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerCancel)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [
    adjustZoom,
    dispatch,
    isLocked,
    getNodeRadius,
    measureAnnotation,
    requestTextEditorFocus,
    resizeCanvas,
  ])

  const handleAddChild = useCallback(() => {
    if (isLocked) {
      return
    }

    if (nodes.length === 0) {
      return
    }

    const rootNode = nodes.find((node) => node.parentId === null)
    const parent = selectedNode ?? rootNode ?? nodes[0]

    if (!parent) {
      return
    }

    const siblings = nodes.filter((node) => node.parentId === parent.id)
    const angle = (siblings.length * Math.PI) / 3
    const distance = LINK_DISTANCE + siblings.length * 10
    const nextX = parent.x + Math.cos(angle) * distance
    const nextY = parent.y + Math.sin(angle) * distance
    const paletteIndex = nodes.length % FALLBACK_COLORS.length
    const nodeColor = FALLBACK_COLORS[paletteIndex] ?? DEFAULT_NODE_COLOR

    const newNodeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `node-${Date.now()}-${Math.random().toString(16).slice(2)}`

    const defaultText = 'New Idea'

    dispatch({
      type: 'ADD_NODE',
      node: {
        id: newNodeId,
        parentId: parent.id,
        text: defaultText,
        x: nextX,
        y: nextY,
        color: nodeColor,
        textSize: 'medium',
      },
    })
    dispatch({ type: 'SET_SELECTED_NODES', nodeIds: [newNodeId] })
    setTextDraft(defaultText)
    requestTextEditorFocus()
  }, [dispatch, isLocked, nodes, requestTextEditorFocus, selectedNode])

  const handleAddStandaloneNode = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale
    const paletteIndex = nodes.length % FALLBACK_COLORS.length
    const nodeColor = FALLBACK_COLORS[paletteIndex] ?? DEFAULT_NODE_COLOR

    const newNodeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `node-${Date.now()}-${Math.random().toString(16).slice(2)}`

    const defaultText = 'New Idea'

    dispatch({
      type: 'ADD_NODE',
      node: {
        id: newNodeId,
        parentId: null,
        text: defaultText,
        x: worldCenterX,
        y: worldCenterY,
        color: nodeColor,
        textSize: 'medium',
      },
    })
    dispatch({ type: 'SET_SELECTED_NODES', nodeIds: [newNodeId] })
    setTextDraft(defaultText)
    requestTextEditorFocus()
  }, [dispatch, isLocked, nodes, requestTextEditorFocus])

  const handleAddAnnotation = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : (-offsetX) / scale
    const worldCenterY = height === 0 ? 0 : (-offsetY) / scale

    const newAnnotationId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_ANNOTATION',
      annotation: {
        id: newAnnotationId,
        text: 'New text',
        x: worldCenterX,
        y: worldCenterY,
        textSize: 'medium',
      },
    })
  }, [dispatch, isLocked])

  const handleAddRing = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'ring',
        x: worldCenterX,
        y: worldCenterY,
        radius: RING_DEFAULT_RADIUS,
        thickness: RING_DEFAULT_THICKNESS,
        color: RING_DEFAULT_COLOR,
      },
    })
  }, [dispatch, isLocked])

  const handleAddEllipse = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'ellipse',
        x: worldCenterX,
        y: worldCenterY,
        radiusX: ELLIPSE_DEFAULT_RADIUS_X,
        radiusY: ELLIPSE_DEFAULT_RADIUS_Y,
        thickness: ELLIPSE_DEFAULT_THICKNESS,
        color: ELLIPSE_DEFAULT_COLOR,
      },
    })
  }, [dispatch, isLocked])

  const handleAddRectangle = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'rectangle',
        x: worldCenterX,
        y: worldCenterY,
        width: RECTANGLE_DEFAULT_WIDTH,
        height: RECTANGLE_DEFAULT_HEIGHT,
        thickness: RECTANGLE_DEFAULT_THICKNESS,
        color: RECTANGLE_DEFAULT_COLOR,
      },
    })
  }, [dispatch, isLocked])

  const handleAddArrow = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'arrow',
        x: worldCenterX,
        y: worldCenterY,
        width: ARROW_DEFAULT_WIDTH,
        height: ARROW_DEFAULT_HEIGHT,
        thickness: ARROW_DEFAULT_THICKNESS,
        angle: ARROW_DEFAULT_ANGLE,
        color: ARROW_DEFAULT_COLOR,
      },
    })
  }, [dispatch, isLocked])

  const handleAddLine = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'line',
        x: worldCenterX,
        y: worldCenterY,
        length: LINE_DEFAULT_LENGTH,
        thickness: LINE_DEFAULT_THICKNESS,
        angle: LINE_DEFAULT_ANGLE,
        color: LINE_DEFAULT_COLOR,
      },
    })
  }, [dispatch, isLocked])

  const handleDeleteSelection = useCallback(() => {
    if (isLocked) {
      return
    }

    if (selectedShape) {
      dispatch({ type: 'DELETE_SHAPE', shapeId: selectedShape.id })
      return
    }

    if (selectedAnnotation) {
      dispatch({ type: 'DELETE_ANNOTATION', annotationId: selectedAnnotation.id })
      return
    }

    if (!primarySelectedNodeId || !selectedNode) {
      return
    }

    if (selectedNode.parentId === null && selectedNode.id === ROOT_NODE_ID) {
      return
    }

    dispatch({ type: 'DELETE_NODE', nodeId: primarySelectedNodeId })
  }, [dispatch, isLocked, primarySelectedNodeId, selectedAnnotation, selectedNode, selectedShape])

  const handleUndo = useCallback(() => {
    if (isLocked || past.length === 0) {
      return
    }
    dispatch({ type: 'UNDO' })
  }, [dispatch, isLocked, past])

  const handleRedo = useCallback(() => {
    if (isLocked || future.length === 0) {
      return
    }
    dispatch({ type: 'REDO' })
  }, [dispatch, future, isLocked])

  const isPristineState = useMemo(() => {
    if (annotations.length > 0) {
      return false
    }

    if (shapes.length > 0) {
      return false
    }

    if (nodes.length !== 1) {
      return false
    }

    const [rootNode] = nodes
    if (!rootNode) {
      return true
    }

    return (
      rootNode.id === ROOT_NODE_ID &&
      rootNode.parentId === null &&
      rootNode.text === 'Root' &&
      rootNode.x === 0 &&
      rootNode.y === 0 &&
      rootNode.color === DEFAULT_NODE_COLOR
    )
  }, [annotations, nodes, shapes])

  const canClear = !isPristineState

  const handleClearAll = useCallback(() => {
    if (isLocked || !canClear) {
      return
    }

    dispatch({ type: 'CLEAR_ALL' })
  }, [canClear, dispatch, isLocked])

  const panByPixels = useCallback((deltaX: number, deltaY: number) => {
    setViewTransform((previous) => {
      hasAutoCenteredRef.current = true
      return {
        ...previous,
        offsetX: previous.offsetX - deltaX,
        offsetY: previous.offsetY - deltaY,
      }
    })
  }, [])

  const handlePanUp = useCallback(() => {
    panByPixels(0, -KEYBOARD_PAN_STEP)
  }, [panByPixels])

  const handlePanDown = useCallback(() => {
    panByPixels(0, KEYBOARD_PAN_STEP)
  }, [panByPixels])

  const handlePanLeft = useCallback(() => {
    panByPixels(-KEYBOARD_PAN_STEP, 0)
  }, [panByPixels])

  const handlePanRight = useCallback(() => {
    panByPixels(KEYBOARD_PAN_STEP, 0)
  }, [panByPixels])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      const key = event.key.toLowerCase()
      const metaOrCtrl = event.metaKey || event.ctrlKey

      if (metaOrCtrl && !event.shiftKey && key === 'z') {
        event.preventDefault()
        handleUndo()
        return
      }

      if ((metaOrCtrl && (key === 'y' || (event.shiftKey && key === 'z')))) {
        event.preventDefault()
        handleRedo()
        return
      }

      if (key === 'arrowup') {
        event.preventDefault()
        handlePanUp()
        return
      }

      if (key === 'arrowdown') {
        event.preventDefault()
        handlePanDown()
        return
      }

      if (key === 'arrowleft') {
        event.preventDefault()
        handlePanLeft()
        return
      }

      if (key === 'arrowright') {
        event.preventDefault()
        handlePanRight()
        return
      }

      if (key === '+' || key === '=') {
        event.preventDefault()
        handleZoomIn()
        return
      }

      if (key === '-' || key === '_') {
        event.preventDefault()
        handleZoomOut()
        return
      }

      if (key === 'c') {
        event.preventDefault()
        handleResetView()
        return
      }

      if (key === 'enter') {
        event.preventDefault()
        handleAddChild()
        return
      }

      if (key === 'delete' || key === 'backspace') {
        event.preventDefault()
        handleDeleteSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleAddChild,
    handleDeleteSelection,
    handlePanDown,
    handlePanLeft,
    handlePanRight,
    handlePanUp,
    handleRedo,
    handleResetView,
    handleUndo,
    handleZoomIn,
    handleZoomOut,
  ])

  const handleExportJson = useCallback(() => {
    closeExportMenu()
    const payload = JSON.stringify(
      {
        nodes: nodes.map((node) => ({ ...node })),
        annotations: annotations.map((annotation) => ({ ...annotation })),
        shapes: shapes.map((shape) => ({ ...shape })),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    )

    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'mindmap.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [annotations, closeExportMenu, nodes, shapes])

  const handleExportPng = useCallback(() => {
    closeExportMenu()
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        return
      }

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'mindmap.png'
      anchor.click()
      URL.revokeObjectURL(url)
    })
  }, [closeExportMenu])

  const handleExportPdf = useCallback(() => {
    closeExportMenu()
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const { width, height } = canvas
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = width
    exportCanvas.height = height
    const context = exportCanvas.getContext('2d')
    if (!context) {
      return
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(canvas, 0, 0)

    const imageDataUrl = exportCanvas.toDataURL('image/jpeg', 0.92)
    const imageBytes = convertDataUrlToBytes(imageDataUrl)
    const pdfBytes = createPdfBytesFromJpeg(imageBytes, width, height)
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'mindmap.pdf'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [closeExportMenu])

  const sanitizeImportedNodes = useCallback((value: unknown) => {
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

    if (sanitized.length === 0) {
      return null
    }

    return sanitized
  }, [])

  const sanitizeImportedAnnotations = useCallback((value: unknown) => {
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
  }, [])

  const sanitizeImportedShapes = useCallback((value: unknown) => {
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
        const maxThickness = Math.min(radiusX, radiusY)

        accumulator.push({
          id: ellipse.id,
          kind: 'ellipse',
          x: ellipse.x,
          y: ellipse.y,
          radiusX,
          radiusY,
          thickness: Math.min(thickness, maxThickness),
          color,
        })
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
        const maxThickness = Math.min(width, height) / 2

        accumulator.push({
          id: rectangle.id,
          kind: 'rectangle',
          x: rectangle.x,
          y: rectangle.y,
          width,
          height,
          thickness: Math.min(thickness, maxThickness),
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
        const color = typeof arrow.color === 'string' ? arrow.color : ARROW_DEFAULT_COLOR
        const angle = typeof arrow.angle === 'number' && Number.isFinite(arrow.angle) ? arrow.angle : 0
        const halfThickness = Math.max(thickness / 2, ARROW_MIN_THICKNESS / 2)
        const { headHalfHeight } = enforceArrowHeadHeights(rawHeight / 2, halfThickness)
        const height = headHalfHeight * 2
        const normalizedThickness = Math.max(ARROW_MIN_THICKNESS, Math.min(thickness, height))

        accumulator.push({
          id: arrow.id,
          kind: 'arrow',
          x: arrow.x,
          y: arrow.y,
          width,
          height,
          thickness: normalizedThickness,
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

        const length = Math.max(LINE_MIN_LENGTH, Math.abs(line.length))
        const thickness = Math.max(LINE_MIN_THICKNESS, Math.abs(line.thickness))
        const color = typeof line.color === 'string' ? line.color : LINE_DEFAULT_COLOR
        const angle = typeof line.angle === 'number' && Number.isFinite(line.angle) ? line.angle : 0

        accumulator.push({
          id: line.id,
          kind: 'line',
          x: line.x,
          y: line.y,
          length,
          thickness,
          color,
          angle,
        })
        return accumulator
      }

      return accumulator
    }, [])
  }, [])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (isLocked) {
        event.target.value = ''
        return
      }

      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as {
            nodes?: unknown
            annotations?: unknown
            shapes?: unknown
          }
          const importedNodes = sanitizeImportedNodes(parsed.nodes)
          const importedAnnotations = sanitizeImportedAnnotations(parsed.annotations)
          const importedShapes = sanitizeImportedShapes(parsed.shapes)

          if (!importedNodes) {
            window.alert('Unable to import file. Please choose a valid Mindmapper JSON export.')
            return
          }

          dispatch({
            type: 'IMPORT',
            nodes: importedNodes,
            annotations: importedAnnotations,
            shapes: importedShapes,
          })
        } catch (error) {
          console.error('Failed to import mind map', error)
          window.alert('Unable to import file. Please choose a valid Mindmapper JSON export.')
        }
      }
      reader.readAsText(file)
      event.target.value = ''
    },
    [
      dispatch,
      isLocked,
      sanitizeImportedAnnotations,
      sanitizeImportedNodes,
      sanitizeImportedShapes,
    ],
  )

  const handleImportJson = useCallback(() => {
    if (isLocked) {
      return
    }

    closeExportMenu()
    fileInputRef.current?.click()
  }, [closeExportMenu, isLocked])

  const canDeleteNode = Boolean(
    selectedNode && !(selectedNode.parentId === null && selectedNode.id === ROOT_NODE_ID),
  )
  const canDeleteAnnotation = Boolean(selectedAnnotation)
  const canDeleteShape = Boolean(selectedShape)
  const canDelete = canDeleteNode || canDeleteAnnotation || canDeleteShape
  const canUndo = past.length > 0
  const canRedo = future.length > 0
  const canZoomIn = viewTransform.scale < MAX_ZOOM - 0.001
  const canZoomOut = viewTransform.scale > MIN_ZOOM + 0.001
  const zoomPercentage = Math.round(viewTransform.scale * 100)

  const handleTextChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setTextDraft(value)

      if (isLocked || !selectedTextTarget) {
        return
      }

      if (selectedTextTarget.kind === 'node') {
        dispatch({
          type: 'UPDATE_NODE',
          nodeId: selectedTextTarget.id,
          updates: { text: value },
        })
        return
      }

      dispatch({
        type: 'UPDATE_ANNOTATION',
        annotationId: selectedTextTarget.id,
        updates: { text: value },
      })
    },
    [dispatch, isLocked, selectedTextTarget],
  )

  const handleTextSizeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (isLocked || !selectedTextTarget) {
        return
      }

      const nextSize = normalizeTextSize(event.target.value)

      if (selectedTextTarget.kind === 'node') {
        dispatch({
          type: 'UPDATE_NODE',
          nodeId: selectedTextTarget.id,
          updates: { textSize: nextSize },
        })
        return
      }

      dispatch({
        type: 'UPDATE_ANNOTATION',
        annotationId: selectedTextTarget.id,
        updates: { textSize: nextSize },
      })
    },
    [dispatch, isLocked, selectedTextTarget],
  )

  const handleNodeColorChange = useCallback(
    (nextColor: string) => {
      if (isLocked || !selectedNode) {
        return
      }

      if (selectedNode.color === nextColor) {
        return
      }

      dispatch({
        type: 'UPDATE_NODE',
        nodeId: selectedNode.id,
        updates: { color: nextColor },
      })
    },
    [dispatch, isLocked, selectedNode],
  )

  const toolbarBodyId = 'mindmap-toolbar-body'
  const toolbarClassName = `mindmap-toolbar${isToolbarCollapsed ? ' mindmap-toolbar--collapsed' : ''}`
  const appShellClassName = `app-shell app-shell--${backgroundTheme}`
  const isEditingNode = selectedTextTarget?.kind === 'node'
  const isEditingAnnotation = selectedTextTarget?.kind === 'annotation'
  const textEditorLabel = isEditingNode ? 'Node text' : isEditingAnnotation ? 'Text box text' : 'Edit text'
  const isTextEditingDisabled = isLocked || !selectedTextTarget
  const textEditorPlaceholder = isLocked
    ? 'Unlock editing to type'
    : isEditingNode
    ? 'Type here to rename the node'
    : isEditingAnnotation
    ? 'Type here to update the text box'
    : 'Select a node or text box first'
  const textInputAriaLabel = isLocked
    ? 'Text editing is locked'
    : isEditingNode
    ? 'Selected node text'
    : isEditingAnnotation
    ? 'Selected text box text'
    : 'Edit text'
  const textSizeAriaLabel = isLocked
    ? 'Text size selection is locked'
    : isEditingNode
    ? 'Selected node text size'
    : isEditingAnnotation
    ? 'Selected text box size'
    : 'Text size'
  const isNodeColorDisabled = isLocked || !selectedNode
  const lockButtonLabel = isLocked ? 'Unlock edits' : 'Lock edits'
  const lockButtonTitle = isLocked
    ? 'Switch back to editing mode'
    : 'Lock editing so you can explore safely'
  const lockButtonIcon = isLocked ? '🔒' : '🔓'
  const isDarkBackground = backgroundTheme === 'dark'
  const backgroundButtonLabel = isDarkBackground ? 'Dark background' : 'Light background'
  const backgroundButtonIcon = isDarkBackground ? '🌙' : '☀️'
  const backgroundButtonTitle = isDarkBackground
    ? 'Switch to a bright background'
    : 'Switch to a deep background'

  return (
    <div className={appShellClassName}>
      <canvas ref={canvasRef} className="mindmap-canvas" />
      <div className={toolbarClassName}>
        <div className="mindmap-toolbar__header">
          <button
            type="button"
            onClick={toggleToolbarCollapsed}
            className="mindmap-toolbar__toggle"
            aria-expanded={!isToolbarCollapsed}
            aria-controls={toolbarBodyId}
            aria-label="Toggle toolbar visibility"
            title={isToolbarCollapsed ? 'Show toolbar controls' : 'Hide toolbar controls'}
          >
            {isToolbarCollapsed ? '▾' : '▴'}
          </button>
          <div className="mindmap-toolbar__header-actions">
            <button
              type="button"
              onClick={handleAddStandaloneNode}
              title="Add a new idea that starts disconnected"
              disabled={isLocked}
            >
              Add idea
            </button>
            <button type="button" onClick={handleAddChild} title="Enter" disabled={isLocked}>
              Add child
            </button>
            <button
              type="button"
              onClick={handleAddAnnotation}
              title="Add a floating text box"
              disabled={isLocked}
            >
              Textbox
            </button>
            <button
              type="button"
              onClick={handleAddRing}
              title="Add a ring to group related ideas"
              aria-label="Add ring"
              className="mindmap-toolbar__icon-button"
              disabled={isLocked}
            >
              <svg viewBox="0 0 24 24" className="mindmap-toolbar__icon" aria-hidden="true">
                <circle cx="12" cy="12" r="8" stroke="#38bdf8" strokeWidth="3" fill="none" />
              </svg>
              <span className="visually-hidden">Ring</span>
            </button>
            <button
              type="button"
              onClick={handleAddEllipse}
              title="Add an ellipse to spotlight a region"
              aria-label="Add ellipse"
              className="mindmap-toolbar__icon-button"
              disabled={isLocked}
            >
              <svg viewBox="0 0 24 24" className="mindmap-toolbar__icon" aria-hidden="true">
                <ellipse cx="12" cy="12" rx="8" ry="5.5" stroke="#a855f7" strokeWidth="3" fill="none" />
              </svg>
              <span className="visually-hidden">Ellipse</span>
            </button>
            <button
              type="button"
              onClick={handleAddRectangle}
              title="Add a rectangle to frame ideas"
              aria-label="Add rectangle"
              className="mindmap-toolbar__icon-button"
              disabled={isLocked}
            >
              <svg viewBox="0 0 24 24" className="mindmap-toolbar__icon" aria-hidden="true">
                <rect
                  x="5"
                  y="6"
                  width="14"
                  height="12"
                  rx="2"
                  stroke="#34d399"
                  strokeWidth="3"
                  fill="none"
                />
              </svg>
              <span className="visually-hidden">Rectangle</span>
            </button>
            <button
              type="button"
              onClick={handleAddArrow}
              title="Add an arrow to highlight a flow"
              aria-label="Add arrow"
              className="mindmap-toolbar__icon-button"
              disabled={isLocked}
            >
              <svg viewBox="0 0 24 24" className="mindmap-toolbar__icon" aria-hidden="true">
                <path d="M4.5 11h8V7.2L20 12l-7.5 4.8V13h-8z" fill="#f97316" />
              </svg>
              <span className="visually-hidden">Arrow</span>
            </button>
            <button
              type="button"
              onClick={handleAddLine}
              title="Add a straight line connector"
              aria-label="Add line"
              className="mindmap-toolbar__icon-button"
              disabled={isLocked}
            >
              <svg viewBox="0 0 24 24" className="mindmap-toolbar__icon" aria-hidden="true">
                <line
                  x1="5"
                  y1="18"
                  x2="19"
                  y2="6"
                  stroke="#22d3ee"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="visually-hidden">Line</span>
            </button>
          </div>
        </div>
        {!isToolbarCollapsed ? (
          <div className="mindmap-toolbar__body" id={toolbarBodyId}>
            <div className="mindmap-toolbar__row mindmap-toolbar__row--editors">
              <div className="mindmap-toolbar__text-editor">
                <label className="mindmap-toolbar__text-control">
                  <span className="mindmap-toolbar__text-label">{textEditorLabel}</span>
                  <input
                    type="text"
                    value={textDraft}
                    onChange={handleTextChange}
                    placeholder={textEditorPlaceholder}
                    disabled={isTextEditingDisabled}
                    aria-label={textInputAriaLabel}
                    className="mindmap-toolbar__text-input"
                    ref={textInputRef}
                    title={isLocked ? 'Unlock edits to change text' : undefined}
                  />
                </label>
                <label className="mindmap-toolbar__text-control">
                  <span className="mindmap-toolbar__text-label">Text size</span>
                  <select
                    value={selectedTextSize}
                    onChange={handleTextSizeChange}
                    disabled={isTextEditingDisabled}
                    aria-label={textSizeAriaLabel}
                    className="mindmap-toolbar__text-select"
                    title={isLocked ? 'Unlock edits to change text size' : undefined}
                  >
                    {TEXT_SIZE_CHOICES.map((size) => (
                      <option key={size} value={size}>
                        {TEXT_SIZE_LABELS[size]}
                      </option>
                    ))}
                  </select>
                </label>
                {isEditingNode ? (
                  <div className="mindmap-toolbar__text-control mindmap-toolbar__color-control">
                    <span className="mindmap-toolbar__text-label">Node color</span>
                    <div className="mindmap-toolbar__color-options" role="group" aria-label="Node color">
                      {NODE_COLOR_OPTIONS.map((option) => {
                        const isSelectedColor = selectedNodeColor === option.value
                        const swatchClassName = `mindmap-toolbar__color-swatch${
                          isSelectedColor ? ' mindmap-toolbar__color-swatch--selected' : ''
                        }`
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={swatchClassName}
                            style={{ backgroundColor: option.value }}
                            onClick={() => handleNodeColorChange(option.value)}
                            aria-pressed={isSelectedColor}
                            aria-label={`Set node color to ${option.label}`}
                            title={
                              isNodeColorDisabled
                                ? 'Unlock edits to change color'
                                : `Set node color to ${option.label}`
                            }
                            disabled={isNodeColorDisabled}
                          >
                            <span className="visually-hidden">
                              {isSelectedColor ? `${option.label} selected` : `Use ${option.label}`}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mindmap-io-panel">
        <button
          type="button"
          onClick={handleImportJson}
          title="Load from JSON file"
          className="mindmap-toolbar__io-button"
          disabled={isLocked}
        >
          Import
        </button>
        <div className="mindmap-io-panel__export" ref={exportMenuRef}>
          <button
            type="button"
            onClick={toggleExportMenu}
            className="mindmap-toolbar__io-button"
            aria-expanded={isExportMenuOpen}
            aria-haspopup="true"
            title="Download a copy of your map"
          >
            Export
          </button>
          {isExportMenuOpen ? (
            <div className="mindmap-io-panel__export-menu" role="menu">
              <button type="button" onClick={handleExportJson} role="menuitem">
                Export JSON
              </button>
              <button type="button" onClick={handleExportPng} role="menuitem">
                Export PNG
              </button>
              <button type="button" onClick={handleExportPdf} role="menuitem">
                Export PDF
              </button>
            </div>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
      <div className="mindmap-actions" role="group" aria-label="Edit commands">
        <div className="mindmap-actions__row">
          <button
            type="button"
            onClick={toggleLock}
            aria-pressed={isLocked}
            title={lockButtonTitle}
          >
            <span aria-hidden="true" className="mindmap-actions__icon">{lockButtonIcon}</span>
            <span className="visually-hidden">{lockButtonLabel}</span>
          </button>
          <button
            type="button"
            onClick={toggleBackgroundTheme}
            aria-pressed={isDarkBackground}
            aria-label={backgroundButtonTitle}
            title={backgroundButtonTitle}
          >
            <span aria-hidden="true" className="mindmap-actions__icon">{backgroundButtonIcon}</span>
            <span className="visually-hidden">{backgroundButtonLabel}</span>
          </button>
        </div>
        <div className="mindmap-actions__row">
          <button
            type="button"
            onClick={handleDeleteSelection}
            disabled={isLocked || !canDelete}
            title="Delete or Backspace"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={isLocked || !canClear}
            title="Reset the canvas to a fresh root node"
          >
            Clear
          </button>
        </div>
        <div className="mindmap-actions__row">
          <button
            type="button"
            onClick={handleUndo}
            disabled={isLocked || !canUndo}
            title="Ctrl/Cmd + Z"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={isLocked || !canRedo}
            title="Ctrl/Cmd + Y or Shift + Ctrl/Cmd + Z"
          >
            Redo
          </button>
        </div>
      </div>
      <div className="mindmap-navigation" role="group" aria-label="Viewport navigation controls">
        <div className="mindmap-navigation__dpad">
          <div className="mindmap-navigation__spacer" aria-hidden="true" />
          <button type="button" onClick={handlePanUp} aria-label="Pan up" title="Pan up (Arrow Up)">
            ↑
          </button>
          <div className="mindmap-navigation__spacer" aria-hidden="true" />
          <button type="button" onClick={handlePanLeft} aria-label="Pan left" title="Pan left (Arrow Left)">
            ←
          </button>
          <button
            type="button"
            onClick={handleResetView}
            aria-label="Center view"
            title="Center view (C)"
            className="mindmap-navigation__center"
          >
            ⦿
          </button>
          <button type="button" onClick={handlePanRight} aria-label="Pan right" title="Pan right (Arrow Right)">
            →
          </button>
          <div className="mindmap-navigation__spacer" aria-hidden="true" />
          <button type="button" onClick={handlePanDown} aria-label="Pan down" title="Pan down (Arrow Down)">
            ↓
          </button>
          <div className="mindmap-navigation__spacer" aria-hidden="true" />
        </div>
        <div className="mindmap-navigation__zoom" aria-live="polite">
          <button type="button" onClick={handleZoomOut} disabled={!canZoomOut} title="Zoom out (-)">
            −
          </button>
          <span>{zoomPercentage}%</span>
          <button type="button" onClick={handleZoomIn} disabled={!canZoomIn} title="Zoom in (+)">
            +
          </button>
        </div>
      </div>
    </div>
  )
}
