import { DEFAULT_NODE_COLOR } from '../state/MindMapContext'

export const NODE_BASE_RADIUS = 40
export const NODE_TEXT_PADDING = 18
export const NODE_FONT_SIZES = {
  small: 12,
  medium: 20,
  large: 30,
} as const
export const NODE_LINE_HEIGHTS = {
  small: 18,
  medium: 30,
  large: 45,
} as const
export const NODE_WRAP_STEP = 24
export const NODE_RADIUS_EPSILON = 0.5
export const LINK_DISTANCE = 160

export type NodeColorOption = { value: string; label: string; isDefault: boolean }
export const NODE_COLOR_OPTIONS: readonly NodeColorOption[] = [
  { value: DEFAULT_NODE_COLOR, label: 'Indigo', isDefault: true },
  { value: '#22d3ee', label: 'Teal', isDefault: true },
  { value: '#a855f7', label: 'Purple', isDefault: true },
  { value: '#10b981', label: 'Green', isDefault: true },
  { value: '#f97316', label: 'Orange', isDefault: true },
  { value: '#facc15', label: 'Yellow', isDefault: true },
  { value: '#ef4444', label: 'Red', isDefault: false },
  { value: '#6b7280', label: 'Slate Gray', isDefault: false },
  { value: '#9ca3af', label: 'Mist Gray', isDefault: false },
  { value: '#111827', label: 'Black', isDefault: false },
] as const
export const FALLBACK_COLORS = NODE_COLOR_OPTIONS.filter((option) => option.isDefault).map(
  (option) => option.value,
)

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2.5
export const ZOOM_STEP = 1.2
export const KEYBOARD_PAN_STEP = 80
export const AUTO_CENTER_PADDING = 160
export const GRIDLINE_SPACING = 80
export const GRIDLINE_MAJOR_INTERVAL = 5
export const GRIDLINE_COLOR_DARK = 'rgba(148, 163, 184, 0.12)'
export const GRIDLINE_COLOR_LIGHT = 'rgba(15, 23, 42, 0.08)'
export const GRIDLINE_MAJOR_COLOR_DARK = 'rgba(148, 163, 184, 0.22)'
export const GRIDLINE_MAJOR_COLOR_LIGHT = 'rgba(15, 23, 42, 0.18)'
export const GRIDLINE_AXIS_COLOR_DARK = 'rgba(248, 250, 252, 0.32)'
export const GRIDLINE_AXIS_COLOR_LIGHT = 'rgba(15, 23, 42, 0.28)'

export const ANNOTATION_FONT_SIZES = {
  small: 16,
  medium: 26,
  large: 38,
} as const
export const ANNOTATION_LINE_HEIGHTS = {
  small: 26,
  medium: 40,
  large: 56,
} as const
export const ANNOTATION_PADDING_X = 14
export const ANNOTATION_PADDING_Y = 10
export const ANNOTATION_MIN_WIDTH = 120

export const RING_DEFAULT_RADIUS = 160
export const RING_DEFAULT_THICKNESS = 18
export const RING_MIN_RADIUS = 48
export const SHAPE_HANDLE_SCREEN_SIZE = 28
export const RING_HIT_PADDING = 6
export const RING_DEFAULT_COLOR = '#38bdf8'

export const ELLIPSE_DEFAULT_RADIUS_X = 200
export const ELLIPSE_DEFAULT_RADIUS_Y = 120
export const ELLIPSE_MIN_RADIUS_X = 60
export const ELLIPSE_MIN_RADIUS_Y = 45
export const ELLIPSE_DEFAULT_THICKNESS = 14
export const ELLIPSE_HIT_PADDING = 8
export const ELLIPSE_DEFAULT_COLOR = '#a855f7'

export const RECTANGLE_DEFAULT_WIDTH = 320
export const RECTANGLE_DEFAULT_HEIGHT = 200
export const RECTANGLE_MIN_WIDTH = 120
export const RECTANGLE_MIN_HEIGHT = 80
export const RECTANGLE_DEFAULT_THICKNESS = 12
export const RECTANGLE_HIT_PADDING = 6
export const RECTANGLE_DEFAULT_COLOR = '#34d399'

export const ARROW_DEFAULT_WIDTH = 340
export const ARROW_DEFAULT_HEIGHT = 180
export const ARROW_MIN_WIDTH = 36
export const ARROW_MIN_HEIGHT = 6
export const ARROW_DEFAULT_THICKNESS = 48
export const ARROW_MIN_THICKNESS = 2
export const ARROW_HIT_PADDING = 10
export const ARROW_DEFAULT_COLOR = '#f97316'
export const ARROW_HEAD_RATIO = 0.72
export const ARROW_MIN_HEAD_LENGTH = 26
export const ARROW_MIN_SHAFT_HALF_HEIGHT = 1.2
export const ARROW_HEAD_BASE_RATIO = 2.8
export const ARROW_HEAD_BASE_PADDING = 6
export const ARROW_MIN_HEAD_HALF_HEIGHT = 7
export const ARROW_DEFAULT_ANGLE = 0

export const LINE_DEFAULT_LENGTH = 280
export const LINE_DEFAULT_THICKNESS = 8
export const LINE_MIN_LENGTH = 20
export const LINE_MIN_THICKNESS = 1.2
export const LINE_HIT_PADDING = 6
export const LINE_DEFAULT_COLOR = '#22d3ee'
export const LINE_DEFAULT_ANGLE = 0

export const CROSS_LINK_COLOR_LIGHT = '#0ea5e9'
export const CROSS_LINK_COLOR_DARK = 'rgba(125, 211, 252, 0.85)'
export const CROSS_LINK_STROKE_WIDTH = 4
export const CROSS_LINK_MIN_CURVE_OFFSET = 120
export const CROSS_LINK_CURVE_SCALE = 0.35

export const NODE_FONT_FAMILY = 'Inter, system-ui, sans-serif'
export const ANNOTATION_FONT_FAMILY = 'Inter, system-ui, sans-serif'

export type KeyboardShortcut = { keys: string; description: string }
export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcut[] = [
  { keys: 'Enter', description: 'Add a child idea to the selected node' },
  { keys: 'Shift + Enter', description: 'Add a detached idea at the center of the view' },
  { keys: 'Shift/Ctrl/Cmd + Click', description: 'Add or remove a node from the selection' },
  { keys: 'Arrow keys', description: 'Pan the canvas up, down, left, or right' },
  { keys: 'Space or C', description: 'Recenter the view to focus on your map' },
  { keys: '+ or =', description: 'Zoom in' },
  { keys: '- or _', description: 'Zoom out' },
  { keys: 'Ctrl/Cmd + C / V', description: 'Copy / Paste selected ideas' },
  { keys: 'Ctrl/Cmd + Z', description: 'Undo the last change' },
  { keys: 'Ctrl/Cmd + Shift + Z', description: 'Redo the last undone change' },
  { keys: 'Delete or Backspace', description: 'Delete the selected items' },
  { keys: 'Esc', description: 'Close open menus' },
] as const

export const VISIBLE_SHORTCUT_COUNT = 8
