export type TextSize = 'small' | 'medium' | 'large'

export const TEXT_SIZE_CHOICES: readonly TextSize[] = ['small', 'medium', 'large']

export function normalizeTextSize(value: unknown): TextSize {
  return value === 'small' || value === 'medium' || value === 'large'
    ? (value as TextSize)
    : 'medium'
}

export const DEFAULT_NODE_COLOR = '#4f46e5'

export interface MindMapNode {
  id: string
  parentId: string | null
  text: string
  x: number
  y: number
  color: string
  textSize: TextSize
}

export interface MindMapAnnotation {
  id: string
  text: string
  x: number
  y: number
  textSize: TextSize
}

export interface MindMapRing {
  id: string
  kind: 'ring'
  x: number
  y: number
  radius: number
  thickness: number
  color: string
}

export interface MindMapEllipse {
  id: string
  kind: 'ellipse'
  x: number
  y: number
  radiusX: number
  radiusY: number
  thickness: number
  color: string
}

export interface MindMapRectangle {
  id: string
  kind: 'rectangle'
  x: number
  y: number
  width: number
  height: number
  thickness: number
  color: string
}

export interface MindMapArrow {
  id: string
  kind: 'arrow'
  x: number
  y: number
  width: number
  height: number
  thickness: number
  angle: number
  color: string
}

export interface MindMapLine {
  id: string
  kind: 'line'
  x: number
  y: number
  length: number
  thickness: number
  angle: number
  color: string
}

export interface MindMapCrossLink {
  id: string
  sourceId: string
  targetId: string
}

export type MindMapShape =
  | MindMapRing
  | MindMapEllipse
  | MindMapRectangle
  | MindMapArrow
  | MindMapLine
