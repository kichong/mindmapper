import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { type MindMapNode, useMindMap } from './state/MindMapContext'
import './App.css'

const NODE_RADIUS = 40
const LINK_DISTANCE = 160
const FALLBACK_COLORS = ['#22d3ee', '#a855f7', '#10b981', '#f97316', '#facc15']
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 1.2

type ViewTransform = {
  scale: number
  offsetX: number
  offsetY: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

type DragState = {
  nodeId: string
  offsetX: number
  offsetY: number
} | null

type CanvasSize = {
  width: number
  height: number
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0 })
  const dragStateRef = useRef<DragState>(null)
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


    const getCanvasPoint = (event: PointerEvent) => {
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

    const handlePointerDown = (event: PointerEvent) => {
      const scenePoint = getScenePoint(event)

      const hitNode = [...nodesRef.current]
        .reverse()
        .find((node) => Math.hypot(scenePoint.x - node.x, scenePoint.y - node.y) <= NODE_RADIUS)

      if (hitNode) {
        dragStateRef.current = {
          nodeId: hitNode.id,
          offsetX: scenePoint.x - hitNode.x,
          offsetY: scenePoint.y - hitNode.y,
        }

        dispatch({ type: 'SELECT_NODE', nodeId: hitNode.id })
        canvas.setPointerCapture(event.pointerId)
        event.preventDefault()
        return
      }

      dragStateRef.current = null
      dispatch({ type: 'SELECT_NODE', nodeId: null })
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) {
        return
      }

      const scenePoint = getScenePoint(event)

      dispatch({
        type: 'MOVE_NODE',
        nodeId: dragState.nodeId,
        x: scenePoint.x - dragState.offsetX,
        y: scenePoint.y - dragState.offsetY,
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (dragStateRef.current) {
        canvas.releasePointerCapture(event.pointerId)
        dragStateRef.current = null
      }
    }


    window.addEventListener('resize', resizeCanvas)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [dispatch, resizeCanvas])

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

  const adjustZoom = useCallback((factor: number) => {
    setViewTransform((previous) => {
      const nextScale = clamp(previous.scale * factor, MIN_ZOOM, MAX_ZOOM)
      if (nextScale === previous.scale) {
        return previous
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

  const handleClearChildren = useCallback(() => {
    if (!hasChildNodes) {
      return
    }
    dispatch({ type: 'CLEAR_CHILDREN' })
  }, [dispatch, hasChildNodes])

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
  }, [handleAddChild, handleDeleteNode, handleRedo, handleUndo])

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
        <button type="button" onClick={handleZoomOut} disabled={!canZoomOut} title="Zoom out">
          Zoom out
        </button>
        <button type="button" onClick={handleZoomIn} disabled={!canZoomIn} title="Zoom in">
          Zoom in
        </button>
        <button type="button" onClick={handleResetView} title="Return to centered view">
          Center view
        </button>
        <span className="mindmap-toolbar__zoom-indicator" aria-live="polite">
          {zoomPercentage}%
        </span>
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
          Clear child nodes
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
    </div>
  )
}
