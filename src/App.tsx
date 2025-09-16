import { useEffect, useRef } from 'react'
import './App.css'
import { useMindMap } from './state/MindMapContext'

const NODE_RADIUS = 40

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const drawNodesRef = useRef<((width: number, height: number) => void) | null>(null)
  const {
    state: { nodes, selectedNodeId },
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

    contextRef.current = context

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const cssWidth = window.innerWidth
      const cssHeight = window.innerHeight

      canvas.width = cssWidth * dpr
      canvas.height = cssHeight * dpr
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      sizeRef.current = { width: cssWidth, height: cssHeight }
      drawNodesRef.current?.(cssWidth, cssHeight)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  useEffect(() => {
    drawNodesRef.current = (width, height) => {
      const context = contextRef.current
      if (!context) {
        return
      }

      context.clearRect(0, 0, width, height)

      const originX = width / 2
      const originY = height / 2

      nodes.forEach((node) => {
        const nodeX = originX + node.x
        const nodeY = originY + node.y

        context.fillStyle = node.color
        context.beginPath()
        context.arc(nodeX, nodeY, NODE_RADIUS, 0, Math.PI * 2)
        context.fill()

        if (node.id === selectedNodeId) {
          context.lineWidth = 4
          context.strokeStyle = 'rgba(255, 255, 255, 0.8)'
          context.stroke()
        }

        context.fillStyle = '#ffffff'
        context.font = '16px Inter, system-ui, sans-serif'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(node.text, nodeX, nodeY)
      })
    }

    const { width, height } = sizeRef.current
    if (width > 0 && height > 0) {
      drawNodesRef.current?.(width, height)
    }
  }, [nodes, selectedNodeId])

  return <canvas ref={canvasRef} className="mindmap-canvas" />
}
