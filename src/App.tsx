import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  MindMapActionsPanel,
  type MindMapActionGroup,
} from './components/MindMapActionsPanel'
import {
  MindMapNavigation,
} from './components/MindMapNavigation'
import {
  MindMapToolbar,
  type ToolbarActionButton,
} from './components/MindMapToolbar'
import { MindMapWorkspacePanel } from './components/MindMapWorkspacePanel'
import { MindMapToolIcon } from './components/MindMapToolIcon'
import {
  DEFAULT_NODE_COLOR,
  ROOT_NODE_ID,
  TEXT_SIZE_CHOICES,
  normalizeTextSize,
  type MindMapAnnotation,
  type MindMapNode,
  type MindMapCrossLink,
  type MindMapShape,
  type TextSize,
  useMindMap,
} from './state/MindMapContext'
import {
  ARROW_DEFAULT_ANGLE,
  ARROW_DEFAULT_COLOR,
  ARROW_DEFAULT_HEIGHT,
  ARROW_DEFAULT_THICKNESS,
  ARROW_DEFAULT_WIDTH,
  ARROW_HIT_PADDING,
  ARROW_MIN_HEIGHT,
  ARROW_MIN_THICKNESS,
  ARROW_MIN_WIDTH,
  CROSS_LINK_COLOR_DARK,
  CROSS_LINK_COLOR_LIGHT,
  CROSS_LINK_CURVE_SCALE,
  CROSS_LINK_MIN_CURVE_OFFSET,
  CROSS_LINK_STROKE_WIDTH,
  ELLIPSE_DEFAULT_COLOR,
  ELLIPSE_DEFAULT_RADIUS_X,
  ELLIPSE_DEFAULT_RADIUS_Y,
  ELLIPSE_DEFAULT_THICKNESS,
  ELLIPSE_HIT_PADDING,
  ELLIPSE_MIN_RADIUS_X,
  ELLIPSE_MIN_RADIUS_Y,
  FALLBACK_COLORS,
  KEYBOARD_PAN_STEP,
  KEYBOARD_SHORTCUTS,
  LINE_DEFAULT_ANGLE,
  LINE_DEFAULT_COLOR,
  LINE_DEFAULT_LENGTH,
  LINE_DEFAULT_THICKNESS,
  LINE_HIT_PADDING,
  LINE_MIN_LENGTH,
  LINE_MIN_THICKNESS,
  LINK_DISTANCE,
  MAX_ZOOM,
  MIN_ZOOM,
  NODE_COLOR_OPTIONS,
  RECTANGLE_DEFAULT_COLOR,
  RECTANGLE_DEFAULT_HEIGHT,
  RECTANGLE_DEFAULT_THICKNESS,
  RECTANGLE_DEFAULT_WIDTH,
  RECTANGLE_HIT_PADDING,
  RECTANGLE_MIN_HEIGHT,
  RECTANGLE_MIN_WIDTH,
  RING_DEFAULT_COLOR,
  RING_DEFAULT_RADIUS,
  RING_DEFAULT_THICKNESS,
  RING_HIT_PADDING,
  RING_MIN_RADIUS,
  SHAPE_HANDLE_SCREEN_SIZE,
  SHAPE_COLOR_OPTIONS,
  VISIBLE_SHORTCUT_COUNT,
  ZOOM_STEP,
  GRIDLINE_SPACING,
  GRIDLINE_MAJOR_INTERVAL,
  GRIDLINE_COLOR_DARK,
  GRIDLINE_COLOR_LIGHT,
  GRIDLINE_MAJOR_COLOR_DARK,
  GRIDLINE_MAJOR_COLOR_LIGHT,
  GRIDLINE_AXIS_COLOR_DARK,
  GRIDLINE_AXIS_COLOR_LIGHT,
} from './constants/mindMap'
import {
  buildArrowPolygon,
  clamp,
  enforceArrowHeadHeights,
  getArrowGeometry,
  getLineGeometry,
  isPointInPolygon,
  normalizeVector,
  rotateAndTranslate,
  toLocalCoordinates,
  tracePolygon,
} from './utils/geometry'
import { downloadBlob } from './utils/download'
import {
  parseImportedMindMapDocument,
  serializeMindMapDocument,
} from './utils/mindMapDocument'
import {
  calculateNodeLabelLayout,
  calculateNodeRadius,
  getAnnotationFont,
  getNodeFont,
  getNodeLineHeight,
  getNodeVisualMetrics,
  measureAnnotationMetrics,
  type AnnotationMetrics,
  type NodeLabelLayout,
} from './utils/typography'
import { calculateFitView, type CanvasSize, type ViewTransform } from './utils/view'
import { renderMindMapSceneToCanvas } from './utils/exportScene'
import './App.css'

const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

type SelectionMarqueeState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

type InteractionState =
  | {
      mode: 'node'
      pointerId: number
      nodeId: string
      offsetX: number
      offsetY: number
    }
  | {
      mode: 'nodes'
      pointerId: number
      startSceneX: number
      startSceneY: number
      positions: { nodeId: string; startX: number; startY: number }[]
    }
  | {
      mode: 'annotation'
      pointerId: number
      annotationId: string
      offsetX: number
      offsetY: number
    }
  | {
      mode: 'shape-move'
      pointerId: number
      shapeId: string
      offsetX: number
      offsetY: number
    }
  | {
      mode: 'shape-resize'
      pointerId: number
      shapeId: string
    }
  | {
      mode: 'marquee'
      pointerId: number
      startSceneX: number
      startSceneY: number
      startCanvasX: number
      startCanvasY: number
      currentSceneX: number
      currentSceneY: number
      currentCanvasX: number
      currentCanvasY: number
      initialSelection: string[]
      additive: boolean
      appliedSelection: string[] | null
    }
  | {
      mode: 'pan'
      pointerId: number
      startClientX: number
      startClientY: number
      startOffsetX: number
      startOffsetY: number
      moved: boolean
    }
  | null

type CopiedNodeSnapshot = {
  text: string
  color: string
  textSize: TextSize
  x: number
  y: number
}

type ClipboardSnapshot = {
  nodes: CopiedNodeSnapshot[]
  pasteCount: number
}

const GRID_SNAP_EPSILON = 0.5

