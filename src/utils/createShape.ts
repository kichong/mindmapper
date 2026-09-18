import type { MindMapShape } from '../state/mindMapModel'
import * as defaults from '../constants/mindMap'

export function createShape(
  kind: MindMapShape['kind'],
  center: { x: number; y: number },
  color: string,
): MindMapShape {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const common = { id, ...center, color }
  switch (kind) {
    case 'ring':
      return { ...common, kind,
        radius: defaults.RING_DEFAULT_RADIUS,
        thickness: defaults.RING_DEFAULT_THICKNESS,
      }
    case 'ellipse':
      return { ...common, kind,
        radiusX: defaults.ELLIPSE_DEFAULT_RADIUS_X,
        radiusY: defaults.ELLIPSE_DEFAULT_RADIUS_Y,
        thickness: defaults.ELLIPSE_DEFAULT_THICKNESS,
      }
    case 'rectangle':
      return { ...common, kind,
        width: defaults.RECTANGLE_DEFAULT_WIDTH,
        height: defaults.RECTANGLE_DEFAULT_HEIGHT,
        thickness: defaults.RECTANGLE_DEFAULT_THICKNESS,
      }
    case 'arrow':
      return { ...common, kind,
        width: defaults.ARROW_DEFAULT_WIDTH,
        height: defaults.ARROW_DEFAULT_HEIGHT,
        thickness: defaults.ARROW_DEFAULT_THICKNESS,
        angle: defaults.ARROW_DEFAULT_ANGLE,
      }
    case 'line':
      return { ...common, kind,
        length: defaults.LINE_DEFAULT_LENGTH,
        thickness: defaults.LINE_DEFAULT_THICKNESS,
        angle: defaults.LINE_DEFAULT_ANGLE,
      }
  }
}
