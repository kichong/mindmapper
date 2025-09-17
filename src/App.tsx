import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { type MindMapNode, useMindMap } from './state/MindMapContext'
import './App.css'

const NODE_RADIUS = 40
const LINK_DISTANCE = 160
const FALLBACK_COLORS = ['#22d3ee', '#a855f7', '#10b981', '#f97316', '#facc15']
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 1.2
const KEYBOARD_PAN_STEP = 80

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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0 })
  const interactionRef = useRef<InteractionState>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const {
    state: { nodes, selectedNodeId, history },
    dispatch,
  } = useMindMap()

  const { past, future } = history

  const nodesRef = useRef(nodes)
  const selectedNodeRef = useRef(selectedNodeId)

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId],
  )

  const [editText, setEditText] = useState(() => selectedNode?.text ?? '')
  const [viewTransform, setViewTransform] = useState<ViewTransform>(() => ({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }))
  const viewRef = useRef(viewTransform)

  useEffect(() => {
    setEditText(selectedNode?.text ?? '')
  }, [selectedNode?.id, selectedNode?.text])

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

      context.fillStyle = node.color || '#4f46e5'
      context.beginPath()
      context.arc(nodeX, nodeY, NODE_RADIUS, 0, Math.PI * 2)
      context.fill()

      if (node.id === selectedId) {
        context.lineWidth = 4
        context.strokeStyle = '#f97316'
        context.stroke()
        context.lineWidth = 2
        context.strokeStyle = 'rgba(148, 163, 184, 0.5)'
      }

      context.fillStyle = '#ffffff'
      context.font = '16px Inter, system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(node.text, nodeX, nodeY)
    })

    context.restore()
  }, [])

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
  }, [drawScene])

  useEffect(() => {
    nodesRef.current = nodes
    selectedNodeRef.current = selectedNodeId
    drawScene()
  }, [nodes, selectedNodeId, drawScene])

  const adjustZoom = useCallback((factor: number, pivot?: { screenX: number; screenY: number }) => {
    setViewTransform((previous) => {
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
    const rootNode = nodes.find((node) => node.parentId === null) ?? null
    setViewTransform({
      scale: 1,
      offsetX: rootNode ? -rootNode.x : 0,
      offsetY: rootNode ? -rootNode.y : 0,
    })
  }, [nodes])

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

    const getCanvasPoint = (event: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    }

    const getScenePoint = (event: PointerEvent) => {
      const { x, y } = getCanvasPoint(event)
      const { width, height } = sizeRef.current
      const { scale, offsetX, offsetY } = viewRef.current
      const centerX = width / 2
      const centerY = height / 2

      return {
        x: (x - centerX - offsetX) / scale,
        y: (y - centerY - offsetY) / scale,
      }
    }

    const finishInteraction = (pointerId: number, shouldDeselect: boolean) => {
      const interaction = interactionRef.current
      if (!interaction || interaction.pointerId !== pointerId) {
        return
      }

      if (interaction.mode === 'pan' && shouldDeselect && !interaction.moved) {
        dispatch({ type: 'SELECT_NODE', nodeId: null })
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

      const hitNode = [...nodesRef.current]
        .reverse()
        .find((node) => Math.hypot(scenePoint.x - node.x, scenePoint.y - node.y) <= NODE_RADIUS)

      if (hitNode) {
        interactionRef.current = {
          mode: 'node',
          pointerId: event.pointerId,
          nodeId: hitNode.id,
          offsetX: scenePoint.x - hitNode.x,
          offsetY: scenePoint.y - hitNode.y,
        }

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

      const deltaX = event.clientX - interaction.startClientX
      const deltaY = event.clientY - interaction.startClientY

      if (!interaction.moved && Math.hypot(deltaX, deltaY) > 2) {
        interaction.moved = true
      }

      setViewTransform((previous) => ({
        ...previous,
        offsetX: interaction.startOffsetX + deltaX,
        offsetY: interaction.startOffsetY + deltaY,
      }))
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

    window.addEventListener('resize', resizeCanvas)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerCancel)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerCancel)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [adjustZoom, dispatch, resizeCanvas])

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

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId || !selectedNode) {
      return
    }

    if (selectedNode.parentId === null) {
      return
    }

    dispatch({ type: 'DELETE_NODE', nodeId: selectedNodeId })
  }, [dispatch, selectedNode, selectedNodeId])

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

  const hasChildNodes = useMemo(() => nodes.some((node) => node.parentId !== null), [nodes])

  const handleClearChildren = useCallback(() => {
    if (!hasChildNodes) {
      return
    }
    dispatch({ type: 'CLEAR_CHILDREN' })
  }, [dispatch, hasChildNodes])

  const panByPixels = useCallback((deltaX: number, deltaY: number) => {
    setViewTransform((previous) => ({
      ...previous,
      offsetX: previous.offsetX + deltaX,
      offsetY: previous.offsetY + deltaY,
    }))
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
        handleDeleteNode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleAddChild,
    handleDeleteNode,
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
    const payload = JSON.stringify(
      {
        nodes: nodes.map((node) => ({ ...node })),
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
  }, [nodes])

  const handleExportPng = useCallback(() => {
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
  }, [])

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

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as { nodes?: unknown }
          const importedNodes = sanitizeImportedNodes(parsed.nodes)

          if (!importedNodes) {
            window.alert('Unable to import file. Please choose a valid Mindmapper JSON export.')
            return
          }

          dispatch({ type: 'IMPORT', nodes: importedNodes })
        } catch (error) {
          console.error('Failed to import mind map', error)
          window.alert('Unable to import file. Please choose a valid Mindmapper JSON export.')
        }
      }
      reader.readAsText(file)
      event.target.value = ''
    },
    [dispatch, sanitizeImportedNodes],
  )

  const handleImportJson = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const canDelete = Boolean(selectedNode && selectedNode.parentId !== null)
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

  return (
    <div className="app-shell">
      <canvas ref={canvasRef} className="mindmap-canvas" />
      <div className="mindmap-toolbar">
        <button type="button" onClick={handleAddChild} title="Enter">
          Add child
        </button>
        <label className="mindmap-toolbar__text-editor">
          <span>Edit text</span>
          <input
            type="text"
            value={editText}
            onChange={handleNodeTextChange}
            placeholder={selectedNode ? 'Type here to rename the node' : 'Select a node first'}
            disabled={!selectedNode}
            aria-label="Selected node text"
            className="mindmap-toolbar__text-input"
          />
        </label>
        <button type="button" onClick={handleDeleteNode} disabled={!canDelete} title="Delete or Backspace">
          Delete
        </button>
        <button
          type="button"
          onClick={handleClearChildren}
          disabled={!hasChildNodes}
          title="Remove every node that has a parent"
        >
          Clear
        </button>
        <button type="button" onClick={handleUndo} disabled={!canUndo} title="Ctrl/Cmd + Z">
          Undo
        </button>
        <button type="button" onClick={handleRedo} disabled={!canRedo} title="Ctrl/Cmd + Y or Shift + Ctrl/Cmd + Z">
          Redo
        </button>
        <button type="button" onClick={handleExportJson} title="Download JSON copy">
          Export JSON
        </button>
        <button type="button" onClick={handleImportJson} title="Load from JSON file">
          Import JSON
        </button>
        <button type="button" onClick={handleExportPng} title="Download PNG image">
          Export PNG
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
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
          <button type="button" onClick={handleZoomIn} disabled={!canZoomIn} title="Zoom in (+)">
            +
          </button>
          <span>{zoomPercentage}%</span>
          <button type="button" onClick={handleZoomOut} disabled={!canZoomOut} title="Zoom out (-)">
            −
          </button>
        </div>
      </div>
    </div>
  )
}
