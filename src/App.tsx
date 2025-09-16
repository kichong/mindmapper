import { useEffect, useRef } from 'react'
import { useMindMap } from './state/MindMapContext'
import './App.css'

const NODE_RADIUS = 40

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const drawNodes = (width: number, height: number) => {
      context.clearRect(0, 0, width, height)

      const centerX = width / 2
      const centerY = height / 2

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

  return <canvas ref={canvasRef} className="mindmap-canvas" />
}
