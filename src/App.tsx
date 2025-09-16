import { useEffect, useRef } from 'react'
import './App.css'

const NODE_RADIUS = 40

type Point = {
  x: number
  y: number
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const offsetRef = useRef<Point>({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const lastPointerPositionRef = useRef<Point>({ x: 0, y: 0 })

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
      const { width, height } = canvas.getBoundingClientRect()
      const { x, y } = offsetRef.current

      context.clearRect(0, 0, width, height)

      const centerX = width / 2 + x
      const centerY = height / 2 + y

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
      const { innerWidth, innerHeight } = window

      canvas.style.width = `${innerWidth}px`
      canvas.style.height = `${innerHeight}px`
      canvas.width = innerWidth * dpr
      canvas.height = innerHeight * dpr

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawSeed()
    }

    const handlePointerDown = (event: PointerEvent) => {
      isDraggingRef.current = true
      lastPointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      }
      canvas.setPointerCapture(event.pointerId)
      canvas.style.cursor = 'grabbing'
      event.preventDefault()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current) {
        return
      }

      const { x, y } = lastPointerPositionRef.current

      const deltaX = event.clientX - x
      const deltaY = event.clientY - y

      offsetRef.current = {
        x: offsetRef.current.x + deltaX,
        y: offsetRef.current.y + deltaY,
      }

      lastPointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      }

      drawSeed()
    }

    const stopDragging = (event?: PointerEvent) => {
      if (!isDraggingRef.current) {
        return
      }

      isDraggingRef.current = false
      if (event && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
      canvas.style.cursor = 'grab'
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    canvas.addEventListener('pointerleave', stopDragging)
    canvas.addEventListener('pointercancel', stopDragging)
    canvas.style.cursor = 'grab'

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
      canvas.removeEventListener('pointerleave', stopDragging)
      canvas.removeEventListener('pointercancel', stopDragging)
    }
  }, [])

  return <canvas ref={canvasRef} className="mindmap-canvas" />
}
