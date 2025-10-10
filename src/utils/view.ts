import { AUTO_CENTER_PADDING, MAX_ZOOM, MIN_ZOOM } from '../constants/mindMap'
import { type MindMapNode } from '../state/MindMapContext'
import { clamp } from './geometry'

export type CanvasSize = { width: number; height: number }
export type ViewTransform = { scale: number; offsetX: number; offsetY: number }

export function calculateFitView(
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
