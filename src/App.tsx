import { useEffect, useRef } from 'react'
import './App.css'
import { useMindMap } from './state/MindMapContext'

const NODE_RADIUS = 40

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { state } = useMindMap()

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

      Object.values(state.nodes).forEach((node) => {
        const x = width / 2 + node.x
        const y = height / 2 + node.y

        context.fillStyle = '#4f46e5'
        context.beginPath()
        context.arc(x, y, NODE_RADIUS, 0, Math.PI * 2)
        context.fill()

        context.fillStyle = '#ffffff'
        context.font = '16px Inter, system-ui, sans-serif'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(node.text, x, y)
      })
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

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [state.nodes])

  return <canvas ref={canvasRef} className="mindmap-canvas" />
}
