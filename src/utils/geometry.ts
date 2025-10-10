import {
  ARROW_HEAD_BASE_PADDING,
  ARROW_HEAD_BASE_RATIO,
  ARROW_HEAD_RATIO,
  ARROW_MIN_HEAD_HALF_HEIGHT,
  ARROW_MIN_HEAD_LENGTH,
  ARROW_MIN_SHAFT_HALF_HEIGHT,
  ARROW_MIN_HEIGHT,
  ARROW_MIN_THICKNESS,
  ARROW_MIN_WIDTH,
  LINE_MIN_LENGTH,
  LINE_MIN_THICKNESS,
} from '../constants/mindMap'
import { type MindMapArrow, type MindMapLine } from '../state/MindMapContext'

export type Point = { x: number; y: number }

export const tracePolygon = (context: CanvasRenderingContext2D, points: Point[]) => {
  if (points.length === 0) {
    return
  }

  context.beginPath()
  context.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0)
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    context.lineTo(point.x, point.y)
  }
  context.closePath()
}

export const rotatePoint = (point: Point, angle: number): Point => {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

export const rotateAndTranslate = (point: Point, center: Point, angle: number): Point => {
  const rotated = rotatePoint(point, angle)
  return {
    x: rotated.x + center.x,
    y: rotated.y + center.y,
  }
}

export const normalizeVector = (dx: number, dy: number): Point => {
  const length = Math.hypot(dx, dy)
  if (length === 0) {
    return { x: 0, y: 0 }
  }
  return { x: dx / length, y: dy / length }
}

export type ArrowGeometry = {
  halfWidth: number
  halfHeight: number
  headLength: number
  shaftHalfHeight: number
}

export type LineGeometry = {
  halfLength: number
  halfThickness: number
}

export const enforceArrowHeadHeights = (rawHalfHeight: number, halfThickness: number) => {
  const limitedShaftHalfHeight = Math.max(
    ARROW_MIN_SHAFT_HALF_HEIGHT,
    Math.min(halfThickness, rawHalfHeight),
  )

  const headHalfHeight = Math.max(
    rawHalfHeight,
    limitedShaftHalfHeight * ARROW_HEAD_BASE_RATIO,
    limitedShaftHalfHeight + ARROW_HEAD_BASE_PADDING,
    ARROW_MIN_HEAD_HALF_HEIGHT,
  )

  const shaftHalfHeight = Math.max(
    ARROW_MIN_SHAFT_HALF_HEIGHT,
    Math.min(halfThickness, headHalfHeight),
  )

  return { headHalfHeight, shaftHalfHeight }
}

export const toLocalCoordinates = (point: Point, center: Point, angle: number): Point => {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  }
}

export const getArrowGeometry = (shape: MindMapArrow): ArrowGeometry => {
  const halfWidth = Math.max(Math.abs(shape.width) / 2, ARROW_MIN_WIDTH / 2)
  const rawHalfHeight = Math.max(Math.abs(shape.height) / 2, ARROW_MIN_HEIGHT / 2)
  const baseHeadLength = Math.max(halfWidth * ARROW_HEAD_RATIO, ARROW_MIN_HEAD_LENGTH)
  const headLength = Math.min(baseHeadLength, halfWidth)
  const halfThickness = Math.max(Math.abs(shape.thickness) / 2, ARROW_MIN_THICKNESS / 2)
  const { headHalfHeight, shaftHalfHeight } = enforceArrowHeadHeights(rawHalfHeight, halfThickness)

  return {
    halfWidth,
    halfHeight: headHalfHeight,
    headLength,
    shaftHalfHeight,
  }
}

export const getLineGeometry = (shape: MindMapLine): LineGeometry => {
  const halfLength = Math.max(Math.abs(shape.length) / 2, LINE_MIN_LENGTH / 2)
  const halfThickness = Math.max(Math.abs(shape.thickness) / 2, LINE_MIN_THICKNESS / 2)

  return {
    halfLength,
    halfThickness,
  }
}

export const buildArrowPolygon = (shape: MindMapArrow, extraPadding = 0): Point[] => {
  const { halfWidth, halfHeight, headLength, shaftHalfHeight } = getArrowGeometry(shape)
  const paddedHalfWidth = halfWidth + extraPadding
  const paddedHalfHeight = halfHeight + extraPadding
  const paddedHeadLength = Math.min(paddedHalfWidth, headLength + extraPadding)
  const paddedShaftHalfHeight = Math.max(
    ARROW_MIN_SHAFT_HALF_HEIGHT,
    Math.min(shaftHalfHeight + extraPadding, paddedHalfHeight),
  )

  const angle = shape.angle ?? 0
  const center = { x: shape.x, y: shape.y }
  const headStartX = paddedHalfWidth - paddedHeadLength

  const localPoints: Point[] = [
    { x: -paddedHalfWidth, y: -paddedShaftHalfHeight },
    { x: headStartX, y: -paddedShaftHalfHeight },
    { x: headStartX, y: -paddedHalfHeight },
    { x: paddedHalfWidth, y: 0 },
    { x: headStartX, y: paddedHalfHeight },
    { x: headStartX, y: paddedShaftHalfHeight },
    { x: -paddedHalfWidth, y: paddedShaftHalfHeight },
  ]

  return localPoints.map((point) => rotateAndTranslate(point, center, angle))
}

export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; index += 1) {
    const vertex = polygon[index]
    const previous = polygon[previousIndex]

    const intersects =
      (vertex.y > point.y) !== (previous.y > point.y) &&
      point.x <
        ((previous.x - vertex.x) * (point.y - vertex.y)) /
          ((previous.y - vertex.y) || Number.EPSILON) +
          vertex.x

    if (intersects) {
      inside = !inside
    }

    previousIndex = index
  }

  return inside
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
