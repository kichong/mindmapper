import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { type MindMapAnnotation, type MindMapNode, useMindMap } from './state/MindMapContext'
import './App.css'

const NODE_BASE_RADIUS = 40
const NODE_TEXT_PADDING = 18
const NODE_FONT = '16px Inter, system-ui, sans-serif'
const LINK_DISTANCE = 160
const FALLBACK_COLORS = ['#22d3ee', '#a855f7', '#10b981', '#f97316', '#facc15']
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 1.2
const KEYBOARD_PAN_STEP = 80
const AUTO_CENTER_PADDING = 160
const ANNOTATION_FONT = '18px Inter, system-ui, sans-serif'
const ANNOTATION_LINE_HEIGHT = 24
const ANNOTATION_PADDING_X = 14
const ANNOTATION_PADDING_Y = 10
const ANNOTATION_MIN_WIDTH = 120

type ViewTransform = {
  scale: number
  offsetX: number
  offsetY: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

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
  const nodeInputRef = useRef<HTMLInputElement | null>(null)
  const annotationInputRef = useRef<HTMLInputElement | null>(null)
  const {
    state: { nodes, annotations, selectedNodeId, selectedAnnotationId, history },
    dispatch,
  } = useMindMap()

  const { past, future } = history

  const nodesRef = useRef(nodes)
  const annotationsRef = useRef(annotations)
  const selectedNodeRef = useRef(selectedNodeId)
  const selectedAnnotationRef = useRef(selectedAnnotationId)

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

  const [editText, setEditText] = useState(() => selectedNode?.text ?? '')
  const [annotationEditText, setAnnotationEditText] = useState(
    () => selectedAnnotation?.text ?? '',
  )
  const [viewTransform, setViewTransform] = useState<ViewTransform>(() => ({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }))
  const viewRef = useRef(viewTransform)
  const hasAutoCenteredRef = useRef(false)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const [isExportMenuOpen, setExportMenuOpen] = useState(false)

  const getNodeRadius = useCallback(
    (node: MindMapNode) => {
      const context = contextRef.current
      if (!context) {
        return NODE_BASE_RADIUS
      }

      const previousFont = context.font
      context.font = NODE_FONT
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

  const measureAnnotation = useCallback((annotation: MindMapAnnotation) => {
    const context = contextRef.current
    if (!context) {
      return null
    }

    const previousFont = context.font
    context.font = ANNOTATION_FONT
    const content = annotation.text.length > 0 ? annotation.text : 'New text'
    const metrics = context.measureText(content)
    const textWidth = Math.max(
      metrics.width,
      ANNOTATION_MIN_WIDTH - ANNOTATION_PADDING_X * 2,
    )
    const width = textWidth + ANNOTATION_PADDING_X * 2
    const height = ANNOTATION_LINE_HEIGHT + ANNOTATION_PADDING_Y * 2
    context.font = previousFont

    return { width, height }
  }, [])

  useEffect(() => {
    setEditText(selectedNode?.text ?? '')
  }, [selectedNode?.id, selectedNode?.text])

  useEffect(() => {
    setAnnotationEditText(selectedAnnotation?.text ?? '')
  }, [selectedAnnotation?.id, selectedAnnotation?.text])

  const closeExportMenu = useCallback(() => {
    setExportMenuOpen(false)
  }, [])

  const toggleExportMenu = useCallback(() => {
    setExportMenuOpen((previous) => !previous)
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
    const { scale, offsetX, offsetY } = viewRef.current

    context.clearRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2
    const nodeMap = new Map(nodesToDraw.map((node) => [node.id, node]))

    context.save()
    context.translate(centerX + offsetX, centerY + offsetY)
    context.scale(scale, scale)

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
      context.font = NODE_FONT
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(node.text, nodeX, nodeY)
      context.font = previousFont
    })

    context.font = ANNOTATION_FONT
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    annotationsToDraw.forEach((annotation) => {
      const metrics = measureAnnotation(annotation)
      const widthWithPadding = metrics?.width ?? ANNOTATION_MIN_WIDTH
      const heightWithPadding =
        metrics?.height ?? ANNOTATION_LINE_HEIGHT + ANNOTATION_PADDING_Y * 2
      const rectX = annotation.x - widthWithPadding / 2
      const rectY = annotation.y - heightWithPadding / 2

      context.fillStyle = 'rgba(15, 23, 42, 0.78)'
      context.fillRect(rectX, rectY, widthWithPadding, heightWithPadding)

      context.lineWidth = annotation.id === selectedAnnotationId ? 3 : 1.5
      context.strokeStyle =
        annotation.id === selectedAnnotationId ? '#38bdf8' : 'rgba(148, 163, 184, 0.55)'
      context.strokeRect(rectX, rectY, widthWithPadding, heightWithPadding)

      context.fillStyle = '#f8fafc'
      context.fillText(
        annotation.text.length > 0 ? annotation.text : 'New text',
        annotation.x,
        annotation.y,
      )
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
    drawScene()
  }, [annotations, nodes, selectedAnnotationId, selectedNodeId, drawScene])

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
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: hitAnnotation.id })
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
        dispatch({ type: 'SELECT_NODE', nodeId: hitNode.id })
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
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: hitAnnotation.id })
        setAnnotationEditText(hitAnnotation.text)
        focusInput(annotationInputRef.current)
        event.preventDefault()
        return
      }

      const hitNode = [...nodesRef.current]
        .reverse()
        .find((node) => Math.hypot(scenePoint.x - node.x, scenePoint.y - node.y) <= getNodeRadius(node))

      if (hitNode) {
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_NODE', nodeId: hitNode.id })
        setEditText(hitNode.text)
        focusInput(nodeInputRef.current)
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
  }, [adjustZoom, dispatch, focusInput, getNodeRadius, measureAnnotation, resizeCanvas])

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
      },
    })
  }, [dispatch])

  const handleDeleteSelection = useCallback(() => {
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
  }, [dispatch, selectedAnnotation, selectedNode, selectedNodeId])

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
  }, [annotations, nodes])

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
  }, [annotations, closeExportMenu, nodes])

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
      .map((annotation) => ({ ...annotation }))
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
          }
          const importedNodes = sanitizeImportedNodes(parsed.nodes)
          const importedAnnotations = sanitizeImportedAnnotations(parsed.annotations)

          if (!importedNodes) {
            window.alert('Unable to import file. Please choose a valid Mindmapper JSON export.')
            return
          }

          dispatch({ type: 'IMPORT', nodes: importedNodes, annotations: importedAnnotations })
        } catch (error) {
          console.error('Failed to import mind map', error)
          window.alert('Unable to import file. Please choose a valid Mindmapper JSON export.')
        }
      }
      reader.readAsText(file)
      event.target.value = ''
    },
    [dispatch, sanitizeImportedAnnotations, sanitizeImportedNodes],
  )

  const handleImportJson = useCallback(() => {
    closeExportMenu()
    fileInputRef.current?.click()
  }, [closeExportMenu])

  const canDeleteNode = Boolean(selectedNode && selectedNode.parentId !== null)
  const canDeleteAnnotation = Boolean(selectedAnnotation)
  const canDelete = canDeleteNode || canDeleteAnnotation
  const canUndo = past.length > 0
  const canRedo = future.length > 0
  const canZoomIn = viewTransform.scale < MAX_ZOOM - 0.001
  const canZoomOut = viewTransform.scale > MIN_ZOOM + 0.001
  const zoomPercentage = Math.round(viewTransform.scale * 100)

  const handleNodeTextChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setEditText(value)

      if (selectedNodeId) {
        dispatch({
          type: 'UPDATE_NODE',
          nodeId: selectedNodeId,
          updates: { text: value },
        })
      }
    },
    [dispatch, selectedNodeId],
  )

  const handleAnnotationTextChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setAnnotationEditText(value)

      if (selectedAnnotationId) {
        dispatch({
          type: 'UPDATE_ANNOTATION',
          annotationId: selectedAnnotationId,
          updates: { text: value },
        })
      }
    },
    [dispatch, selectedAnnotationId],
  )

  return (
    <div className="app-shell">
      <canvas ref={canvasRef} className="mindmap-canvas" />
      <div className="mindmap-toolbar">
        <div className="mindmap-toolbar__actions">
          <button type="button" onClick={handleAddChild} title="Enter">
            Add child
          </button>
          <button type="button" onClick={handleAddAnnotation} title="Add a floating text note">
            Add text
          </button>
        </div>
        <div className="mindmap-toolbar__row mindmap-toolbar__row--editors">
          <label className="mindmap-toolbar__text-editor">
            <span>Edit node</span>
            <input
              type="text"
              value={editText}
              onChange={handleNodeTextChange}
              placeholder={selectedNode ? 'Type here to rename the node' : 'Select a node first'}
              disabled={!selectedNode}
              aria-label="Selected node text"
              className="mindmap-toolbar__text-input"
              ref={nodeInputRef}
            />
          </label>
          <label className="mindmap-toolbar__text-editor">
            <span>Edit text</span>
            <input
              type="text"
              value={annotationEditText}
              onChange={handleAnnotationTextChange}
              placeholder={
                selectedAnnotation ? 'Type here to update the text box' : 'Select a text box first'
              }
              disabled={!selectedAnnotation}
              aria-label="Selected text box content"
              className="mindmap-toolbar__text-input"
              ref={annotationInputRef}
            />
          </label>
        </div>
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