function ControlGlyph({ kind }: { kind: 'lock' | 'unlock' | 'dark' | 'light' | 'grid' }) {
  if (kind === 'lock' || kind === 'unlock') {
    return (
      <svg viewBox="0 0 20 20" className="mindmap-actions__glyph" aria-hidden="true">
        <rect x="5.2" y="8.6" width="9.6" height="7.2" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d={kind === 'lock' ? 'M7.2 8.6V6.7a2.8 2.8 0 0 1 5.6 0v1.9' : 'M12.8 8.6V6.7a2.8 2.8 0 0 0-5.6 0'} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      </svg>
    )
  }

  if (kind === 'grid') {
    return (
      <svg viewBox="0 0 20 20" className="mindmap-actions__glyph" aria-hidden="true">
        {[5, 10, 15].flatMap((x) => [5, 10, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".75" fill="currentColor" />))}
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" className="mindmap-actions__glyph" aria-hidden="true">
      <circle cx="10" cy="10" r="4" fill={kind === 'dark' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" />
      {kind === 'light' ? <path d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2M4.5 4.5 6 6M14 14l1.5 1.5M15.5 4.5 14 6M6 14l-1.5 1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" /> : null}
    </svg>
  )
}

function drawShapeHandle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  theme: 'dark' | 'light',
) {
  const radius = SHAPE_HANDLE_SCREEN_SIZE / scale / 2
  context.save()
  context.shadowColor = theme === 'dark' ? 'rgba(120, 213, 227, 0.36)' : 'rgba(6, 127, 163, 0.2)'
  context.shadowBlur = 8 / scale
  context.fillStyle = theme === 'dark' ? '#091116' : '#f8fbfc'
  context.strokeStyle = theme === 'dark' ? '#a8e7ef' : '#087f9d'
  context.lineWidth = 1.5 / scale
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.fillStyle = theme === 'dark' ? '#78d5e3' : '#087f9d'
  context.beginPath()
  context.arc(x, y, 1.8 / scale, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function applyShapeGlow(
  context: CanvasRenderingContext2D,
  color: string,
  theme: 'dark' | 'light',
) {
  context.shadowColor = theme === 'dark' ? color : 'rgba(20, 48, 61, 0.12)'
  context.shadowBlur = theme === 'dark' ? 9 : 6
}

function clearCanvasShadow(context: CanvasRenderingContext2D) {
  context.shadowColor = 'transparent'
  context.shadowBlur = 0
}

function getShapeThicknessRange(shape: MindMapShape | null) {
  if (shape?.kind === 'arrow') {
    return {
      min: 4,
      max: Math.max(16, Math.min(48, Math.round(Math.abs(shape.height) * 0.32))),
    }
  }

  return { min: 1, max: 24 }
}

function getNextNodeColor(referenceColor?: string) {
  if (FALLBACK_COLORS.length === 0) {
    return DEFAULT_NODE_COLOR
  }

  const currentIndex = referenceColor
    ? FALLBACK_COLORS.findIndex((color) => color.toLowerCase() === referenceColor.toLowerCase())
    : -1
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % FALLBACK_COLORS.length : 0
  return FALLBACK_COLORS[nextIndex] ?? DEFAULT_NODE_COLOR
}

function snapValue(value: number, spacing: number): number {
  if (spacing <= 0) {
    return value
  }
  return Math.round(value / spacing) * spacing
}

function snapPoint(point: { x: number; y: number }, spacing: number) {
  return {
    x: snapValue(point.x, spacing),
    y: snapValue(point.y, spacing),
  }
}

function isSnapEligibleShape(shape: MindMapShape): boolean {
  return shape.kind === 'rectangle' || shape.kind === 'arrow' || shape.kind === 'line'
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0 })
  const interactionRef = useRef<InteractionState>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textInputRef = useRef<HTMLInputElement | null>(null)
  const pendingTextFocusRef = useRef(false)
  const {
    state: {
      nodes,
      annotations,
      shapes,
      crossLinks,
      selectedNodeIds,
      selectedAnnotationId,
      selectedShapeId,
      history,
    },
    dispatch,
  } = useMindMap()

  const { past, future } = history

  const nodesRef = useRef(nodes)
  const annotationsRef = useRef(annotations)
  const selectedNodeRef = useRef<string[]>([...selectedNodeIds])
  const selectedAnnotationRef = useRef(selectedAnnotationId)
  const shapesRef = useRef(shapes)
  const selectedShapeRef = useRef(selectedShapeId)
  const crossLinksRef = useRef(crossLinks)
  const clipboardRef = useRef<ClipboardSnapshot | null>(null)

  const nodeById = useMemo(() => {
    const map = new Map<string, MindMapNode>()
    nodes.forEach((node) => {
      map.set(node.id, node)
    })
    return map
  }, [nodes])

  const selectedNodes = useMemo(
    () =>
      selectedNodeIds
        .map((id) => nodeById.get(id) ?? null)
        .filter((node): node is MindMapNode => node !== null),
    [nodeById, selectedNodeIds],
  )

  const primarySelectedNode = selectedNodes[0] ?? null
  const singleSelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null

  const selectedAnnotation = useMemo(
    () =>
      selectedAnnotationId
        ? annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null
        : null,
    [annotations, selectedAnnotationId],
  )

  const selectedShape = useMemo(
    () => (selectedShapeId ? shapes.find((shape) => shape.id === selectedShapeId) ?? null : null),
    [shapes, selectedShapeId],
  )

  const selectedNodeColor = useMemo(() => {
    if (selectedNodes.length === 0) {
      return null
    }

    const [firstNode, ...restNodes] = selectedNodes
    return restNodes.every((node) => node.color === firstNode.color) ? firstNode.color : null
  }, [selectedNodes])

  const parentChildLinkStatus = useMemo(() => {
    if (selectedNodes.length < 2) {
      return {
        canLink: false,
        message: 'Select two ideas so the first can become the parent of the second',
        mode: 'link' as const,
      }
    }

    const [potentialParent, potentialChild] = selectedNodes
    if (!potentialParent || !potentialChild) {
      return {
        canLink: false,
        message: 'Select two ideas so the first can become the parent of the second',
        mode: 'link' as const,
      }
    }

    if (potentialParent.id === potentialChild.id) {
      return {
        canLink: false,
        message: 'Pick two different ideas to create a parent-child link',
        mode: 'link' as const,
      }
    }

    let ancestorId = potentialParent.parentId
    while (ancestorId) {
      if (ancestorId === potentialChild.id) {
        return {
          canLink: false,
          message: 'Cannot create a parent-child loop between these ideas',
          mode: 'link' as const,
        }
      }
      const ancestor = nodeById.get(ancestorId)
      if (!ancestor) {
        break
      }
      ancestorId = ancestor.parentId
    }

    if (potentialChild.parentId === potentialParent.id) {
      return {
        canLink: true,
        message: 'Remove the parent-child link between these ideas',
        mode: 'unlink' as const,
      }
    }

    return {
      canLink: true,
      message: 'Make the first selected idea the parent of the second',
      mode: 'link' as const,
    }
  }, [nodeById, selectedNodes])

  const selectedTextTarget = useMemo(() => {
    if (selectedShape) {
      return null
    }

    if (singleSelectedNode) {
      return {
        kind: 'node' as const,
        id: singleSelectedNode.id,
        text: singleSelectedNode.text,
        textSize: singleSelectedNode.textSize,
      }
    }

    if (selectedAnnotation) {
      return {
        kind: 'annotation' as const,
        id: selectedAnnotation.id,
        text: selectedAnnotation.text,
        textSize: selectedAnnotation.textSize,
      }
    }

    return null
  }, [selectedAnnotation, selectedShape, singleSelectedNode])

  const [textDraft, setTextDraft] = useState(() => selectedTextTarget?.text ?? '')
  const [clipboardStatus, setClipboardStatus] = useState<'empty' | 'ready'>('empty')
  const selectedTextSize: TextSize = selectedTextTarget?.textSize ?? 'medium'
  const [viewTransform, setViewTransform] = useState<ViewTransform>(() => ({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }))
  const viewRef = useRef(viewTransform)
  const hasAutoCenteredRef = useRef(false)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const shortcutsMenuRef = useRef<HTMLDivElement | null>(null)
  const shortcutsListRef = useRef<HTMLUListElement | null>(null)
  const [isExportMenuOpen, setExportMenuOpen] = useState(false)
  const [isShortcutsOpen, setShortcutsOpen] = useState(false)
  const [shortcutsVisibleHeight, setShortcutsVisibleHeight] = useState<number | null>(null)
  const [isToolbarCollapsed, setToolbarCollapsed] = useState(true)
  const [areActionsCollapsed, setActionsCollapsed] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [backgroundTheme, setBackgroundTheme] = useState<'dark' | 'light'>('dark')
  const [isGridModeEnabled, setIsGridModeEnabled] = useState(false)
  const [isShiftSelectActive, setShiftSelectActive] = useState(false)
  const [selectionMarquee, setSelectionMarquee] = useState<SelectionMarqueeState | null>(null)
  const gridModeRef = useRef(isGridModeEnabled)
  const shiftSelectActiveRef = useRef(false)
  const isSelectionModeActive = isShiftSelectActive

  useEffect(() => {
    if (!isLocked) {
      return
    }

    const interaction = interactionRef.current
    interactionRef.current = null

    const canvas = canvasRef.current
    if (canvas && interaction && canvas.hasPointerCapture(interaction.pointerId)) {
      canvas.releasePointerCapture(interaction.pointerId)
    }

    if (canvas) {
      canvas.style.cursor = isSelectionModeActive ? 'crosshair' : 'grab'
    }

    pendingTextFocusRef.current = false
  }, [isLocked, isSelectionModeActive])

  useEffect(() => {
    // Keep the rest of the page in step with the canvas background choice
    const darkColor = '#05080c'
    const lightColor = '#edf2f4'
    document.body.style.backgroundColor = backgroundTheme === 'dark' ? darkColor : lightColor

    return () => {
      document.body.style.backgroundColor = darkColor
    }
  }, [backgroundTheme])

  useEffect(() => {
    const shouldIgnoreTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false
      }
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return true
      }
      return target.isContentEditable
    }

    const handleShiftKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Shift' || shiftSelectActiveRef.current) {
        return
      }

      if (shouldIgnoreTarget(event.target)) {
        return
      }

      shiftSelectActiveRef.current = true
      setShiftSelectActive(true)
    }

    const handleShiftKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Shift') {
        return
      }
      shiftSelectActiveRef.current = false
      setShiftSelectActive(false)
    }

    const handleWindowBlur = () => {
      if (!shiftSelectActiveRef.current) {
        return
      }
      shiftSelectActiveRef.current = false
      setShiftSelectActive(false)
    }

    window.addEventListener('keydown', handleShiftKeyDown)
    window.addEventListener('keyup', handleShiftKeyUp)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('keydown', handleShiftKeyDown)
      window.removeEventListener('keyup', handleShiftKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  useLayoutEffect(() => {
    if (!isShortcutsOpen) {
      setShortcutsVisibleHeight(null)
      return
    }

    const listElement = shortcutsListRef.current
    if (!listElement) {
      return
    }

    const readGap = () => {
      const styles = window.getComputedStyle(listElement)
      const rawGap = styles.rowGap || styles.gap || '0'
      const parsedGap = Number.parseFloat(rawGap)
      return Number.isNaN(parsedGap) ? 0 : parsedGap
    }

    const updateHeight = () => {
      const elements = Array.from(listElement.children).slice(0, VISIBLE_SHORTCUT_COUNT)
      const items = elements.filter((element): element is HTMLElement => element instanceof HTMLElement)

      if (items.length === 0) {
        setShortcutsVisibleHeight(null)
        return
      }

      const totalHeight = items.reduce((total, item) => total + item.getBoundingClientRect().height, 0)
      const gap = readGap()
      const totalGap = Math.max(items.length - 1, 0) * gap
      setShortcutsVisibleHeight(Math.ceil(totalHeight + totalGap))
    }

    const animationId = window.requestAnimationFrame(updateHeight)
    window.addEventListener('resize', updateHeight)

    return () => {
      window.cancelAnimationFrame(animationId)
      window.removeEventListener('resize', updateHeight)
    }
  }, [isShortcutsOpen])

  const focusInput = useCallback((input: HTMLInputElement | null) => {
    if (!input) {
      return
    }

    requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  }, [])

  const requestTextEditorFocus = useCallback(() => {
    if (isToolbarCollapsed) {
      pendingTextFocusRef.current = true
      setToolbarCollapsed(false)
      return
    }

    pendingTextFocusRef.current = false
    focusInput(textInputRef.current)
  }, [focusInput, isToolbarCollapsed, setToolbarCollapsed])

  const measureAnnotation = useCallback(
    (annotation: MindMapAnnotation): AnnotationMetrics | null => {
      const context = contextRef.current
      if (!context) {
        return null
      }

      const textSize = normalizeTextSize(annotation.textSize)
      return measureAnnotationMetrics(context, annotation.text, textSize)
    },
    [],
  )

  const measureNodeLabel = useCallback(
    (node: MindMapNode): NodeLabelLayout => {
      const context = contextRef.current
      const textSize = normalizeTextSize(node.textSize)
      const label = node.text.length > 0 ? node.text : 'New Idea'

      if (!context) {
        const lineHeight = getNodeLineHeight(textSize)
        return {
          lines: [label],
          width: 0,
          height: lineHeight,
          lineHeight,
          radius: calculateNodeRadius(0, lineHeight),
        }
      }

      const previousFont = context.font
      context.font = getNodeFont(textSize)
      const layout = calculateNodeLabelLayout(context, label, textSize)
      const resolvedLayout = node.parentId !== null && label.length <= 24
        ? {
            lines: [label],
            width: context.measureText(label).width,
            height: getNodeLineHeight(textSize),
            lineHeight: getNodeLineHeight(textSize),
            radius: calculateNodeRadius(context.measureText(label).width, getNodeLineHeight(textSize)),
          }
        : layout
      context.font = previousFont

      return resolvedLayout
    },
    [],
  )

  const getNodeRadius = useCallback(
    (node: MindMapNode) => {
      const context = contextRef.current
      if (!context) {
        const textSize = normalizeTextSize(node.textSize)
        return calculateNodeRadius(0, getNodeLineHeight(textSize))
      }

      const layout = measureNodeLabel(node)
      return layout.radius
    },
    [measureNodeLabel],
  )

  useEffect(() => {
    setTextDraft(selectedTextTarget?.text ?? '')
  }, [selectedTextTarget])

  useEffect(() => {
    if (!isToolbarCollapsed && pendingTextFocusRef.current) {
      pendingTextFocusRef.current = false
      focusInput(textInputRef.current)
    }
  }, [focusInput, isToolbarCollapsed, selectedTextTarget])

  const closeExportMenu = useCallback(() => {
    setExportMenuOpen(false)
  }, [])

  const closeShortcutsMenu = useCallback(() => {
    setShortcutsOpen(false)
  }, [])

  const toggleExportMenu = useCallback(() => {
    setShortcutsOpen(false)
    setExportMenuOpen((previous) => !previous)
  }, [])

  const toggleShortcutsMenu = useCallback(() => {
    setExportMenuOpen(false)
    setShortcutsOpen((previous) => !previous)
  }, [])

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((previous) => !previous)
  }, [])

  const toggleActionsCollapsed = useCallback(() => {
    setActionsCollapsed((previous) => !previous)
  }, [])

  const toggleLock = useCallback(() => {
    setIsLocked((previous) => !previous)
  }, [])

  const toggleBackgroundTheme = useCallback(() => {
    setBackgroundTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))
  }, [])

  const toggleGridMode = useCallback(() => {
    setIsGridModeEnabled((previous) => !previous)
  }, [])

  const drawScene = useCallback(() => {
    const context = contextRef.current
    if (!context) {
      return
    }

    const { width, height } = sizeRef.current
    if (width === 0 || height === 0) {
      return
    }

    const nodesToDraw = nodesRef.current
    const selectedIds = new Set(selectedNodeRef.current)
    const annotationsToDraw = annotationsRef.current
    const selectedAnnotationId = selectedAnnotationRef.current
    const shapesToDraw = shapesRef.current
    const selectedShapeId = selectedShapeRef.current
    const crossLinksToDraw = crossLinksRef.current
    const { scale, offsetX, offsetY } = viewRef.current

    context.clearRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2
    const nodeMap = new Map(nodesToDraw.map((node) => [node.id, node]))

    context.save()
    context.translate(centerX + offsetX, centerY + offsetY)
    context.scale(scale, scale)

    if (gridModeRef.current) {
      const gridSpacing = GRIDLINE_SPACING
      const majorInterval = Math.max(1, GRIDLINE_MAJOR_INTERVAL)
      const minorColor =
        backgroundTheme === 'dark' ? GRIDLINE_COLOR_DARK : GRIDLINE_COLOR_LIGHT
      const majorColor =
        backgroundTheme === 'dark' ? GRIDLINE_MAJOR_COLOR_DARK : GRIDLINE_MAJOR_COLOR_LIGHT
      const axisColor =
        backgroundTheme === 'dark' ? GRIDLINE_AXIS_COLOR_DARK : GRIDLINE_AXIS_COLOR_LIGHT

      const viewLeft = (-centerX - offsetX) / scale
      const viewRight = (centerX - offsetX) / scale
      const viewTop = (-centerY - offsetY) / scale
      const viewBottom = (centerY - offsetY) / scale

      const firstVerticalIndex = Math.floor(viewLeft / gridSpacing)
      const lastVerticalIndex = Math.ceil(viewRight / gridSpacing)
      const firstHorizontalIndex = Math.floor(viewTop / gridSpacing)
      const lastHorizontalIndex = Math.ceil(viewBottom / gridSpacing)

      const baseLineWidth = Math.max(0.75 / scale, 0.35 / scale)
      const majorLineWidth = Math.max(baseLineWidth * 1.6, baseLineWidth + 0.4 / scale)

      const isMajorIndex = (index: number) =>
        ((index % majorInterval) + majorInterval) % majorInterval === 0

      context.save()
      context.lineCap = 'butt'

      for (let index = firstVerticalIndex; index <= lastVerticalIndex; index += 1) {
        const x = index * gridSpacing
        context.beginPath()
        context.moveTo(x, viewTop)
        context.lineTo(x, viewBottom)
        if (index === 0) {
          context.lineWidth = majorLineWidth
          context.strokeStyle = axisColor
        } else if (isMajorIndex(index)) {
          context.lineWidth = majorLineWidth
          context.strokeStyle = majorColor
        } else {
          context.lineWidth = baseLineWidth
          context.strokeStyle = minorColor
        }
        context.stroke()
      }

      for (let index = firstHorizontalIndex; index <= lastHorizontalIndex; index += 1) {
        const y = index * gridSpacing
        context.beginPath()
        context.moveTo(viewLeft, y)
        context.lineTo(viewRight, y)
        if (index === 0) {
          context.lineWidth = majorLineWidth
          context.strokeStyle = axisColor
        } else if (isMajorIndex(index)) {
          context.lineWidth = majorLineWidth
          context.strokeStyle = majorColor
        } else {
          context.lineWidth = baseLineWidth
          context.strokeStyle = minorColor
        }
        context.stroke()
      }

      context.restore()
    }

    shapesToDraw.forEach((shape) => {
      context.save()
      const selectionColor = backgroundTheme === 'dark' ? '#dff9fc' : '#087f9d'

      if (shape.kind === 'ring') {
        const radius = Math.max(shape.radius, 0)
        const strokeWidth = Math.max(1, shape.thickness)
        const strokeColor = shape.color || RING_DEFAULT_COLOR
        applyShapeGlow(context, strokeColor, backgroundTheme)
        context.lineWidth = strokeWidth
        context.strokeStyle = strokeColor
        context.beginPath()
        context.arc(shape.x, shape.y, radius, 0, Math.PI * 2)
        context.stroke()
        clearCanvasShadow(context)

        if (shape.id === selectedShapeId) {
          context.lineWidth = Math.max(1.5 / scale, 1)
          context.strokeStyle = selectionColor
          context.setLineDash([5 / scale, 4 / scale])
          context.beginPath()
          context.arc(shape.x, shape.y, radius, 0, Math.PI * 2)
          context.stroke()

          const handleX = shape.x + radius
          const handleY = shape.y
          drawShapeHandle(context, handleX, handleY, scale, backgroundTheme)
        }

        context.restore()
        return
      }

      if (shape.kind === 'ellipse') {
        const radiusX = Math.max(shape.radiusX, 0)
        const radiusY = Math.max(shape.radiusY, 0)
        const strokeWidth = Math.max(1, shape.thickness)
        const strokeColor = shape.color || ELLIPSE_DEFAULT_COLOR

        applyShapeGlow(context, strokeColor, backgroundTheme)
        context.beginPath()
        context.ellipse(shape.x, shape.y, radiusX, radiusY, 0, 0, Math.PI * 2)
        context.lineWidth = strokeWidth
        context.strokeStyle = strokeColor
        context.stroke()
        clearCanvasShadow(context)

        if (shape.id === selectedShapeId) {
          context.lineWidth = Math.max(1.5 / scale, 1)
          context.strokeStyle = selectionColor
          context.setLineDash([5 / scale, 4 / scale])
          context.beginPath()
          context.ellipse(shape.x, shape.y, radiusX, radiusY, 0, 0, Math.PI * 2)
          context.stroke()

          const handleX = shape.x + radiusX
          const handleY = shape.y + radiusY
          drawShapeHandle(context, handleX, handleY, scale, backgroundTheme)
        }

        context.restore()
        return
      }

      if (shape.kind === 'rectangle') {
        const width = Math.max(shape.width, 0)
        const height = Math.max(shape.height, 0)
        const halfWidth = width / 2
        const halfHeight = height / 2
        const strokeWidth = Math.max(1, shape.thickness)
        const strokeColor = shape.color || RECTANGLE_DEFAULT_COLOR

        applyShapeGlow(context, strokeColor, backgroundTheme)
        context.lineWidth = strokeWidth
        context.strokeStyle = strokeColor
        context.strokeRect(shape.x - halfWidth, shape.y - halfHeight, width, height)
        clearCanvasShadow(context)

        if (shape.id === selectedShapeId) {
          context.lineWidth = Math.max(1.5 / scale, 1)
          context.strokeStyle = selectionColor
          context.setLineDash([5 / scale, 4 / scale])
          context.strokeRect(shape.x - halfWidth, shape.y - halfHeight, width, height)

          const handleX = shape.x + halfWidth
          const handleY = shape.y + halfHeight
          drawShapeHandle(context, handleX, handleY, scale, backgroundTheme)
        }

        context.restore()
        return
      }

      if (shape.kind === 'arrow') {
        const polygon = buildArrowPolygon(shape)
        const fillColor = shape.color || ARROW_DEFAULT_COLOR

        applyShapeGlow(context, fillColor, backgroundTheme)
        context.lineJoin = 'round'
        context.lineCap = 'round'
        tracePolygon(context, polygon)
        context.fillStyle = fillColor
        context.fill()

        const outlineWidth = Math.max(1.2, Math.min(shape.thickness / 10, 2.6))
        context.lineWidth = outlineWidth
        context.strokeStyle = fillColor
        context.stroke()
        clearCanvasShadow(context)

        if (shape.id === selectedShapeId) {
          context.lineWidth = Math.max(1.5 / scale, outlineWidth)
          context.strokeStyle = selectionColor
          context.setLineDash([5 / scale, 4 / scale])
          context.stroke()

          const geometry = getArrowGeometry(shape)
          const handlePoint = rotateAndTranslate(
            { x: geometry.halfWidth, y: geometry.halfHeight },
            { x: shape.x, y: shape.y },
            shape.angle ?? 0,
          )
          drawShapeHandle(context, handlePoint.x, handlePoint.y, scale, backgroundTheme)
        }

        context.restore()
        return
      }

      if (shape.kind === 'line') {
        const geometry = getLineGeometry(shape)
        const angle = shape.angle ?? 0
        const center = { x: shape.x, y: shape.y }
        const color = shape.color || LINE_DEFAULT_COLOR
        const start = rotateAndTranslate({ x: -geometry.halfLength, y: 0 }, center, angle)
        const end = rotateAndTranslate({ x: geometry.halfLength, y: 0 }, center, angle)
        const strokeWidth = Math.max(geometry.halfThickness * 2, LINE_MIN_THICKNESS)

        applyShapeGlow(context, color, backgroundTheme)
        context.lineCap = 'round'
        context.strokeStyle = color
        context.lineWidth = strokeWidth
        context.beginPath()
        context.moveTo(start.x, start.y)
        context.lineTo(end.x, end.y)
        context.stroke()
        clearCanvasShadow(context)

        if (shape.id === selectedShapeId) {
          context.beginPath()
          context.moveTo(start.x, start.y)
          context.lineTo(end.x, end.y)
          context.lineWidth = Math.max(1.5 / scale, 1)
          context.strokeStyle = selectionColor
          context.setLineDash([5 / scale, 4 / scale])
          context.stroke()

          const handlePoint = rotateAndTranslate(
            { x: geometry.halfLength, y: 0 },
            center,
            angle,
          )
          drawShapeHandle(context, handlePoint.x, handlePoint.y, scale, backgroundTheme)
        }

      context.restore()
      return
    }

    context.restore()
  })

    const nodeLayouts = new Map<string, NodeLabelLayout>()
    nodesToDraw.forEach((node) => {
      nodeLayouts.set(node.id, measureNodeLabel(node))
    })

    const connectionStrokeStyle =
      backgroundTheme === 'dark' ? 'rgba(151, 184, 199, 0.48)' : 'rgba(51, 83, 98, 0.38)'
    const connectionLineWidth = 2
    const connectionHighlightWidth = Math.max(connectionLineWidth + 1.5, 3.5)

    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = connectionLineWidth
    context.strokeStyle = connectionStrokeStyle

    nodesToDraw.forEach((node) => {
      if (!node.parentId) {
        return
      }

      const parent = nodeMap.get(node.parentId)
      if (!parent) {
        return
      }

      context.beginPath()
      context.moveTo(parent.x, parent.y)
      context.lineTo(node.x, node.y)
      context.stroke()
    })

    if (crossLinksToDraw.length > 0) {
      const crossLinkStrokeStyle =
        backgroundTheme === 'dark' ? CROSS_LINK_COLOR_DARK : CROSS_LINK_COLOR_LIGHT
      context.lineWidth = CROSS_LINK_STROKE_WIDTH
      context.strokeStyle = crossLinkStrokeStyle

      crossLinksToDraw.forEach((link) => {
        const source = nodeMap.get(link.sourceId)
        const target = nodeMap.get(link.targetId)
        if (!source || !target) {
          return
        }

        const sourceLayout = nodeLayouts.get(source.id)
        const targetLayout = nodeLayouts.get(target.id)
        if (!sourceLayout || !targetLayout) {
          return
        }

        const dx = target.x - source.x
        const dy = target.y - source.y
        const distance = Math.hypot(dx, dy)
        if (!Number.isFinite(distance) || distance < 1) {
          return
        }

        const midpointX = (source.x + target.x) / 2
        const midpointY = (source.y + target.y) / 2
        const baseOffset = Math.max(
          CROSS_LINK_MIN_CURVE_OFFSET,
          distance * CROSS_LINK_CURVE_SCALE,
        )
        const perpX = (-dy / distance) * baseOffset
        const perpY = (dx / distance) * baseOffset

        const controlCandidates = [
          { x: midpointX + perpX, y: midpointY + perpY },
          { x: midpointX - perpX, y: midpointY - perpY },
        ]

        const clearanceScores = controlCandidates.map((candidate) => {
          let clearance = Infinity
          nodesToDraw.forEach((node) => {
            const layout = nodeLayouts.get(node.id)
            if (!layout) {
              return
            }
            const radius = layout.radius
            const distanceToCandidate =
              Math.hypot(candidate.x - node.x, candidate.y - node.y) - radius
            clearance = Math.min(clearance, distanceToCandidate)
          })
          return clearance
        })

        const bestIndex = clearanceScores[0] >= clearanceScores[1] ? 0 : 1
        const control = controlCandidates[bestIndex]

        const startDirection = normalizeVector(control.x - source.x, control.y - source.y)
        const endDirection = normalizeVector(target.x - control.x, target.y - control.y)

        const startPoint = {
          x: source.x + startDirection.x * sourceLayout.radius,
          y: source.y + startDirection.y * sourceLayout.radius,
        }

        const endPoint = {
          x: target.x - endDirection.x * targetLayout.radius,
          y: target.y - endDirection.y * targetLayout.radius,
        }

        context.beginPath()
        context.moveTo(startPoint.x, startPoint.y)
        context.quadraticCurveTo(control.x, control.y, endPoint.x, endPoint.y)
        context.stroke()
      })

      context.lineWidth = connectionLineWidth
      context.strokeStyle = connectionStrokeStyle
    }

    nodesToDraw.forEach((node) => {
      const nodeX = node.x
      const nodeY = node.y
      const layout = nodeLayouts.get(node.id) ?? measureNodeLabel(node)
      const radius = layout.radius
      const visual = getNodeVisualMetrics(layout, node.parentId === null)

      const nodeColor = node.color || DEFAULT_NODE_COLOR
      context.save()
      context.shadowColor = backgroundTheme === 'dark' ? nodeColor : 'rgba(20, 48, 61, 0.12)'
      context.shadowBlur = backgroundTheme === 'dark' ? (selectedIds.has(node.id) ? 22 : 9) : 6
      context.fillStyle = backgroundTheme === 'dark' ? 'rgba(10, 17, 23, 0.94)' : 'rgba(250, 252, 253, 0.96)'
      context.strokeStyle = nodeColor
      context.lineWidth = node.parentId === null ? 3 : 2
      context.beginPath()
      if (visual.kind === 'circle') {
        context.arc(nodeX, nodeY, radius, 0, Math.PI * 2)
      } else {
        context.roundRect(
          nodeX - visual.width / 2,
          nodeY - visual.height / 2,
          visual.width,
          visual.height,
          visual.cornerRadius,
        )
      }
      context.fill()
      context.stroke()
      context.restore()

      if (selectedIds.has(node.id)) {
        context.lineWidth = connectionHighlightWidth + 1
        context.strokeStyle = backgroundTheme === 'dark' ? '#9eeaff' : '#067fa3'
        context.stroke()
        context.lineWidth = connectionLineWidth
        context.strokeStyle = connectionStrokeStyle
      }

      context.fillStyle = backgroundTheme === 'dark' ? '#eef4f8' : '#152631'
      const previousFont = context.font
      const nodeTextSize = normalizeTextSize(node.textSize)
      context.font = getNodeFont(nodeTextSize)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const lines = layout.lines
      const lineHeight = layout.lineHeight
      const lineCount = lines.length
      if (lineCount === 0) {
        context.font = previousFont
        return
      }
      const firstLineY = nodeY - ((lineCount - 1) * lineHeight) / 2

      lines.forEach((line, index) => {
        const lineY = firstLineY + index * lineHeight
        context.fillText(line, nodeX, lineY)
      })
      context.font = previousFont
    })

    context.textAlign = 'center'
    context.textBaseline = 'middle'

    annotationsToDraw.forEach((annotation) => {
      const metrics = measureAnnotation(annotation)
      const annotationTextSize = normalizeTextSize(annotation.textSize)
      context.fillStyle = backgroundTheme === 'dark' ? '#eef4f8' : '#152631'
      const previousFont = context.font
      const annotationFont = metrics?.font ?? getAnnotationFont(annotationTextSize)
      context.font = annotationFont
      if (annotation.id === selectedAnnotationId) {
        context.shadowColor = backgroundTheme === 'dark' ? '#6ddcff' : 'rgba(6, 127, 163, 0.32)'
        context.shadowBlur = backgroundTheme === 'dark' ? 12 : 7
      }
      context.fillText(
        annotation.text.length > 0 ? annotation.text : 'New text',
        annotation.x,
        annotation.y,
      )
      clearCanvasShadow(context)
      context.font = previousFont
    })

    context.restore()
  }, [backgroundTheme, measureAnnotation, measureNodeLabel])

  useEffect(() => {
    gridModeRef.current = isGridModeEnabled
    drawScene()
  }, [isGridModeEnabled, drawScene])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    if (!isSelectionModeActive) {
      const interaction = interactionRef.current
      const hasActiveMarquee =
        interaction?.mode === 'marquee' && canvas.hasPointerCapture(interaction.pointerId)

      if (!hasActiveMarquee) {
        setSelectionMarquee(null)
      }

      if (interaction?.mode === 'marquee' && !canvas.hasPointerCapture(interaction.pointerId)) {
        interactionRef.current = null
      }
    }

    if (!interactionRef.current) {
      canvas.style.cursor = isSelectionModeActive ? 'crosshair' : 'grab'
    }
  }, [isSelectionModeActive])

  useEffect(() => {
    viewRef.current = viewTransform
    drawScene()
  }, [viewTransform, drawScene])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const context = contextRef.current
    if (!canvas || !context) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const cssWidth = window.innerWidth
    const cssHeight = window.innerHeight

    sizeRef.current = { width: cssWidth, height: cssHeight }

    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawScene()

    if (!hasAutoCenteredRef.current) {
      const fitTransform = calculateFitView(nodesRef.current, sizeRef.current, getNodeRadius)
      if (fitTransform) {
        hasAutoCenteredRef.current = true
        setViewTransform(fitTransform)
      }
    }
  }, [drawScene, getNodeRadius])

  useEffect(() => {
    nodesRef.current = nodes
    annotationsRef.current = annotations
    selectedNodeRef.current = [...selectedNodeIds]
    selectedAnnotationRef.current = selectedAnnotationId
    shapesRef.current = shapes
    selectedShapeRef.current = selectedShapeId
    crossLinksRef.current = crossLinks
    drawScene()
  }, [
    annotations,
    crossLinks,
    nodes,
    selectedAnnotationId,
    selectedNodeIds,
    selectedShapeId,
    shapes,
    drawScene,
  ])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      const menu = exportMenuRef.current
      if (menu && !menu.contains(target)) {
        closeExportMenu()
      }

      const shortcutsMenu = shortcutsMenuRef.current
      if (shortcutsMenu && !shortcutsMenu.contains(target)) {
        closeShortcutsMenu()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeExportMenu()
        closeShortcutsMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeExportMenu, closeShortcutsMenu])

  const adjustZoom = useCallback((factor: number, pivot?: { screenX: number; screenY: number }) => {
    setViewTransform((previous) => {
      hasAutoCenteredRef.current = true
      const nextScale = clamp(previous.scale * factor, MIN_ZOOM, MAX_ZOOM)
      if (nextScale === previous.scale) {
        return previous
      }

      if (pivot) {
        const { width, height } = sizeRef.current
        const centerX = width / 2
        const centerY = height / 2
        const worldX = (pivot.screenX - centerX - previous.offsetX) / previous.scale
        const worldY = (pivot.screenY - centerY - previous.offsetY) / previous.scale

        return {
          scale: nextScale,
          offsetX: pivot.screenX - centerX - nextScale * worldX,
          offsetY: pivot.screenY - centerY - nextScale * worldY,
        }
      }

      const worldCenterX = -previous.offsetX / previous.scale
      const worldCenterY = -previous.offsetY / previous.scale

      return {
        scale: nextScale,
        offsetX: -worldCenterX * nextScale,
        offsetY: -worldCenterY * nextScale,
      }
    })
  }, [])

  const handleZoomIn = useCallback(() => {
    adjustZoom(ZOOM_STEP)
  }, [adjustZoom])

  const handleZoomOut = useCallback(() => {
    adjustZoom(1 / ZOOM_STEP)
  }, [adjustZoom])

  const handleResetView = useCallback(() => {
    const fitTransform = calculateFitView(nodes, sizeRef.current, getNodeRadius)
    if (fitTransform) {
      hasAutoCenteredRef.current = true
      setViewTransform(fitTransform)
      return
    }

    setViewTransform({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    })
  }, [getNodeRadius, nodes])

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
    resizeCanvas()

    const defaultCursor = isSelectionModeActive ? 'crosshair' : 'grab'
    canvas.style.cursor = defaultCursor

    const getCanvasPoint = (event: PointerEvent | WheelEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    }

    const getScenePointFromCanvas = (x: number, y: number) => {
      const { width, height } = sizeRef.current
      const { scale, offsetX, offsetY } = viewRef.current
      const centerX = width / 2
      const centerY = height / 2

      return {
        x: (x - centerX - offsetX) / scale,
        y: (y - centerY - offsetY) / scale,
      }
    }

    const getScenePoint = (event: PointerEvent) => {
      const { x, y } = getCanvasPoint(event)
      return getScenePointFromCanvas(x, y)
    }

    const finishInteraction = (pointerId: number, shouldDeselect: boolean) => {
      const interaction = interactionRef.current
      if (!interaction || interaction.pointerId !== pointerId) {
        return
      }

      if (interaction.mode === 'pan' && shouldDeselect && !interaction.moved) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
      } else if (interaction.mode === 'marquee') {
        setSelectionMarquee(null)
      }

      interactionRef.current = null

      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId)
      }

      canvas.style.cursor = defaultCursor
    }

    const selectionsMatch = (previous: string[] | null, next: string[]) => {
      if (!previous) {
        return false
      }
      if (previous.length !== next.length) {
        return false
      }
      for (let index = 0; index < previous.length; index += 1) {
        if (previous[index] !== next[index]) {
          return false
        }
      }
      return true
    }

    const computeMarqueeSelection = (interaction: {
      startSceneX: number
      startSceneY: number
      currentSceneX: number
      currentSceneY: number
      additive: boolean
      initialSelection: string[]
    }) => {
      const minX = Math.min(interaction.startSceneX, interaction.currentSceneX)
      const maxX = Math.max(interaction.startSceneX, interaction.currentSceneX)
      const minY = Math.min(interaction.startSceneY, interaction.currentSceneY)
      const maxY = Math.max(interaction.startSceneY, interaction.currentSceneY)

      const insideIds = new Set<string>()
      for (const node of nodesRef.current) {
        if (node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY) {
          insideIds.add(node.id)
        }
      }

      if (interaction.additive) {
        const baseline = [...interaction.initialSelection]
        const baselineSet = new Set(baseline)
        for (const node of nodesRef.current) {
          if (insideIds.has(node.id) && !baselineSet.has(node.id)) {
            baseline.push(node.id)
          }
        }
        return baseline
      }

      const selection: string[] = []
      for (const node of nodesRef.current) {
        if (insideIds.has(node.id)) {
          selection.push(node.id)
        }
      }
      return selection
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        return
      }

      const canvasPoint = getCanvasPoint(event)
      const scenePoint = getScenePointFromCanvas(canvasPoint.x, canvasPoint.y)
      const { scale } = viewRef.current
      const handleHalfSize = SHAPE_HANDLE_SCREEN_SIZE / scale / 2

      const hitResizeShape = [...shapesRef.current]
        .reverse()
        .find((shape) => {
          if (shape.kind === 'ring') {
            const radius = Math.max(shape.radius, 0)
            const handleX = shape.x + radius
            const handleY = shape.y

            return (
              scenePoint.x >= handleX - handleHalfSize &&
              scenePoint.x <= handleX + handleHalfSize &&
              scenePoint.y >= handleY - handleHalfSize &&
              scenePoint.y <= handleY + handleHalfSize
            )
          }

          if (shape.kind === 'ellipse') {
            const radiusX = Math.max(shape.radiusX, 0)
            const radiusY = Math.max(shape.radiusY, 0)
            const handleX = shape.x + radiusX
            const handleY = shape.y + radiusY

            return (
              scenePoint.x >= handleX - handleHalfSize &&
              scenePoint.x <= handleX + handleHalfSize &&
              scenePoint.y >= handleY - handleHalfSize &&
              scenePoint.y <= handleY + handleHalfSize
            )
          }

          if (shape.kind === 'rectangle') {
            const halfWidth = Math.max(shape.width, 0) / 2
            const halfHeight = Math.max(shape.height, 0) / 2
            const handleX = shape.x + halfWidth
            const handleY = shape.y + halfHeight

            return (
              scenePoint.x >= handleX - handleHalfSize &&
              scenePoint.x <= handleX + handleHalfSize &&
              scenePoint.y >= handleY - handleHalfSize &&
              scenePoint.y <= handleY + handleHalfSize
            )
          }

          if (shape.kind === 'arrow') {
            const geometry = getArrowGeometry(shape)
            const localPoint = toLocalCoordinates(
              scenePoint,
              { x: shape.x, y: shape.y },
              shape.angle ?? 0,
            )

            return (
              localPoint.x >= geometry.halfWidth - handleHalfSize &&
              localPoint.x <= geometry.halfWidth + handleHalfSize &&
              localPoint.y >= geometry.halfHeight - handleHalfSize &&
              localPoint.y <= geometry.halfHeight + handleHalfSize
            )
          }

          if (shape.kind === 'line') {
            const geometry = getLineGeometry(shape)
            const localPoint = toLocalCoordinates(
              scenePoint,
              { x: shape.x, y: shape.y },
              shape.angle ?? 0,
            )

            return (
              localPoint.x >= geometry.halfLength - handleHalfSize &&
              localPoint.x <= geometry.halfLength + handleHalfSize &&
              localPoint.y >= -handleHalfSize &&
              localPoint.y <= handleHalfSize
            )
          }

          return false
        })

      if (hitResizeShape) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: hitResizeShape.id })

        if (isLocked) {
          event.preventDefault()
          return
        }

        interactionRef.current = {
          mode: 'shape-resize',
          pointerId: event.pointerId,
          shapeId: hitResizeShape.id,
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
        return
      }

      const hitNode = [...nodesRef.current]
        .reverse()
        .find((node) => Math.hypot(scenePoint.x - node.x, scenePoint.y - node.y) <= getNodeRadius(node))

      if (hitNode) {
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        const existingSelection = [...selectedNodeRef.current]
        const isAlreadySelected = existingSelection.includes(hitNode.id)
        const isModifierPressed = event.shiftKey || event.metaKey || event.ctrlKey

        if (isModifierPressed) {
          const toggledSelection = isAlreadySelected
            ? existingSelection.filter((id) => id !== hitNode.id)
            : [...existingSelection, hitNode.id]

          selectedNodeRef.current = [...toggledSelection]
          dispatch({ type: 'TOGGLE_NODE_SELECTION', nodeId: hitNode.id })
          event.preventDefault()
          return
        }

        let nextSelection = [...existingSelection]
        let shouldUpdateSelection = false

        if (isAlreadySelected) {
          if (existingSelection.length > 1) {
            const reordered = [hitNode.id, ...existingSelection.filter((id) => id !== hitNode.id)]
            const orderChanged = reordered.some((id, index) => id !== existingSelection[index])
            if (orderChanged) {
              nextSelection = reordered
              shouldUpdateSelection = true
            }
          }
        } else {
          nextSelection = [hitNode.id]
          shouldUpdateSelection = true
        }

        if (shouldUpdateSelection) {
          dispatch({ type: 'SET_SELECTED_NODES', nodeIds: nextSelection })
        }

        selectedNodeRef.current = [...nextSelection]

        if (isSelectionModeActive) {
          event.preventDefault()
          return
        }

        if (isLocked) {
          event.preventDefault()
          return
        }

        const selectedForMove = nextSelection.length > 0 ? nextSelection : [hitNode.id]

        if (selectedForMove.length > 1) {
          const startPositions = selectedForMove
            .map((nodeId) => {
              const node = nodesRef.current.find((nodeItem) => nodeItem.id === nodeId)
              return node ? { nodeId, startX: node.x, startY: node.y } : null
            })
            .filter((value): value is { nodeId: string; startX: number; startY: number } => value !== null)

          if (startPositions.length > 1) {
            interactionRef.current = {
              mode: 'nodes',
              pointerId: event.pointerId,
              startSceneX: scenePoint.x,
              startSceneY: scenePoint.y,
              positions: startPositions,
            }
          } else {
            interactionRef.current = {
              mode: 'node',
              pointerId: event.pointerId,
              nodeId: hitNode.id,
              offsetX: scenePoint.x - hitNode.x,
              offsetY: scenePoint.y - hitNode.y,
            }
          }
        } else {
          interactionRef.current = {
            mode: 'node',
            pointerId: event.pointerId,
            nodeId: hitNode.id,
            offsetX: scenePoint.x - hitNode.x,
            offsetY: scenePoint.y - hitNode.y,
          }
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
        return
      }

      const hitAnnotation = [...annotationsRef.current]
        .reverse()
        .find((annotation) => {
          const metrics = measureAnnotation(annotation)
          if (!metrics) {
            return false
          }

          const halfWidth = metrics.width / 2
          const halfHeight = metrics.height / 2

          return (
            scenePoint.x >= annotation.x - halfWidth &&
            scenePoint.x <= annotation.x + halfWidth &&
            scenePoint.y >= annotation.y - halfHeight &&
            scenePoint.y <= annotation.y + halfHeight
          )
        })

      if (hitAnnotation) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: hitAnnotation.id })

        if (isLocked) {
          event.preventDefault()
          return
        }

        interactionRef.current = {
          mode: 'annotation',
          pointerId: event.pointerId,
          annotationId: hitAnnotation.id,
          offsetX: scenePoint.x - hitAnnotation.x,
          offsetY: scenePoint.y - hitAnnotation.y,
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
        return
      }

      const hitShape = [...shapesRef.current]
        .reverse()
        .find((shape) => {
          if (shape.kind === 'ring') {
            const radius = Math.max(shape.radius, 0)
            const distance = Math.hypot(scenePoint.x - shape.x, scenePoint.y - shape.y)
            const hitBand = Math.max(1, shape.thickness / 2 + RING_HIT_PADDING)
            const outerRadius = radius + hitBand
            const innerRadius = Math.max(0, radius - hitBand)

            return distance <= outerRadius && distance >= innerRadius
          }

          if (shape.kind === 'ellipse') {
            const radiusX = Math.max(shape.radiusX, 1)
            const radiusY = Math.max(shape.radiusY, 1)
            const dx = scenePoint.x - shape.x
            const dy = scenePoint.y - shape.y
            const hitBand = Math.max(1, shape.thickness / 2 + ELLIPSE_HIT_PADDING)
            const outerRadiusX = radiusX + hitBand
            const outerRadiusY = radiusY + hitBand

            const outerNormalized =
              (dx * dx) / (outerRadiusX * outerRadiusX) + (dy * dy) / (outerRadiusY * outerRadiusY)

            if (!Number.isFinite(outerNormalized) || outerNormalized > 1) {
              return false
            }

            const innerRadiusX = radiusX - hitBand
            const innerRadiusY = radiusY - hitBand

            if (innerRadiusX <= 0 || innerRadiusY <= 0) {
              return true
            }

            const innerNormalized =
              (dx * dx) / (innerRadiusX * innerRadiusX) + (dy * dy) / (innerRadiusY * innerRadiusY)

            return !Number.isFinite(innerNormalized) || innerNormalized >= 1
          }

          if (shape.kind === 'rectangle') {
            const halfWidth = Math.max(shape.width, 1) / 2
            const halfHeight = Math.max(shape.height, 1) / 2
            const hitBand = Math.max(1, shape.thickness / 2 + RECTANGLE_HIT_PADDING)
            const outerHalfWidth = halfWidth + hitBand
            const outerHalfHeight = halfHeight + hitBand

            const withinOuter =
              scenePoint.x >= shape.x - outerHalfWidth &&
              scenePoint.x <= shape.x + outerHalfWidth &&
              scenePoint.y >= shape.y - outerHalfHeight &&
              scenePoint.y <= shape.y + outerHalfHeight

            if (!withinOuter) {
              return false
            }

            const innerHalfWidth = halfWidth - hitBand
            const innerHalfHeight = halfHeight - hitBand

            if (innerHalfWidth <= 0 || innerHalfHeight <= 0) {
              return true
            }

            const withinInner =
              scenePoint.x > shape.x - innerHalfWidth &&
              scenePoint.x < shape.x + innerHalfWidth &&
              scenePoint.y > shape.y - innerHalfHeight &&
              scenePoint.y < shape.y + innerHalfHeight

            return !withinInner
          }

          if (shape.kind === 'arrow') {
            const polygon = buildArrowPolygon(shape, ARROW_HIT_PADDING)
            return isPointInPolygon(scenePoint, polygon)
          }

          if (shape.kind === 'line') {
            const geometry = getLineGeometry(shape)
            const localPoint = toLocalCoordinates(
              scenePoint,
              { x: shape.x, y: shape.y },
              shape.angle ?? 0,
            )
            const padding = LINE_HIT_PADDING
            const halfLength = geometry.halfLength
            const halfThickness = geometry.halfThickness

            const withinLength =
              localPoint.x >= -halfLength - padding && localPoint.x <= halfLength + padding

            if (!withinLength) {
              return false
            }

            return Math.abs(localPoint.y) <= halfThickness + padding
          }

          return false
        })

      if (hitShape) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: hitShape.id })

        if (isLocked) {
          event.preventDefault()
          return
        }

        interactionRef.current = {
          mode: 'shape-move',
          pointerId: event.pointerId,
          shapeId: hitShape.id,
          offsetX: scenePoint.x - hitShape.x,
          offsetY: scenePoint.y - hitShape.y,
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
        return
      }

      if (event.button === 0 || event.button === 1) {
        if (isSelectionModeActive && event.button === 0) {
          const additive = event.shiftKey || event.metaKey || event.ctrlKey
          interactionRef.current = {
            mode: 'marquee',
            pointerId: event.pointerId,
            startSceneX: scenePoint.x,
            startSceneY: scenePoint.y,
            startCanvasX: canvasPoint.x,
            startCanvasY: canvasPoint.y,
            currentSceneX: scenePoint.x,
            currentSceneY: scenePoint.y,
            currentCanvasX: canvasPoint.x,
            currentCanvasY: canvasPoint.y,
            initialSelection: [...selectedNodeRef.current],
            additive,
            appliedSelection: null,
          }
          setSelectionMarquee({
            startX: canvasPoint.x,
            startY: canvasPoint.y,
            currentX: canvasPoint.x,
            currentY: canvasPoint.y,
          })
          canvas.setPointerCapture(event.pointerId)
          canvas.style.cursor = 'crosshair'
          event.preventDefault()
          return
        }

        interactionRef.current = {
          mode: 'pan',
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startOffsetX: viewRef.current.offsetX,
          startOffsetY: viewRef.current.offsetY,
          moved: false,
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
        event.preventDefault()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current
      if (!interaction) {
        return
      }

      if (isLocked && interaction.mode !== 'pan' && interaction.mode !== 'marquee') {
        return
      }

      if (interaction.mode === 'marquee') {
        const { x, y } = getCanvasPoint(event)
        const scenePoint = getScenePointFromCanvas(x, y)

        interaction.currentSceneX = scenePoint.x
        interaction.currentSceneY = scenePoint.y
        interaction.currentCanvasX = x
        interaction.currentCanvasY = y

        setSelectionMarquee({
          startX: interaction.startCanvasX,
          startY: interaction.startCanvasY,
          currentX: x,
          currentY: y,
        })

        const nextSelection = computeMarqueeSelection(interaction)
        const hasChanged = !selectionsMatch(interaction.appliedSelection, nextSelection)
        if (hasChanged) {
          dispatch({
            type: 'SET_SELECTED_NODES',
            nodeIds: nextSelection,
          })
        }
        interaction.appliedSelection = [...nextSelection]
        selectedNodeRef.current = [...nextSelection]
        return
      }

      if (interaction.mode === 'nodes') {
        const scenePoint = getScenePoint(event)

        const deltaX = scenePoint.x - interaction.startSceneX
        const deltaY = scenePoint.y - interaction.startSceneY

        if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) {
          return
        }

        const updates = interaction.positions.map((position) => ({
          nodeId: position.nodeId,
          x: position.startX + deltaX,
          y: position.startY + deltaY,
        }))

        dispatch({
          type: 'MOVE_NODES',
          updates,
        })
        return
      }

      if (interaction.mode === 'node') {
        const scenePoint = getScenePoint(event)

        dispatch({
          type: 'MOVE_NODE',
          nodeId: interaction.nodeId,
          x: scenePoint.x - interaction.offsetX,
          y: scenePoint.y - interaction.offsetY,
        })
        return
      }

      if (interaction.mode === 'annotation') {
        const scenePoint = getScenePoint(event)

        dispatch({
          type: 'MOVE_ANNOTATION',
          annotationId: interaction.annotationId,
          x: scenePoint.x - interaction.offsetX,
          y: scenePoint.y - interaction.offsetY,
        })
        return
      }

      if (interaction.mode === 'shape-move') {
        const scenePoint = getScenePoint(event)
        const shape = shapesRef.current.find((item) => item.id === interaction.shapeId)
        if (!shape) {
          return
        }

        const unsnapped = {
          x: scenePoint.x - interaction.offsetX,
          y: scenePoint.y - interaction.offsetY,
        }
        const shouldSnap = gridModeRef.current && isSnapEligibleShape(shape)
        const target = shouldSnap ? snapPoint(unsnapped, GRIDLINE_SPACING) : unsnapped
        const deltaX = Math.abs(target.x - shape.x)
        const deltaY = Math.abs(target.y - shape.y)

        if (deltaX < GRID_SNAP_EPSILON && deltaY < GRID_SNAP_EPSILON) {
          return
        }

        dispatch({
          type: 'MOVE_SHAPE',
          shapeId: interaction.shapeId,
          x: target.x,
          y: target.y,
        })
        return
      }

      if (interaction.mode === 'shape-resize') {
        const scenePoint = getScenePoint(event)
        const shape = shapesRef.current.find((item) => item.id === interaction.shapeId)
        if (!shape) {
          return
        }

        const shouldSnap = gridModeRef.current && isSnapEligibleShape(shape)
        const pointer = shouldSnap ? snapPoint(scenePoint, GRIDLINE_SPACING) : scenePoint

        if (shape.kind === 'ring') {
          const distance = Math.hypot(pointer.x - shape.x, pointer.y - shape.y)
          const minRadius = Math.max(RING_MIN_RADIUS, shape.thickness / 2 + 4)
          const nextRadius = Math.max(minRadius, distance)

          if (Math.abs(nextRadius - shape.radius) < 0.5) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: { radius: nextRadius },
          })
          return
        }

        if (shape.kind === 'ellipse') {
          const deltaX = Math.abs(pointer.x - shape.x)
          const deltaY = Math.abs(pointer.y - shape.y)
          const minRadiusX = Math.max(ELLIPSE_MIN_RADIUS_X, shape.thickness / 2 + 6)
          const minRadiusY = Math.max(ELLIPSE_MIN_RADIUS_Y, shape.thickness / 2 + 6)
          const nextRadiusX = Math.max(minRadiusX, deltaX)
          const nextRadiusY = Math.max(minRadiusY, deltaY)

          if (
            Math.abs(nextRadiusX - shape.radiusX) < 0.5 &&
            Math.abs(nextRadiusY - shape.radiusY) < 0.5
          ) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: { radiusX: nextRadiusX, radiusY: nextRadiusY },
          })
          return
        }

        if (shape.kind === 'rectangle') {
          const deltaX = Math.abs(pointer.x - shape.x)
          const deltaY = Math.abs(pointer.y - shape.y)
          const minHalfWidth = Math.max(RECTANGLE_MIN_WIDTH / 2, shape.thickness / 2 + 6)
          const minHalfHeight = Math.max(RECTANGLE_MIN_HEIGHT / 2, shape.thickness / 2 + 6)
          const nextHalfWidth = Math.max(minHalfWidth, deltaX)
          const nextHalfHeight = Math.max(minHalfHeight, deltaY)
          const nextWidth = nextHalfWidth * 2
          const nextHeight = nextHalfHeight * 2

          if (
            Math.abs(nextWidth - shape.width) < 0.5 &&
            Math.abs(nextHeight - shape.height) < 0.5
          ) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: { width: nextWidth, height: nextHeight },
          })
          return
        }

        if (shape.kind === 'arrow') {
          const dx = pointer.x - shape.x
          const dy = pointer.y - shape.y
          const distance = Math.hypot(dx, dy)
          if (distance < 0.5) {
            return
          }

          const nextAngle = Math.atan2(dy, dx)
          const localPoint = toLocalCoordinates(
            pointer,
            { x: shape.x, y: shape.y },
            nextAngle,
          )
          const minHalfWidth = ARROW_MIN_WIDTH / 2
          const minHalfHeight = ARROW_MIN_HEIGHT / 2
          const nextHalfWidth = Math.max(minHalfWidth, Math.abs(localPoint.x))
          const rawHalfHeight = Math.max(minHalfHeight, Math.abs(localPoint.y))
          const nextWidth = nextHalfWidth * 2
          const thicknessLimit = Math.min(shape.thickness, rawHalfHeight * 2)
          const nextThickness = Math.max(ARROW_MIN_THICKNESS, thicknessLimit)
          const halfThickness = Math.max(nextThickness / 2, ARROW_MIN_THICKNESS / 2)
          const { headHalfHeight } = enforceArrowHeadHeights(rawHalfHeight, halfThickness)
          const nextHeight = headHalfHeight * 2

          if (
            Math.abs(nextWidth - shape.width) < 0.5 &&
            Math.abs(nextHeight - shape.height) < 0.5 &&
            Math.abs(nextThickness - shape.thickness) < 0.5 &&
            Math.abs(nextAngle - (shape.angle ?? 0)) < 0.01
          ) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: {
              width: nextWidth,
              height: nextHeight,
              thickness: nextThickness,
              angle: nextAngle,
            },
          })
          return
        }

        if (shape.kind === 'line') {
          const dx = pointer.x - shape.x
          const dy = pointer.y - shape.y
          const distance = Math.hypot(dx, dy)
          if (distance < 0.25) {
            return
          }

          const nextAngle = Math.atan2(dy, dx)
          const localPoint = toLocalCoordinates(
            pointer,
            { x: shape.x, y: shape.y },
            nextAngle,
          )
          const nextHalfLength = Math.max(LINE_MIN_LENGTH / 2, Math.abs(localPoint.x))
          const nextLength = nextHalfLength * 2
          const nextThickness = Math.max(LINE_MIN_THICKNESS, Math.abs(localPoint.y) * 2)

          if (
            Math.abs(nextLength - shape.length) < 0.5 &&
            Math.abs(nextThickness - shape.thickness) < 0.5 &&
            Math.abs(nextAngle - (shape.angle ?? 0)) < 0.01
          ) {
            return
          }

          dispatch({
            type: 'UPDATE_SHAPE',
            shapeId: shape.id,
            updates: {
              length: nextLength,
              thickness: nextThickness,
              angle: nextAngle,
            },
          })
          return
        }

        return
      }

      const deltaX = event.clientX - interaction.startClientX
      const deltaY = event.clientY - interaction.startClientY

      if (!interaction.moved && Math.hypot(deltaX, deltaY) > 2) {
        interaction.moved = true
      }

      setViewTransform((previous) => {
        hasAutoCenteredRef.current = true
        return {
          ...previous,
          offsetX: interaction.startOffsetX + deltaX,
          offsetY: interaction.startOffsetY + deltaY,
        }
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      const interaction = interactionRef.current
      if (interaction && interaction.pointerId === event.pointerId && interaction.mode === 'marquee') {
        if (!interaction.appliedSelection) {
          const finalSelection = computeMarqueeSelection(interaction)
          dispatch({
            type: 'SET_SELECTED_NODES',
            nodeIds: finalSelection,
          })
          interaction.appliedSelection = [...finalSelection]
          selectedNodeRef.current = [...finalSelection]
        } else {
          selectedNodeRef.current = [...interaction.appliedSelection]
        }
      }
      finishInteraction(event.pointerId, true)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      finishInteraction(event.pointerId, false)
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { x, y } = getCanvasPoint(event)
      const zoomFactor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      adjustZoom(zoomFactor, { screenX: x, screenY: y })
    }

    const handleDoubleClick = (event: MouseEvent) => {
      const { x, y } = getCanvasPoint(event)
      const scenePoint = getScenePointFromCanvas(x, y)

      const hitNode = [...nodesRef.current]
        .reverse()
        .find((node) => Math.hypot(scenePoint.x - node.x, scenePoint.y - node.y) <= getNodeRadius(node))

      if (hitNode) {
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: null })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SET_SELECTED_NODES', nodeIds: [hitNode.id] })
        setTextDraft(hitNode.text)
        if (isLocked) {
          event.preventDefault()
          return
        }
        requestTextEditorFocus()
        event.preventDefault()
        return
      }

      const hitAnnotation = [...annotationsRef.current]
        .reverse()
        .find((annotation) => {
          const metrics = measureAnnotation(annotation)
          if (!metrics) {
            return false
          }

          const halfWidth = metrics.width / 2
          const halfHeight = metrics.height / 2

          return (
            scenePoint.x >= annotation.x - halfWidth &&
            scenePoint.x <= annotation.x + halfWidth &&
            scenePoint.y >= annotation.y - halfHeight &&
            scenePoint.y <= annotation.y + halfHeight
          )
        })

      if (hitAnnotation) {
        dispatch({ type: 'CLEAR_SELECTED_NODES' })
        dispatch({ type: 'SELECT_SHAPE', shapeId: null })
        dispatch({ type: 'SELECT_ANNOTATION', annotationId: hitAnnotation.id })
        setTextDraft(hitAnnotation.text)
        if (isLocked) {
          event.preventDefault()
          return
        }
        requestTextEditorFocus()
        event.preventDefault()
      }
    }

    window.addEventListener('resize', resizeCanvas)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerCancel)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('dblclick', handleDoubleClick)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerCancel)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [
    adjustZoom,
    dispatch,
    isLocked,
    isSelectionModeActive,
    getNodeRadius,
    measureAnnotation,
    requestTextEditorFocus,
    resizeCanvas,
  ])

  const handleAddChild = useCallback(() => {
    if (isLocked) {
      return
    }

    if (nodes.length === 0) {
      return
    }

    const rootNode = nodes.find((node) => node.parentId === null)
    const parent = primarySelectedNode ?? rootNode ?? nodes[0]

    if (!parent) {
      return
    }

    const siblings = nodes.filter((node) => node.parentId === parent.id)
    const angle = (siblings.length * Math.PI) / 3
    const distance = LINK_DISTANCE + siblings.length * 10
    const nextX = parent.x + Math.cos(angle) * distance
    const nextY = parent.y + Math.sin(angle) * distance
    const nodeColor = getNextNodeColor(parent.color)

    const newNodeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `node-${Date.now()}-${Math.random().toString(16).slice(2)}`

    const defaultText = 'New Idea'

    dispatch({
      type: 'ADD_NODE',
      node: {
        id: newNodeId,
        parentId: parent.id,
        text: defaultText,
        x: nextX,
        y: nextY,
        color: nodeColor,
        textSize: 'medium',
      },
    })
    dispatch({ type: 'SET_SELECTED_NODES', nodeIds: [newNodeId] })
    setTextDraft(defaultText)
    requestTextEditorFocus()
  }, [dispatch, isLocked, nodes, primarySelectedNode, requestTextEditorFocus])

  const handleAddCrossLink = useCallback(() => {
    if (isLocked) {
      return
    }

    if (selectedNodes.length < 2) {
      return
    }

    const [firstNode, secondNode] = selectedNodes
    if (!firstNode || !secondNode) {
      return
    }

    const sourceId = firstNode.id
    const targetId = secondNode.id

    if (sourceId === targetId) {
      return
    }

    const existingLink = crossLinks.find(
      (link) =>
        (link.sourceId === sourceId && link.targetId === targetId) ||
        (link.sourceId === targetId && link.targetId === sourceId),
    )

    if (existingLink) {
      dispatch({ type: 'DELETE_CROSS_LINK', crossLinkId: existingLink.id })
      return
    }

    const newLinkId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `link-${Date.now()}-${Math.random().toString(16).slice(2)}`

    const crossLink: MindMapCrossLink = {
      id: newLinkId,
      sourceId,
      targetId,
    }

    dispatch({ type: 'ADD_CROSS_LINK', crossLink })
  }, [crossLinks, dispatch, isLocked, selectedNodes])

  const handleLinkParentChild = useCallback(() => {
    if (isLocked) {
      return
    }

    if (selectedNodes.length < 2) {
      return
    }

    const [potentialParent, potentialChild] = selectedNodes
    if (!potentialParent || !potentialChild) {
      return
    }

    if (potentialParent.id === potentialChild.id) {
      return
    }

    let ancestorId = potentialParent.parentId
    while (ancestorId) {
      if (ancestorId === potentialChild.id) {
        return
      }
      const ancestor = nodeById.get(ancestorId)
      if (!ancestor) {
        break
      }
      ancestorId = ancestor.parentId
    }

    if (potentialChild.parentId === potentialParent.id) {
      dispatch({
        type: 'UPDATE_NODE',
        nodeId: potentialChild.id,
        updates: { parentId: null },
      })
      return
    }

    dispatch({
      type: 'UPDATE_NODE',
      nodeId: potentialChild.id,
      updates: { parentId: potentialParent.id },
    })
  }, [dispatch, isLocked, nodeById, selectedNodes])

  const handleAddStandaloneNode = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale
    const colorReference = primarySelectedNode?.color ?? nodes[nodes.length - 1]?.color
    const nodeColor = getNextNodeColor(colorReference)

    const newNodeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `node-${Date.now()}-${Math.random().toString(16).slice(2)}`

    const defaultText = 'New Idea'

    dispatch({
      type: 'ADD_NODE',
      node: {
        id: newNodeId,
        parentId: null,
        text: defaultText,
        x: worldCenterX,
        y: worldCenterY,
        color: nodeColor,
        textSize: 'medium',
      },
    })
    dispatch({ type: 'SET_SELECTED_NODES', nodeIds: [newNodeId] })
    setTextDraft(defaultText)
    requestTextEditorFocus()
  }, [dispatch, isLocked, nodes, primarySelectedNode, requestTextEditorFocus])

  const handleAddAnnotation = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : (-offsetX) / scale
    const worldCenterY = height === 0 ? 0 : (-offsetY) / scale

    const newAnnotationId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_ANNOTATION',
      annotation: {
        id: newAnnotationId,
        text: 'New text',
        x: worldCenterX,
        y: worldCenterY,
        textSize: 'medium',
      },
    })
  }, [dispatch, isLocked])

  const handleAddRing = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const basePoint = { x: worldCenterX, y: worldCenterY }
    const centerPoint = gridModeRef.current ? snapPoint(basePoint, GRIDLINE_SPACING) : basePoint

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'ring',
        x: centerPoint.x,
        y: centerPoint.y,
        radius: RING_DEFAULT_RADIUS,
        thickness: RING_DEFAULT_THICKNESS,
        color: RING_DEFAULT_COLOR,
      },
    })
    setToolbarCollapsed(false)
  }, [dispatch, isLocked])

  const handleAddEllipse = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const basePoint = { x: worldCenterX, y: worldCenterY }
    const centerPoint = gridModeRef.current ? snapPoint(basePoint, GRIDLINE_SPACING) : basePoint

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'ellipse',
        x: centerPoint.x,
        y: centerPoint.y,
        radiusX: ELLIPSE_DEFAULT_RADIUS_X,
        radiusY: ELLIPSE_DEFAULT_RADIUS_Y,
        thickness: ELLIPSE_DEFAULT_THICKNESS,
        color: ELLIPSE_DEFAULT_COLOR,
      },
    })
    setToolbarCollapsed(false)
  }, [dispatch, isLocked])

  const handleAddRectangle = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const basePoint = { x: worldCenterX, y: worldCenterY }
    const centerPoint = gridModeRef.current ? snapPoint(basePoint, GRIDLINE_SPACING) : basePoint

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'rectangle',
        x: centerPoint.x,
        y: centerPoint.y,
        width: RECTANGLE_DEFAULT_WIDTH,
        height: RECTANGLE_DEFAULT_HEIGHT,
        thickness: RECTANGLE_DEFAULT_THICKNESS,
        color: RECTANGLE_DEFAULT_COLOR,
      },
    })
    setToolbarCollapsed(false)
  }, [dispatch, isLocked])

  const handleAddArrow = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const basePoint = { x: worldCenterX, y: worldCenterY }
    const centerPoint = gridModeRef.current ? snapPoint(basePoint, GRIDLINE_SPACING) : basePoint

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'arrow',
        x: centerPoint.x,
        y: centerPoint.y,
        width: ARROW_DEFAULT_WIDTH,
        height: ARROW_DEFAULT_HEIGHT,
        thickness: ARROW_DEFAULT_THICKNESS,
        angle: ARROW_DEFAULT_ANGLE,
        color: ARROW_DEFAULT_COLOR,
      },
    })
    setToolbarCollapsed(false)
  }, [dispatch, isLocked])

  const handleAddLine = useCallback(() => {
    if (isLocked) {
      return
    }

    const { scale, offsetX, offsetY } = viewRef.current
    const { width, height } = sizeRef.current

    const worldCenterX = width === 0 ? 0 : -offsetX / scale
    const worldCenterY = height === 0 ? 0 : -offsetY / scale

    const basePoint = { x: worldCenterX, y: worldCenterY }
    const centerPoint = gridModeRef.current ? snapPoint(basePoint, GRIDLINE_SPACING) : basePoint

    const newShapeId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`

    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: newShapeId,
        kind: 'line',
        x: centerPoint.x,
        y: centerPoint.y,
        length: LINE_DEFAULT_LENGTH,
        thickness: LINE_DEFAULT_THICKNESS,
        angle: LINE_DEFAULT_ANGLE,
        color: LINE_DEFAULT_COLOR,
      },
    })
    setToolbarCollapsed(false)
  }, [dispatch, isLocked])

  const handleDeleteSelection = useCallback(() => {
    if (isLocked) {
      return
    }

    if (selectedShape) {
      dispatch({ type: 'DELETE_SHAPE', shapeId: selectedShape.id })
      return
    }

    if (selectedAnnotation) {
      dispatch({ type: 'DELETE_ANNOTATION', annotationId: selectedAnnotation.id })
      return
    }

    if (selectedNodes.length === 0) {
      return
    }

    const removableIds = selectedNodes
      .filter((node) => !(node.parentId === null && node.id === ROOT_NODE_ID))
      .map((node) => node.id)

    if (removableIds.length === 0) {
      return
    }

    if (removableIds.length === 1) {
      dispatch({ type: 'DELETE_NODE', nodeId: removableIds[0] })
      return
    }

    dispatch({ type: 'DELETE_NODES', nodeIds: removableIds })
  }, [dispatch, isLocked, selectedAnnotation, selectedNodes, selectedShape])

  const handleCopyNodes = useCallback(() => {
    if (isLocked) {
      return false
    }

    if (selectedNodes.length === 0) {
      clipboardRef.current = null
      setClipboardStatus('empty')
      return false
    }

    const snapshots: CopiedNodeSnapshot[] = selectedNodes.map((node) => ({
      text: node.text,
      color: node.color,
      textSize: node.textSize,
      x: node.x,
      y: node.y,
    }))

    clipboardRef.current = {
      nodes: snapshots,
      pasteCount: 0,
    }
    setClipboardStatus('ready')
    return true
  }, [isLocked, selectedNodes])

  const handlePasteNodes = useCallback(() => {
    if (isLocked) {
      return false
    }

    const payload = clipboardRef.current
    if (!payload || payload.nodes.length === 0) {
      clipboardRef.current = null
      setClipboardStatus('empty')
      return false
    }

    const baseTimestamp = Date.now()
    const nextPasteCount = payload.pasteCount + 1
    const offsetStep = 36
    const offset = offsetStep * nextPasteCount

    const newNodes = payload.nodes.map((node, index) => {
      const newNodeId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `node-${baseTimestamp}-${index}-${Math.random().toString(16).slice(2)}`

      return {
        id: newNodeId,
        parentId: null,
        text: node.text,
        color: node.color,
        textSize: node.textSize,
        x: node.x + offset,
        y: node.y + offset,
      }
    })

    clipboardRef.current = {
      nodes: payload.nodes,
      pasteCount: nextPasteCount,
    }

    dispatch({
      type: 'ADD_NODES',
      nodes: newNodes,
      selectedNodeIds: newNodes.map((node) => node.id),
    })

    return true
  }, [dispatch, isLocked])

  const handleUndo = useCallback(() => {
    if (isLocked || past.length === 0) {
      return
    }
    dispatch({ type: 'UNDO' })
  }, [dispatch, isLocked, past])

  const handleRedo = useCallback(() => {
    if (isLocked || future.length === 0) {
      return
    }
    dispatch({ type: 'REDO' })
  }, [dispatch, future, isLocked])

  const isPristineState = useMemo(() => {
    if (annotations.length > 0) {
      return false
    }

    if (shapes.length > 0) {
      return false
    }

    if (crossLinks.length > 0) {
      return false
    }

    if (nodes.length !== 1) {
      return false
    }

    const [rootNode] = nodes
    if (!rootNode) {
      return true
    }

    return (
      rootNode.id === ROOT_NODE_ID &&
      rootNode.parentId === null &&
      rootNode.text === 'Root' &&
      rootNode.x === 0 &&
      rootNode.y === 0 &&
      rootNode.color === DEFAULT_NODE_COLOR
    )
  }, [annotations, crossLinks, nodes, shapes])

  const canClear = !isPristineState

  const handleClearAll = useCallback(() => {
    if (isLocked || !canClear) {
      return
    }

    dispatch({ type: 'CLEAR_ALL' })
  }, [canClear, dispatch, isLocked])

  const panByPixels = useCallback((deltaX: number, deltaY: number) => {
    setViewTransform((previous) => {
      hasAutoCenteredRef.current = true
      return {
        ...previous,
        offsetX: previous.offsetX - deltaX,
        offsetY: previous.offsetY - deltaY,
      }
    })
  }, [])

  const handlePanUp = useCallback(() => {
    panByPixels(0, -KEYBOARD_PAN_STEP)
  }, [panByPixels])

  const handlePanDown = useCallback(() => {
    panByPixels(0, KEYBOARD_PAN_STEP)
  }, [panByPixels])

  const handlePanLeft = useCallback(() => {
    panByPixels(-KEYBOARD_PAN_STEP, 0)
  }, [panByPixels])

  const handlePanRight = useCallback(() => {
    panByPixels(KEYBOARD_PAN_STEP, 0)
  }, [panByPixels])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      const key = event.key.toLowerCase()
      const metaOrCtrl = event.metaKey || event.ctrlKey

      if (metaOrCtrl && !event.shiftKey && key === 'z') {
        event.preventDefault()
        handleUndo()
        return
      }

      if ((metaOrCtrl && (key === 'y' || (event.shiftKey && key === 'z')))) {
        event.preventDefault()
        handleRedo()
        return
      }

      if (metaOrCtrl && key === 'c') {
        const didCopy = handleCopyNodes()
        if (didCopy) {
          event.preventDefault()
        }
        return
      }

      if (metaOrCtrl && key === 'v') {
        const didPaste = handlePasteNodes()
        if (didPaste) {
          event.preventDefault()
        }
        return
      }

      if (key === 'arrowup') {
        event.preventDefault()
        handlePanUp()
        return
      }

      if (key === 'arrowdown') {
        event.preventDefault()
        handlePanDown()
        return
      }

      if (key === 'arrowleft') {
        event.preventDefault()
        handlePanLeft()
        return
      }

      if (key === 'arrowright') {
        event.preventDefault()
        handlePanRight()
        return
      }

      if (key === '+' || key === '=') {
        event.preventDefault()
        handleZoomIn()
        return
      }

      if (key === '-' || key === '_') {
        event.preventDefault()
        handleZoomOut()
        return
      }

      if (!metaOrCtrl && !event.altKey && !event.shiftKey && (event.code === 'Space' || key === ' ')) {
        event.preventDefault()
        handleResetView()
        return
      }

      if (key === 'c') {
        event.preventDefault()
        handleResetView()
        return
      }

      if (key === 'enter') {
        event.preventDefault()
        if (event.shiftKey) {
          handleAddStandaloneNode()
        } else {
          handleAddChild()
        }
        return
      }

      if (key === 'delete' || key === 'backspace') {
        event.preventDefault()
        handleDeleteSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleAddChild,
    handleAddStandaloneNode,
    handleCopyNodes,
    handleDeleteSelection,
    handlePanDown,
    handlePanLeft,
    handlePanRight,
    handlePanUp,
    handlePasteNodes,
    handleRedo,
    handleResetView,
    handleUndo,
    handleZoomIn,
    handleZoomOut,
  ])

  const handleExportJson = useCallback(() => {
    closeExportMenu()
    const payload = serializeMindMapDocument({
      nodes,
      annotations,
      shapes,
      crossLinks,
    })
    const blob = new Blob([payload], { type: 'application/json' })
    downloadBlob(blob, 'mindmap.json')
  }, [annotations, closeExportMenu, crossLinks, nodes, shapes])

  const handleExportPng = useCallback(() => {
    closeExportMenu()
    const result = renderMindMapSceneToCanvas(
      {
        nodes,
        annotations,
        shapes,
        crossLinks,
      },
      { backgroundTheme },
    )

    if (!result) {
      window.alert('Unable to export PNG right now. Please try again.')
      return
    }

    result.canvas.toBlob(
      (blob) => {
        if (!blob) {
          window.alert('Unable to export PNG right now. Please try again.')
          return
        }
        downloadBlob(blob, 'mindmap.png')
      },
      'image/png',
    )
  }, [annotations, backgroundTheme, closeExportMenu, crossLinks, nodes, shapes])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (isLocked) {
        event.target.value = ''
        return
      }

      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = parseImportedMindMapDocument(JSON.parse(String(reader.result)))
          if (!parsed) {
            window.alert('Unable to import file. Please choose a valid Mindmapper JSON export.')
            return
          }

          dispatch({
            type: 'IMPORT',
            nodes: parsed.nodes,
            annotations: parsed.annotations,
            shapes: parsed.shapes,
            crossLinks: parsed.crossLinks,
          })
        } catch (error) {
          console.error('Failed to import mind map', error)
          window.alert('Unable to import file. Please choose a valid Mindmapper JSON export.')
        }
      }
      reader.readAsText(file)
      event.target.value = ''
    },
    [dispatch, isLocked],
  )

  const handleImportJson = useCallback(() => {
    if (isLocked) {
      return
    }

    closeExportMenu()
    closeShortcutsMenu()
    fileInputRef.current?.click()
  }, [closeExportMenu, closeShortcutsMenu, isLocked])

  const canDeleteNode = selectedNodes.some(
    (node) => !(node.parentId === null && node.id === ROOT_NODE_ID),
  )
  const canDeleteAnnotation = Boolean(selectedAnnotation)
  const canDeleteShape = Boolean(selectedShape)
  const canDelete = canDeleteNode || canDeleteAnnotation || canDeleteShape
  const canUndo = past.length > 0
  const canRedo = future.length > 0
  const hasClipboard = clipboardStatus === 'ready'
  const canCopyNodes = !isLocked && selectedNodes.length > 0
  const canPasteNodes = !isLocked && hasClipboard
  const canZoomIn = viewTransform.scale < MAX_ZOOM - 0.001
  const canZoomOut = viewTransform.scale > MIN_ZOOM + 0.001
  const zoomPercentage = Math.round(viewTransform.scale * 100)
  const copyButtonTitle = isLocked ? 'Unlock edits to copy nodes' : 'Ctrl/Cmd + C'
  const pasteButtonTitle = isLocked
    ? 'Unlock edits to paste nodes'
    : hasClipboard
      ? 'Ctrl/Cmd + V'
      : 'Copy nodes first'

  const handleTextEditorKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') {
        return
      }

      if (isLocked) {
        return
      }

      if (event.shiftKey) {
        event.preventDefault()
        handleAddStandaloneNode()
        return
      }

      if (selectedTextTarget?.kind !== 'node') {
        return
      }

      event.preventDefault()
      handleAddChild()
    },
    [handleAddChild, handleAddStandaloneNode, isLocked, selectedTextTarget],
  )

  const handleTextChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setTextDraft(value)

      if (isLocked || !selectedTextTarget) {
        return
      }

      if (selectedTextTarget.kind === 'node') {
        dispatch({
          type: 'UPDATE_NODE',
          nodeId: selectedTextTarget.id,
          updates: { text: value },
        })
        return
      }

      dispatch({
        type: 'UPDATE_ANNOTATION',
        annotationId: selectedTextTarget.id,
        updates: { text: value },
      })
    },
    [dispatch, isLocked, selectedTextTarget],
  )

  const handleTextSizeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (isLocked || !selectedTextTarget) {
        return
      }

      const nextSize = normalizeTextSize(event.target.value)

      if (selectedTextTarget.kind === 'node') {
        dispatch({
          type: 'UPDATE_NODE',
          nodeId: selectedTextTarget.id,
          updates: { textSize: nextSize },
        })
        return
      }

      dispatch({
        type: 'UPDATE_ANNOTATION',
        annotationId: selectedTextTarget.id,
        updates: { textSize: nextSize },
      })
    },
    [dispatch, isLocked, selectedTextTarget],
  )

  const handleColorChange = useCallback(
    (nextColor: string) => {
      if (isLocked) {
        return
      }

      if (selectedShape) {
        if (selectedShape.color !== nextColor) {
          dispatch({ type: 'UPDATE_SHAPE', shapeId: selectedShape.id, updates: { color: nextColor } })
        }
        return
      }

      if (selectedNodes.length === 0) {
        return
      }

      const updates = selectedNodes
        .filter((node) => node.color !== nextColor)
        .map((node) => ({
          nodeId: node.id,
          updates: { color: nextColor },
        }))

      if (updates.length === 0) {
        return
      }

      dispatch({
        type: 'UPDATE_NODES',
        updates,
      })
    },
    [dispatch, isLocked, selectedNodes, selectedShape],
  )

  const handleShapeThicknessChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (isLocked || !selectedShape) {
        return
      }
      const requestedThickness = Number(event.target.value)
      if (!Number.isFinite(requestedThickness)) {
        return
      }
      const range = getShapeThicknessRange(selectedShape)
      const nextThickness = clamp(requestedThickness, range.min, range.max)
      if (nextThickness === selectedShape.thickness) {
        return
      }
      dispatch({
        type: 'UPDATE_SHAPE',
        shapeId: selectedShape.id,
        updates: { thickness: nextThickness },
      })
    },
    [dispatch, isLocked, selectedShape],
  )

  const toolbarBodyId = 'mindmap-toolbar-body'
  const shortcutsMenuId = 'mindmap-shortcuts-menu'
  const actionsBodyId = 'mindmap-actions-body'
  const appShellClassName = `app-shell app-shell--${backgroundTheme}${
    isSelectionModeActive ? ' app-shell--select-mode' : ''
  }`
  const marqueeStyle: CSSProperties | undefined = selectionMarquee
    ? {
        left: `${Math.min(selectionMarquee.startX, selectionMarquee.currentX)}px`,
        top: `${Math.min(selectionMarquee.startY, selectionMarquee.currentY)}px`,
        width: `${Math.abs(selectionMarquee.currentX - selectionMarquee.startX)}px`,
        height: `${Math.abs(selectionMarquee.currentY - selectionMarquee.startY)}px`,
      }
    : undefined
  const isEditingNode = selectedTextTarget?.kind === 'node'
  const isEditingAnnotation = selectedTextTarget?.kind === 'annotation'
  const textEditorLabel = isEditingNode ? 'Node text' : isEditingAnnotation ? 'Text box text' : 'Edit text'
  const isTextEditingDisabled = isLocked || !selectedTextTarget
  const textEditorPlaceholder = isLocked
    ? 'Unlock editing to type'
    : isEditingNode
    ? 'Type here to rename the node'
    : isEditingAnnotation
    ? 'Type here to update the text box'
    : 'Select one node or text box first'
  const textInputAriaLabel = isLocked
    ? 'Text editing is locked'
    : isEditingNode
    ? 'Selected node text'
    : isEditingAnnotation
    ? 'Selected text box text'
    : 'Edit text (select one item first)'
  const textSizeAriaLabel = isLocked
    ? 'Text size selection is locked'
    : isEditingNode
    ? 'Selected node text size'
    : isEditingAnnotation
    ? 'Selected text box size'
    : 'Text size (select one item first)'
  const hasNodeSelection = selectedNodes.length > 0
  const hasMixedNodeColors = hasNodeSelection && selectedNodeColor === null
  const isParentChildButtonDisabled = isLocked || !parentChildLinkStatus.canLink
  const parentChildLinkButtonTitle = isLocked
    ? 'Unlock edits to set a parent-child link'
    : parentChildLinkStatus.message
  const hasCrossLinkSelection = selectedNodes.length >= 2
  const isCrossLinkButtonDisabled = isLocked || !hasCrossLinkSelection
  const crossLinkButtonTitle = isLocked
    ? 'Unlock edits to add a cross-link'
    : hasCrossLinkSelection
    ? 'Curve a cross-link between the first two selected ideas'
    : 'Select two ideas to add a cross-link'
  const lockButtonLabel = isLocked ? 'Unlock' : 'Lock'
  const lockButtonTitle = isLocked
    ? 'Switch back to editing mode'
    : 'Lock editing so you can explore safely'
  const lockButtonIcon = <ControlGlyph kind={isLocked ? 'lock' : 'unlock'} />
  const isDarkBackground = backgroundTheme === 'dark'
  const gridButtonLabel = 'Grid'
  const gridButtonTitle = isGridModeEnabled
    ? 'Turn off gridline mode for alignment'
    : 'Turn on gridline mode for alignment'
  const gridButtonIcon = <ControlGlyph kind="grid" />
  const backgroundButtonLabel = isDarkBackground ? 'Light' : 'Dark'
  const backgroundButtonIcon = <ControlGlyph kind={isDarkBackground ? 'light' : 'dark'} />
  const backgroundButtonTitle = isDarkBackground
    ? 'Switch to a bright background'
    : 'Switch to a deep background'
  const actionsToggleIcon = areActionsCollapsed ? '▴' : '▾'
  const actionsToggleTitle = areActionsCollapsed ? 'Show edit commands' : 'Hide edit commands'
  const actionsToggleLabel = areActionsCollapsed ? 'Expand edit commands' : 'Collapse edit commands'
  const workspaceStatus = canClear ? 'Map in progress' : 'Fresh canvas'
  const textSizeOptions = TEXT_SIZE_CHOICES.map((size) => ({
    value: size,
    label: TEXT_SIZE_LABELS[size],
  }))
  const nodeColorOptions = NODE_COLOR_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    isSelected: selectedNodeColor === option.value,
  }))
  const shapeColorOptions = SHAPE_COLOR_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    isSelected: selectedShape?.color.toLowerCase() === option.value.toLowerCase(),
  }))
  const activeColorOptions = selectedShape ? shapeColorOptions : nodeColorOptions
  const showColorControls = hasNodeSelection || Boolean(selectedShape)
  const colorControlLabel = selectedShape ? 'Shape color' : 'Node color'
  const colorApplyTarget = selectedShape
    ? 'the selected shape'
    : selectedNodes.length > 1
    ? 'all selected nodes'
    : 'the selected node'
  const shapeThicknessRange = getShapeThicknessRange(selectedShape)
  const creationActions: ToolbarActionButton[] = [
    {
      key: 'add-child',
      title: 'Enter to add a child idea',
      ariaLabel: 'Add child idea',
      disabled: isLocked,
      onClick: handleAddChild,
      icon: (
        <MindMapToolIcon name="child" />
      ),
      tone: 'cyan',
      hiddenLabel: 'Add child idea',
    },
    {
      key: 'add-idea',
      title: 'Shift + Enter to add a new detached idea',
      ariaLabel: 'Add new idea',
      disabled: isLocked,
      onClick: handleAddStandaloneNode,
      icon: (
        <MindMapToolIcon name="idea" />
      ),
      tone: 'violet',
      hiddenLabel: 'Add new idea',
    },
    {
      key: 'link-parent-child',
      title: parentChildLinkButtonTitle,
      ariaLabel:
        parentChildLinkStatus.mode === 'unlink'
          ? 'Remove parent-child link'
          : 'Create parent-child link',
      disabled: isParentChildButtonDisabled,
      onClick: handleLinkParentChild,
      icon: (
        <MindMapToolIcon name="hierarchy" />
      ),
      tone: 'neutral',
      hiddenLabel:
        isParentChildButtonDisabled
          ? parentChildLinkStatus.message
          : parentChildLinkStatus.mode === 'unlink'
          ? 'Remove the parent-child link between the selected ideas'
          : 'Set the first selected idea as the parent of the second',
    },
    {
      key: 'add-cross-link',
      title: crossLinkButtonTitle,
      ariaLabel: 'Add cross-link',
      disabled: isCrossLinkButtonDisabled,
      onClick: handleAddCrossLink,
      icon: (
        <MindMapToolIcon name="cross-link" />
      ),
      tone: 'neutral',
      hiddenLabel:
        isCrossLinkButtonDisabled
          ? 'Select two ideas to add a cross-link'
          : 'Add a cross-link between the first two selected ideas',
    },
    {
      key: 'add-textbox',
      title: 'Add a floating text box',
      ariaLabel: 'Add textbox',
      disabled: isLocked,
      onClick: handleAddAnnotation,
      icon: (
        <MindMapToolIcon name="text" />
      ),
      tone: 'coral',
      hiddenLabel: 'Add textbox',
    },
  ]
  const shapeActions: ToolbarActionButton[] = [
    {
      key: 'add-ring',
      title: 'Add a ring to group related ideas',
      ariaLabel: 'Add ring',
      disabled: isLocked,
      onClick: handleAddRing,
      icon: (
        <MindMapToolIcon name="ring" />
      ),
      tone: 'cyan',
      hiddenLabel: 'Ring',
    },
    {
      key: 'add-ellipse',
      title: 'Add an ellipse to spotlight a region',
      ariaLabel: 'Add ellipse',
      disabled: isLocked,
      onClick: handleAddEllipse,
      icon: (
        <MindMapToolIcon name="ellipse" />
      ),
      tone: 'violet',
      hiddenLabel: 'Ellipse',
    },
    {
      key: 'add-rectangle',
      title: 'Add a rectangle to frame ideas',
      ariaLabel: 'Add rectangle',
      disabled: isLocked,
      onClick: handleAddRectangle,
      icon: (
        <MindMapToolIcon name="rectangle" />
      ),
      tone: 'mint',
      hiddenLabel: 'Rectangle',
    },
    {
      key: 'add-arrow',
      title: 'Add an arrow to highlight a flow',
      ariaLabel: 'Add arrow',
      disabled: isLocked,
      onClick: handleAddArrow,
      icon: (
        <MindMapToolIcon name="arrow" />
      ),
      tone: 'amber',
      hiddenLabel: 'Arrow',
    },
    {
      key: 'add-line',
      title: 'Add a straight line connector',
      ariaLabel: 'Add line',
      disabled: isLocked,
      onClick: handleAddLine,
      icon: (
        <MindMapToolIcon name="line" />
      ),
      tone: 'cyan',
      hiddenLabel: 'Line',
    },
  ]
  const actionGroups: MindMapActionGroup[] = [
    {
      key: 'modes',
      label: 'Modes',
      buttons: [
        {
          key: 'toggle-lock',
          label: lockButtonLabel,
          title: lockButtonTitle,
          onClick: toggleLock,
          ariaPressed: isLocked,
          icon: lockButtonIcon,
        },
        {
          key: 'toggle-background',
          label: backgroundButtonLabel,
          title: backgroundButtonTitle,
          onClick: toggleBackgroundTheme,
          ariaPressed: isDarkBackground,
          ariaLabel: backgroundButtonTitle,
          icon: backgroundButtonIcon,
        },
        {
          key: 'toggle-grid',
          label: gridButtonLabel,
          title: gridButtonTitle,
          onClick: toggleGridMode,
          ariaPressed: isGridModeEnabled,
          ariaLabel: gridButtonTitle,
          icon: gridButtonIcon,
        },
      ],
    },
    {
      key: 'edit',
      label: 'Edit',
      buttons: [
        {
          key: 'delete-selection',
          label: 'Delete',
          title: 'Delete or Backspace',
          onClick: handleDeleteSelection,
          disabled: isLocked || !canDelete,
        },
        {
          key: 'clear-canvas',
          label: 'Clear',
          title: 'Reset the canvas to a fresh root node',
          onClick: handleClearAll,
          disabled: isLocked || !canClear,
        },
      ],
    },
    {
      key: 'clipboard',
      label: 'Clipboard',
      buttons: [
        {
          key: 'copy-nodes',
          label: 'Copy',
          title: copyButtonTitle,
          onClick: handleCopyNodes,
          disabled: !canCopyNodes,
        },
        {
          key: 'paste-nodes',
          label: 'Paste',
          title: pasteButtonTitle,
          onClick: handlePasteNodes,
          disabled: !canPasteNodes,
        },
      ],
    },
    {
      key: 'history',
      label: 'History',
      buttons: [
        {
          key: 'undo',
          label: 'Undo',
          title: 'Ctrl/Cmd + Z',
          onClick: handleUndo,
          disabled: isLocked || !canUndo,
        },
        {
          key: 'redo',
          label: 'Redo',
          title: 'Ctrl/Cmd + Shift + Z',
          onClick: handleRedo,
          disabled: isLocked || !canRedo,
        },
      ],
    },
  ]

  return (
    <div className={appShellClassName}>
      <canvas ref={canvasRef} className="mindmap-canvas" />
      {marqueeStyle ? <div className="mindmap-marquee" style={marqueeStyle} /> : null}
      <MindMapToolbar
        isCollapsed={isToolbarCollapsed}
        toolbarBodyId={toolbarBodyId}
        onToggleCollapse={toggleToolbarCollapsed}
        creationActions={creationActions}
        shapeActions={shapeActions}
        showTextControls={Boolean(selectedTextTarget)}
        textEditorLabel={textEditorLabel}
        textDraft={textDraft}
        onTextChange={handleTextChange}
        onTextKeyDown={handleTextEditorKeyDown}
        textInputPlaceholder={textEditorPlaceholder}
        isTextEditingDisabled={isTextEditingDisabled}
        textInputAriaLabel={textInputAriaLabel}
        textInputTitle={isLocked ? 'Unlock edits to change text' : undefined}
        textInputRef={textInputRef}
        selectedTextSize={selectedTextSize}
        onTextSizeChange={handleTextSizeChange}
        textSizeAriaLabel={textSizeAriaLabel}
        textSizeTitle={isLocked ? 'Unlock edits to change text size' : undefined}
        textSizeOptions={textSizeOptions}
        showColorControls={showColorControls}
        colorControlLabel={colorControlLabel}
        hasMixedColors={hasMixedNodeColors}
        colorApplyTarget={colorApplyTarget}
        isColorDisabled={isLocked || !showColorControls}
        colorOptions={activeColorOptions}
        onColorChange={handleColorChange}
        showShapeThickness={Boolean(selectedShape)}
        shapeThickness={selectedShape?.thickness ?? 1}
        shapeThicknessMin={shapeThicknessRange.min}
        shapeThicknessMax={shapeThicknessRange.max}
        onShapeThicknessChange={handleShapeThicknessChange}
      />
      <MindMapWorkspacePanel
        workspaceStatus={workspaceStatus}
        isLocked={isLocked}
        onImportJson={handleImportJson}
        isExportMenuOpen={isExportMenuOpen}
        onToggleExportMenu={toggleExportMenu}
        onExportJson={handleExportJson}
        onExportPng={handleExportPng}
        exportMenuRef={exportMenuRef}
        isShortcutsOpen={isShortcutsOpen}
        onToggleShortcutsMenu={toggleShortcutsMenu}
        shortcutsMenuId={shortcutsMenuId}
        shortcuts={KEYBOARD_SHORTCUTS}
        shortcutsVisibleHeight={shortcutsVisibleHeight}
        shortcutsMenuRef={shortcutsMenuRef}
        shortcutsListRef={shortcutsListRef}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
      />
      <MindMapActionsPanel
        isCollapsed={areActionsCollapsed}
        actionsBodyId={actionsBodyId}
        title={isLocked ? 'Review tools' : 'Edit tools'}
        onToggleCollapse={toggleActionsCollapsed}
        toggleTitle={actionsToggleTitle}
        toggleLabel={actionsToggleLabel}
        toggleIcon={actionsToggleIcon}
        groups={actionGroups}
      />
      <MindMapNavigation
        zoomPercentage={zoomPercentage}
        canZoomOut={canZoomOut}
        canZoomIn={canZoomIn}
        onPanUp={handlePanUp}
        onPanLeft={handlePanLeft}
        onResetView={handleResetView}
        onPanRight={handlePanRight}
        onPanDown={handlePanDown}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
      />
    </div>
  )
}
