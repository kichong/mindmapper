import {
  CROSS_LINK_COLOR_DARK,
  CROSS_LINK_COLOR_LIGHT,
  CROSS_LINK_DASH_GAP,
  CROSS_LINK_DASH_LENGTH,
  CROSS_LINK_ENDPOINT_RADIUS,
  CROSS_LINK_STROKE_WIDTH,
} from '../constants/mindMap'
import type { Point } from './geometry'

export type CrossLinkCurve = { start: Point; control: Point; end: Point }

export function drawCrossLink(
  context: CanvasRenderingContext2D,
  curve: CrossLinkCurve,
  theme: 'dark' | 'light',
): void {
  const color = theme === 'dark' ? CROSS_LINK_COLOR_DARK : CROSS_LINK_COLOR_LIGHT
  context.save()
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = CROSS_LINK_STROKE_WIDTH
  context.lineCap = 'round'
  context.setLineDash([CROSS_LINK_DASH_LENGTH, CROSS_LINK_DASH_GAP])
  context.beginPath()
  context.moveTo(curve.start.x, curve.start.y)
  context.quadraticCurveTo(curve.control.x, curve.control.y, curve.end.x, curve.end.y)
  context.stroke()
  context.setLineDash([])

  for (const point of [curve.start, curve.end]) {
    context.beginPath()
    context.arc(point.x, point.y, CROSS_LINK_ENDPOINT_RADIUS, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}
