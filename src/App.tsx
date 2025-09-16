import { useEffect, useRef } from 'react'
import './App.css'

const NODE_RADIUS = 40

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const drawSeed = (width: number, height: number) => {
      context.clearRect(0, 0, width, height)

      const centerX = width / 2
      const centerY = height / 2

      context.fillStyle = '#4f46e5'
      context.beginPath()
      context.arc(centerX, centerY, NODE_RADIUS, 0, Math.PI * 2)
      context.fill()

      context.fillStyle = '#ffffff'
      context.font = '16px Inter, system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText('Root', centerX, centerY)
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
      drawSeed(cssWidth, cssHeight)
    }

    // Draw once on mount and keep the canvas responsive on resize
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return <canvas ref={canvasRef} className="mindmap-canvas" />
}
