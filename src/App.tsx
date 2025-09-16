import { useEffect, useRef } from 'react'
import { useMindMap } from './state/MindMapContext'
import './App.css'

const NODE_RADIUS = 40
const LINK_DISTANCE = 160
const FALLBACK_COLORS = ['#22d3ee', '#a855f7', '#10b981', '#f97316', '#facc15']

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragStateRef = useRef<{
    nodeId: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const {
    state: { nodes, selectedNodeId },
    dispatch,
  } = useMindMap()

  const handleAddChild = () => {
    if (nodes.length === 0) {
      return
    }

    const parent =
      nodes.find((node) => node.id === selectedNodeId) ?? nodes.find((node) => node.parentId === null) ?? nodes[0]

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
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const nodeMap = new Map(nodes.map((node) => [node.id, node]))

    const drawConnections = (width: number, height: number) => {
      const centerX = width / 2
      const centerY = height / 2

      context.lineWidth = 2
      context.strokeStyle = 'rgba(148, 163, 184, 0.5)'

      nodes.forEach((node) => {
        if (!node.parentId) {
          return
        }

        const parentNode = nodeMap.get(node.parentId)
        if (!parentNode) {
          return
        }

        context.beginPath()
        context.moveTo(centerX + parentNode.x, centerY + parentNode.y)
        context.lineTo(centerX + node.x, centerY + node.y)
        context.stroke()
      })
    }

    const drawNodes = (width: number, height: number) => {
      context.clearRect(0, 0, width, height)

      const centerX = width / 2
      const centerY = height / 2

      drawConnections(width, height)

      nodes.forEach((node) => {
        const nodeX = centerX + node.x
        const nodeY = centerY + node.y

        context.fillStyle = node.color || '#4f46e5'
        context.beginPath()
        context.arc(nodeX, nodeY, NODE_RADIUS, 0, Math.PI * 2)
        context.fill()

        if (node.id === selectedNodeId) {
          context.lineWidth = 4
          context.strokeStyle = '#f97316'
          context.stroke()
        }

        context.fillStyle = '#ffffff'
        context.font = '16px Inter, system-ui, sans-serif'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(node.text, nodeX, nodeY)
      })
    }

    const getCanvasPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const { x, y, width, height } = getCanvasPoint(event)
      const centerX = width / 2
      const centerY = height / 2

      const hitNode = [...nodes]
        .reverse()
        .find((node) => {
          const nodeX = centerX + node.x
          const nodeY = centerY + node.y
          const distance = Math.hypot(x - nodeX, y - nodeY)
          return distance <= NODE_RADIUS
        })

      if (hitNode) {
        dragStateRef.current = {
          nodeId: hitNode.id,
          offsetX: x - (centerX + hitNode.x),
          offsetY: y - (centerY + hitNode.y),
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

      const { x, y, width, height } = getCanvasPoint(event)
      const centerX = width / 2
      const centerY = height / 2

      dispatch({
        type: 'MOVE_NODE',
        nodeId: dragState.nodeId,
        x: x - centerX - dragState.offsetX,
        y: y - centerY - dragState.offsetY,
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (dragStateRef.current) {
        canvas.releasePointerCapture(event.pointerId)
        dragStateRef.current = null
      }
    }

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const cssWidth = window.innerWidth
      const cssHeight = window.innerHeight

      canvas.width = cssWidth * dpr
      canvas.height = cssHeight * dpr
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawNodes(cssWidth, cssHeight)
    }

    // Draw once on mount and keep the canvas responsive on resize
    resizeCanvas()
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
  }, [dispatch, nodes, selectedNodeId])

  return (
    <div className="app-shell">
      <canvas ref={canvasRef} className="mindmap-canvas" />
      <div className="mindmap-toolbar">
        <button type="button" onClick={handleAddChild}>
          Add child node
        </button>
      </div>
    </div>
  )
}
