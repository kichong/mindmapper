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

    const drawSeed = () => {
      const { width, height } = canvas
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
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawSeed()
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
