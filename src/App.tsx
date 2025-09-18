import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  TEXT_SIZE_CHOICES,
  normalizeTextSize,
  type MindMapAnnotation,
  type MindMapEllipse,
  type MindMapArrow,
  type MindMapNode,
  type MindMapRectangle,
  type MindMapShape,
  type TextSize,
  useMindMap,
} from './state/MindMapContext'
import './App.css'

const NODE_BASE_RADIUS = 40
const NODE_TEXT_PADDING = 18
const NODE_FONT_SIZES: Record<TextSize, number> = {
  small: 12,
  medium: 20,
  large: 30,
}
const LINK_DISTANCE = 160
const FALLBACK_COLORS = ['#22d3ee', '#a855f7', '#10b981', '#f97316', '#facc15']
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
const ARROW_MIN_WIDTH = 160
const ARROW_MIN_HEIGHT = 90
const ARROW_DEFAULT_THICKNESS = 60
const ARROW_HIT_PADDING = 10
const ARROW_DEFAULT_COLOR = '#f97316'
const ARROW_HEAD_RATIO = 0.34
const ARROW_SHAFT_RATIO = 0.42
const ARROW_MIN_HEAD_LENGTH = 30

type Point = { x: number; y: number }

type ArrowGeometry = {
  halfWidth: number
  halfHeight: number
  headLength: number
  shaftHalfHeight: number
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

const getArrowGeometry = (shape: MindMapArrow): ArrowGeometry => {
  const halfWidth = Math.max(shape.width / 2, ARROW_MIN_WIDTH / 2)
  const halfHeight = Math.max(shape.height / 2, ARROW_MIN_HEIGHT / 2)
  const baseHeadLength = Math.max(halfWidth * ARROW_HEAD_RATIO, ARROW_MIN_HEAD_LENGTH)
  const headLength = Math.min(baseHeadLength, halfWidth)
  const baseShaftHalf = Math.max(shape.thickness / 2, halfHeight * ARROW_SHAFT_RATIO)
  const shaftHalfHeight = Math.min(baseShaftHalf, Math.max(halfHeight - 6, halfHeight * 0.9))

  return {
    halfWidth,
    halfHeight,
    headLength,
    shaftHalfHeight: Math.max(6, Math.min(shaftHalfHeight, halfHeight)),
  }
}

const buildArrowPolygon = (shape: MindMapArrow, extraPadding = 0): Point[] => {
  const { halfWidth, halfHeight, headLength, shaftHalfHeight } = getArrowGeometry(shape)
  const paddedHalfWidth = halfWidth + extraPadding
  const paddedHalfHeight = halfHeight + extraPadding
  const paddedHeadLength = Math.min(headLength + extraPadding, paddedHalfWidth)
  const paddedShaftHalfHeight = Math.min(
    Math.max(shaftHalfHeight + extraPadding, 4),
    paddedHalfHeight - 2,
  )
  const leftX = shape.x - paddedHalfWidth
  const headStartX = shape.x + paddedHalfWidth - paddedHeadLength
  const tipX = shape.x + paddedHalfWidth

  return [
    { x: leftX, y: shape.y - paddedShaftHalfHeight },
    { x: headStartX, y: shape.y - paddedShaftHalfHeight },
    { x: headStartX, y: shape.y - paddedHalfHeight },
    { x: tipX, y: shape.y },
    { x: headStartX, y: shape.y + paddedHalfHeight },
    { x: headStartX, y: shape.y + paddedShaftHalfHeight },
    { x: leftX, y: shape.y + paddedShaftHalfHeight },
  ]
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
const getAnnotationFont = (size: TextSize) => `${ANNOTATION_FONT_SIZES[size]}px ${ANNOTATION_FONT_FAMILY}`
const getAnnotationLineHeight = (size: TextSize) => ANNOTATION_LINE_HEIGHTS[size]

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
    state: { nodes, annotations, shapes, selectedNodeId, selectedAnnotationId, selectedShapeId, history },
    dispatch,
  } = useMindMap()

  const { past, future } = history

  const nodesRef = useRef(nodes)
  const annotationsRef = useRef(annotations)
  const selectedNodeRef = useRef(selectedNodeId)
  const selectedAnnotationRef = useRef(selectedAnnotationId)
  const shapesRef = useRef(shapes)
  const selectedShapeRef = useRef(selectedShapeId)

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId],
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

  const getNodeRadius = useCallback(
    (node: MindMapNode) => {
      const context = contextRef.current
      if (!context) {
        return NODE_BASE_RADIUS
      }

      const previousFont = context.font
      const textSize = normalizeTextSize(node.textSize)
      context.font = getNodeFont(textSize)
      const label = node.text.length > 0 ? node.text : 'New Idea'
      const metrics = context.measureText(label)
      context.font = previousFont

      const radius = Math.max(NODE_BASE_RADIUS, metrics.width / 2 + NODE_TEXT_PADDING)
      return radius
    },
    [],
  )

  const focusInput = useCallback((input: HTMLInputElement | null) => {
    if (!input) {
      return
    }

    requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  }, [])

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
    const selectedId = selectedNodeRef.current
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
          const handleX = shape.x + geometry.halfWidth
          const handleY = shape.y + geometry.halfHeight
          context.fillStyle = '#facc15'
          context.fillRect(handleX - handleHalf, handleY - handleHalf, handleSize, handleSize)
          context.lineWidth = Math.max(1.5 / scale, 1 / scale)
          context.strokeStyle = '#0f172a'
          context.strokeRect(handleX - handleHalf, handleY - handleHalf, handleSize, handleSize)
        }

        context.restore()
        return
      }

      context.restore()
    })

    context.lineWidth = 2
    context.strokeStyle = 'rgba(148, 163, 184, 0.5)'

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
      const radius = getNodeRadius(node)

      context.fillStyle = node.color || '#4f46e5'
      context.beginPath()
      context.arc(nodeX, nodeY, radius, 0, Math.PI * 2)
      context.fill()

      if (node.id === selectedId) {
        context.lineWidth = 4
        context.strokeStyle = '#f97316'
        context.stroke()
        context.lineWidth = 2
        context.strokeStyle = 'rgba(148, 163, 184, 0.5)'
      }

      context.fillStyle = '#ffffff'
      const previousFont = context.font
      const nodeTextSize = normalizeTextSize(node.textSize)
      context.font = getNodeFont(nodeTextSize)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(node.text, nodeX, nodeY)
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
  }, [getNodeRadius, measureAnnotation])

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
    selectedNodeRef.current = selectedNodeId
    selectedAnnotationRef.current = selectedAnnotationId
    shapesRef.current = shapes
    selectedShapeRef.current = selectedShapeId
    drawScene()
  }, [annotations, nodes, selectedAnnotationId, selectedNodeId, selectedShapeId, shapes, drawScene])

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
        dispatch({ type: 'SELECT_NODE', nodeId: null })
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
            const handleX = shape.x + geometry.halfWidth
            const handleY = shape.y + geometry.halfHeight

            return (
              scenePoint.x >= handleX - handleHalfSize &&
              scenePoint.x <= handleX + handleHalfSize &&
              scenePoint.y >= handleY - handleHalfSize &&
              scenePoint.y <= handleY + handleHalfSize
            )
          }

          return false
        })

      if (hitResizeShape) {
        interactionRef.current = {
          mode: 'shape-resize',
          pointerId: event.pointerId,
          shapeId: hitResizeShape.id,
        }

        dispatch({ type: 'SELECT_NODE', nodeId: null })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: hitResizeShape.id })
        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
        return
      }

      const hitNode = [...nodesRef.current]
        .reverse()
        .find((node) => Math.hypot(scenePoint.x - node.x, scenePoint.y - node.y) <= getNodeRadius(node))

      if (hitNode) {
        interactionRef.current = {
          mode: 'node',
          pointerId: event.pointerId,
          nodeId: hitNode.id,
          offsetX: scenePoint.x - hitNode.x,
          offsetY: scenePoint.y - hitNode.y,
        }

        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SELECT_NODE', nodeId: hitNode.id })
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
        interactionRef.current = {
          mode: 'annotation',
          pointerId: event.pointerId,
          annotationId: hitAnnotation.id,
          offsetX: scenePoint.x - hitAnnotation.x,
          offsetY: scenePoint.y - hitAnnotation.y,
        }

        dispatch({ type: 'SELECT_NODE', nodeId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: hitAnnotation.id })
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

          return false
        })

      if (hitShape) {
        interactionRef.current = {
          mode: 'shape-move',
          pointerId: event.pointerId,
          shapeId: hitShape.id,
          offsetX: scenePoint.x - hitShape.x,
          offsetY: scenePoint.y - hitShape.y,
        }

        dispatch({ type: 'SELECT_NODE', nodeId: null })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: hitShape.id })
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
          const deltaX = Math.abs(scenePoint.x - shape.x)
          const deltaY = Math.abs(scenePoint.y - shape.y)
          const minHalfWidth = ARROW_MIN_WIDTH / 2
          const minHalfHeight = ARROW_MIN_HEIGHT / 2
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

          const maxThickness = Math.max(4, nextHeight - 12)
          const nextThickness = Math.min(shape.thickness, maxThickness)

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: { width: nextWidth, height: nextHeight, thickness: nextThickness },
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

    const requestToolbarForEditing = () => {
      if (isToolbarCollapsed) {
        pendingTextFocusRef.current = true
        setToolbarCollapsed(false)
        return
      }

      pendingTextFocusRef.current = false
      focusInput(textInputRef.current)
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
        dispatch({ type: 'SELECT_NODE', nodeId: hitNode.id })
        setTextDraft(hitNode.text)
        requestToolbarForEditing()
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
        dispatch({ type: 'SELECT_NODE', nodeId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: hitAnnotation.id })
        setTextDraft(hitAnnotation.text)
        requestToolbarForEditing()
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
    focusInput,
    getNodeRadius,
    isToolbarCollapsed,
    measureAnnotation,
    resizeCanvas,
    setToolbarCollapsed,
  ])

  const handleAddChild = useCallback(() => {
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
    const nodeColor = FALLBACK_COLORS[paletteIndex]

    const newNodeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `node-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_NODE',
      node: {
        id: newNodeId,
        parentId: parent.id,
        text: 'New Idea',
        x: nextX,
        y: nextY,
        color: nodeColor,
        textSize: 'medium',
      },
    })
  }, [dispatch, nodes, selectedNode])

  const handleAddAnnotation = useCallback(() => {
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
  }, [dispatch])

  const handleAddRing = useCallback(() => {
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
  }, [dispatch])

  const handleAddEllipse = useCallback(() => {
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
  }, [dispatch])

  const handleAddRectangle = useCallback(() => {
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
  }, [dispatch])

  const handleAddArrow = useCallback(() => {
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
        color: ARROW_DEFAULT_COLOR,
      },
    })
  }, [dispatch])

  const handleDeleteSelection = useCallback(() => {
    if (selectedShape) {
      dispatch({ type: 'DELETE_SHAPE', shapeId: selectedShape.id })
      return
    }

    if (selectedAnnotation) {
      dispatch({ type: 'DELETE_ANNOTATION', annotationId: selectedAnnotation.id })
      return
    }

    if (!selectedNodeId || !selectedNode) {
      return
    }

    if (selectedNode.parentId === null) {
      return
    }

    dispatch({ type: 'DELETE_NODE', nodeId: selectedNodeId })
  }, [dispatch, selectedAnnotation, selectedNode, selectedNodeId, selectedShape])

  const handleUndo = useCallback(() => {
    if (past.length === 0) {
      return
    }
    dispatch({ type: 'UNDO' })
  }, [dispatch, past])

  const handleRedo = useCallback(() => {
    if (future.length === 0) {
      return
    }
    dispatch({ type: 'REDO' })
  }, [dispatch, future])

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
      rootNode.id === 'root' &&
      rootNode.parentId === null &&
      rootNode.text === 'Root' &&
      rootNode.x === 0 &&
      rootNode.y === 0 &&
      rootNode.color === '#4f46e5'
    )
  }, [annotations, nodes, shapes])

  const canClear = !isPristineState

  const handleClearAll = useCallback(() => {
    if (!canClear) {
      return
    }

    dispatch({ type: 'CLEAR_ALL' })
  }, [canClear, dispatch])

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
        color: typeof node.color === 'string' ? node.color : '#4f46e5',
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
        const height = Math.max(ARROW_MIN_HEIGHT, Math.abs(arrow.height))
        const thickness = Math.max(4, Math.abs(arrow.thickness))
        const color = typeof arrow.color === 'string' ? arrow.color : ARROW_DEFAULT_COLOR
        const maxThickness = Math.max(4, height - 12)

        accumulator.push({
          id: arrow.id,
          kind: 'arrow',
          x: arrow.x,
          y: arrow.y,
          width,
          height,
          thickness: Math.min(thickness, maxThickness),
          color,
        })
        return accumulator
      }

      return accumulator
    }, [])
  }, [])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
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
    [dispatch, sanitizeImportedAnnotations, sanitizeImportedNodes, sanitizeImportedShapes],
  )

  const handleImportJson = useCallback(() => {
    closeExportMenu()
    fileInputRef.current?.click()
  }, [closeExportMenu])

  const canDeleteNode = Boolean(selectedNode && selectedNode.parentId !== null)
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

      if (!selectedTextTarget) {
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
    [dispatch, selectedTextTarget],
  )

  const handleTextSizeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (!selectedTextTarget) {
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
    [dispatch, selectedTextTarget],
  )

  const toolbarBodyId = 'mindmap-toolbar-body'
  const toolbarClassName = `mindmap-toolbar${isToolbarCollapsed ? ' mindmap-toolbar--collapsed' : ''}`
  const isEditingNode = selectedTextTarget?.kind === 'node'
  const isEditingAnnotation = selectedTextTarget?.kind === 'annotation'
  const textEditorLabel = isEditingNode ? 'Node text' : isEditingAnnotation ? 'Text box text' : 'Edit text'
  const textEditorPlaceholder = isEditingNode
    ? 'Type here to rename the node'
    : isEditingAnnotation
    ? 'Type here to update the text box'
    : 'Select a node or text box first'
  const textInputAriaLabel = isEditingNode
    ? 'Selected node text'
    : isEditingAnnotation
    ? 'Selected text box text'
    : 'Edit text'
  const textSizeAriaLabel = isEditingNode
    ? 'Selected node text size'
    : isEditingAnnotation
    ? 'Selected text box size'
    : 'Text size'

  return (
    <div className="app-shell">
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
            <button type="button" onClick={handleAddChild} title="Enter">
              Add child
            </button>
            <button type="button" onClick={handleAddAnnotation} title="Add a floating text box">
              Textbox
            </button>
            <button
              type="button"
              onClick={handleAddRing}
              title="Add a ring to group related ideas"
              aria-label="Add ring"
              className="mindmap-toolbar__icon-button"
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
            >
              <svg viewBox="0 0 24 24" className="mindmap-toolbar__icon" aria-hidden="true">
                <path
                  d="M5 9.5h7l-2.2-2.4 1.6-1.6 5.8 6-5.8 6-1.6-1.6 2.2-2.4H5z"
                  fill="#f97316"
                />
              </svg>
              <span className="visually-hidden">Arrow</span>
            </button>
          </div>
        </div>
        {!isToolbarCollapsed ? (
          <div className="mindmap-toolbar__body" id={toolbarBodyId}>
            <div className="mindmap-toolbar__shape-panel">
              <span className="mindmap-toolbar__section-title">Shapes</span>
            </div>
            <div className="mindmap-toolbar__row mindmap-toolbar__row--editors">
              <div className="mindmap-toolbar__text-editor">
                <label className="mindmap-toolbar__text-control">
                  <span className="mindmap-toolbar__text-label">{textEditorLabel}</span>
                  <input
                    type="text"
                    value={textDraft}
                    onChange={handleTextChange}
                    placeholder={textEditorPlaceholder}
                    disabled={!selectedTextTarget}
                    aria-label={textInputAriaLabel}
                    className="mindmap-toolbar__text-input"
                    ref={textInputRef}
                  />
                </label>
                <label className="mindmap-toolbar__text-control">
                  <span className="mindmap-toolbar__text-label">Text size</span>
                  <select
                    value={selectedTextSize}
                    onChange={handleTextSizeChange}
                    disabled={!selectedTextTarget}
                    aria-label={textSizeAriaLabel}
                    className="mindmap-toolbar__text-select"
                  >
                    {TEXT_SIZE_CHOICES.map((size) => (
                      <option key={size} value={size}>
                        {TEXT_SIZE_LABELS[size]}
                      </option>
                    ))}
                  </select>
                </label>
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
              <button type="button" disabled role="menuitem" title="PDF export is coming soon">
                Export PDF (coming soon)
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
            onClick={handleDeleteSelection}
            disabled={!canDelete}
            title="Delete or Backspace"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={!canClear}
            title="Reset the canvas to a fresh root node"
          >
            Clear
          </button>
        </div>
        <div className="mindmap-actions__row">
          <button type="button" onClick={handleUndo} disabled={!canUndo} title="Ctrl/Cmd + Z">
            Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
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
