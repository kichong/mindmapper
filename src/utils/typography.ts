import {
  NODE_FONT_SIZES,
  NODE_FONT_FAMILY,
  NODE_LINE_HEIGHTS,
  NODE_TEXT_PADDING,
  NODE_BASE_RADIUS,
  NODE_WRAP_STEP,
  NODE_RADIUS_EPSILON,
  ANNOTATION_FONT_SIZES,
  ANNOTATION_FONT_FAMILY,
  ANNOTATION_LINE_HEIGHTS,
  ANNOTATION_PADDING_X,
  ANNOTATION_PADDING_Y,
  ANNOTATION_MIN_WIDTH,
} from '../constants/mindMap'
import { type TextSize } from '../state/mindMapModel'

export const getNodeFont = (size: TextSize) => `${NODE_FONT_SIZES[size]}px ${NODE_FONT_FAMILY}`
export const getNodeLineHeight = (size: TextSize) => NODE_LINE_HEIGHTS[size]
export const getAnnotationFont = (size: TextSize) =>
  `${ANNOTATION_FONT_SIZES[size]}px ${ANNOTATION_FONT_FAMILY}`
export const getAnnotationLineHeight = (size: TextSize) => ANNOTATION_LINE_HEIGHTS[size]

export const calculateNodeRadius = (contentWidth: number, contentHeight: number) => {
  const paddedWidth = contentWidth + NODE_TEXT_PADDING * 2
  const paddedHeight = contentHeight + NODE_TEXT_PADDING * 2
  const diagonal = Math.sqrt(paddedWidth * paddedWidth + paddedHeight * paddedHeight)
  return Math.max(NODE_BASE_RADIUS, diagonal / 2)
}

export type NodeLabelLayout = {
  lines: string[]
  width: number
  height: number
  lineHeight: number
  radius: number
}

export const calculateNodeLabelLayout = (
  context: CanvasRenderingContext2D,
  rawLabel: string,
  textSize: TextSize,
): NodeLabelLayout => {
  const label = rawLabel.trim().length > 0 ? rawLabel : 'New Idea'
  const lineHeight = getNodeLineHeight(textSize)
  const words = label.split(/\s+/).filter((word) => word.length > 0)

  if (words.length === 0) {
    words.push(label)
  }

  const spaceWidth = context.measureText(' ').width
  const wordWidths = words.map((word) => context.measureText(word).width)
  const prefixWidths = new Array<number>(wordWidths.length + 1)
  prefixWidths[0] = 0

  for (let index = 0; index < wordWidths.length; index += 1) {
    prefixWidths[index + 1] = prefixWidths[index] + wordWidths[index]
  }

  const computeLineWidth = (start: number, end: number) =>
    prefixWidths[end + 1] - prefixWidths[start] + spaceWidth * (end - start)

  const singleLineWidth = context.measureText(label).width
  let maxWordWidth = wordWidths.reduce((max, width) => Math.max(max, width), 0)

  if (!Number.isFinite(maxWordWidth)) {
    maxWordWidth = singleLineWidth
  }

  const minWidth = Math.max(maxWordWidth, 1)
  const maxWidth = Math.max(singleLineWidth, minWidth)
  const candidateWidths = new Set<number>([maxWidth, minWidth])

  if (maxWidth > minWidth) {
    for (let width = maxWidth - NODE_WRAP_STEP; width > minWidth; width -= NODE_WRAP_STEP) {
      candidateWidths.add(width)
    }
  }

  for (let start = 0; start < words.length; start += 1) {
    for (let end = start; end < words.length; end += 1) {
      const width = computeLineWidth(start, end)
      if (width >= minWidth && width <= maxWidth) {
        candidateWidths.add(width)
      }
    }
  }

  const wrapWithWidth = (limit: number) => {
    const segments: Array<{ start: number; end: number; width: number }> = []
    let start = 0

    while (start < words.length) {
      let end = start
      let width = computeLineWidth(start, end)

      while (end + 1 < words.length) {
        const nextWidth = computeLineWidth(start, end + 1)
        if (nextWidth > limit && (width <= limit || end === start)) {
          break
        }

        if (nextWidth > limit && width > limit) {
          break
        }

        end += 1
        width = nextWidth
      }

      segments.push({ start, end, width })
      start = end + 1
    }

    const lines = segments.map(({ start: lineStart, end: lineEnd }) =>
      words.slice(lineStart, lineEnd + 1).join(' '),
    )
    const width = segments.reduce((max, segment) => Math.max(max, segment.width), 0)
    const height = Math.max(lineHeight, lines.length * lineHeight)

    return { lines, width, height }
  }

  let bestLayout = wrapWithWidth(maxWidth)
  let bestRadius = calculateNodeRadius(bestLayout.width, bestLayout.height)

  candidateWidths.forEach((candidate) => {
    if (!Number.isFinite(candidate) || candidate <= 0) {
      return
    }

    const layout = wrapWithWidth(candidate)
    const radius = calculateNodeRadius(layout.width, layout.height)

    if (radius + NODE_RADIUS_EPSILON < bestRadius) {
      bestLayout = layout
      bestRadius = radius
      return
    }

    if (Math.abs(radius - bestRadius) <= NODE_RADIUS_EPSILON) {
      if (layout.width < bestLayout.width - NODE_RADIUS_EPSILON) {
        bestLayout = layout
        bestRadius = radius
      }
    }
  })

  const radius = Math.max(NODE_BASE_RADIUS, bestRadius)

  return {
    lines: bestLayout.lines.length > 0 ? bestLayout.lines : [label],
    width: bestLayout.width,
    height: bestLayout.height,
    lineHeight,
    radius,
  }
}

export type AnnotationMetrics = { width: number; height: number; font: string }

export const measureAnnotationMetrics = (
  context: CanvasRenderingContext2D,
  text: string,
  textSize: TextSize,
): AnnotationMetrics => {
  const previousFont = context.font
  const annotationFont = getAnnotationFont(textSize)
  context.font = annotationFont
  const content = text.length > 0 ? text : 'New text'
  const metrics = context.measureText(content)
  const textWidth = Math.max(metrics.width, ANNOTATION_MIN_WIDTH - ANNOTATION_PADDING_X * 2)
  const width = textWidth + ANNOTATION_PADDING_X * 2
  const lineHeight = getAnnotationLineHeight(textSize)
  const height = lineHeight + ANNOTATION_PADDING_Y * 2
  context.font = previousFont

  return { width, height, font: annotationFont }
}
