import { DEFAULT_NODE_COLOR } from '../state/mindMapModel'

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

export type MindMapColorOption = { value: string; label: string; isDefault: boolean }
export type NodeColorOption = MindMapColorOption
export const MINDMAP_COLOR_OPTIONS: readonly MindMapColorOption[] = [
  { value: DEFAULT_NODE_COLOR, label: 'Indigo', isDefault: true },
  { value: '#5bc0ce', label: 'Tide', isDefault: true },
  { value: '#8f84d8', label: 'Iris', isDefault: true },
  { value: '#d8a657', label: 'Ochre', isDefault: true },
  { value: '#d97578', label: 'Coral', isDefault: true },
  { value: '#5faf91', label: 'Sage', isDefault: true },
  { value: '#b65f84', label: 'Rose', isDefault: false },
  { value: '#536875', label: 'Steel', isDefault: false },
  { value: '#9aa8ad', label: 'Mist', isDefault: false },
  { value: '#d5dee3', label: 'Cloud', isDefault: false },
  { value: '#4778c8', label: 'Cobalt', isDefault: false },
  { value: '#c66f45', label: 'Ember', isDefault: false },
  { value: '#243139', label: 'Ink', isDefault: false },
] as const
export const NODE_COLOR_OPTIONS = MINDMAP_COLOR_OPTIONS
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
export const GRIDLINE_COLOR_DARK = 'rgba(116, 164, 184, 0.08)'
export const GRIDLINE_COLOR_LIGHT = 'rgba(37, 71, 86, 0.055)'
export const GRIDLINE_MAJOR_COLOR_DARK = 'rgba(116, 190, 214, 0.14)'
export const GRIDLINE_MAJOR_COLOR_LIGHT = 'rgba(37, 92, 110, 0.1)'
export const GRIDLINE_AXIS_COLOR_DARK = 'rgba(109, 220, 255, 0.2)'
export const GRIDLINE_AXIS_COLOR_LIGHT = 'rgba(6, 127, 163, 0.17)'

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
export const RING_DEFAULT_THICKNESS = 5
export const RING_MIN_RADIUS = 48
export const SHAPE_HANDLE_SCREEN_SIZE = 16
export const RING_HIT_PADDING = 6
export const RING_DEFAULT_COLOR = '#5bc0ce'

export const ELLIPSE_DEFAULT_RADIUS_X = 200
export const ELLIPSE_DEFAULT_RADIUS_Y = 120
export const ELLIPSE_MIN_RADIUS_X = 60
export const ELLIPSE_MIN_RADIUS_Y = 45
export const ELLIPSE_DEFAULT_THICKNESS = 5
export const ELLIPSE_HIT_PADDING = 8
export const ELLIPSE_DEFAULT_COLOR = '#8f84d8'

export const RECTANGLE_DEFAULT_WIDTH = 320
export const RECTANGLE_DEFAULT_HEIGHT = 200
export const RECTANGLE_MIN_WIDTH = 120
export const RECTANGLE_MIN_HEIGHT = 80
export const RECTANGLE_DEFAULT_THICKNESS = 4
export const RECTANGLE_HIT_PADDING = 6
export const RECTANGLE_DEFAULT_COLOR = '#5faf91'

export const ARROW_DEFAULT_WIDTH = 340
export const ARROW_DEFAULT_HEIGHT = 180
export const ARROW_MIN_WIDTH = 36
export const ARROW_MIN_HEIGHT = 6
export const ARROW_DEFAULT_THICKNESS = 24
export const ARROW_MIN_THICKNESS = 2
export const ARROW_HIT_PADDING = 10
export const ARROW_DEFAULT_COLOR = '#d8a657'
export const ARROW_HEAD_RATIO = 0.72
export const ARROW_MIN_HEAD_LENGTH = 26
export const ARROW_MIN_SHAFT_HALF_HEIGHT = 1.2
export const ARROW_HEAD_BASE_RATIO = 2.8
export const ARROW_HEAD_BASE_PADDING = 6
export const ARROW_MIN_HEAD_HALF_HEIGHT = 7
export const ARROW_DEFAULT_ANGLE = 0

export const LINE_DEFAULT_LENGTH = 280
export const LINE_DEFAULT_THICKNESS = 4
export const LINE_MIN_LENGTH = 20
export const LINE_MIN_THICKNESS = 1.2
export const LINE_HIT_PADDING = 6
export const LINE_DEFAULT_COLOR = '#5bc0ce'
export const LINE_DEFAULT_ANGLE = 0

export const SHAPE_COLOR_OPTIONS = MINDMAP_COLOR_OPTIONS

export const CROSS_LINK_COLOR_LIGHT = '#0ea5e9'
export const CROSS_LINK_COLOR_DARK = 'rgba(125, 211, 252, 0.85)'
export const CROSS_LINK_STROKE_WIDTH = 4
export const CROSS_LINK_MIN_CURVE_OFFSET = 120
export const CROSS_LINK_CURVE_SCALE = 0.35

export const NODE_FONT_FAMILY = 'Manrope, system-ui, sans-serif'
export const ANNOTATION_FONT_FAMILY = 'Manrope, system-ui, sans-serif'

export type KeyboardShortcut = { keys: string; description: string }
export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcut[] = [
  { keys: 'Enter', description: 'Add a child idea to the selected node' },
  { keys: 'Shift + Enter', description: 'Add a detached idea at the center of the view' },
  { keys: 'Shift/Ctrl/Cmd + Click', description: 'Add or remove a node from the selection' },
  { keys: 'Shift + Drag', description: 'Draw a selection box to highlight multiple ideas' },
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
