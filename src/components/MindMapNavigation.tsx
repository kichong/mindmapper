type MindMapNavigationProps = {
  zoomPercentage: number
  canZoomOut: boolean
  canZoomIn: boolean
  onPanUp: () => void
  onPanLeft: () => void
  onResetView: () => void
  onPanRight: () => void
  onPanDown: () => void
  onZoomOut: () => void
  onZoomIn: () => void
}

function DirectionIcon({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) {
  const rotations = {
    up: 'rotate(0 10 10)',
    right: 'rotate(90 10 10)',
    down: 'rotate(180 10 10)',
    left: 'rotate(270 10 10)',
  }

  return (
    <svg className="mindmap-navigation__icon" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 4.5 15 10 12.8 10 12.8 15.5 7.2 15.5 7.2 10 5 10 10 4.5Z"
        transform={rotations[direction]}
        fill="currentColor"
      />
    </svg>
  )
}

function CrosshairIcon() {
  return (
    <svg className="mindmap-navigation__icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.5V5.2M10 14.8V17.5M2.5 10H5.2M14.8 10H17.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function ZoomIcon({ mode }: { mode: 'in' | 'out' }) {
  return (
    <svg className="mindmap-navigation__icon" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 5.6V14.4M5.6 10H14.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={mode === 'in' ? 1.8 : 0}
      />
      <path
        d="M5.6 10H14.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function MindMapNavigation({
  zoomPercentage,
  canZoomOut,
  canZoomIn,
  onPanUp,
  onPanLeft,
  onResetView,
  onPanRight,
  onPanDown,
  onZoomOut,
  onZoomIn,
}: MindMapNavigationProps) {
  return (
    <div className="mindmap-navigation" role="group" aria-label="Viewport navigation controls">
      <div className="mindmap-navigation__dpad">
        <div className="mindmap-navigation__spacer" aria-hidden="true" />
        <button type="button" onClick={onPanUp} aria-label="Pan up" title="Pan up (Arrow Up)">
          <DirectionIcon direction="up" />
        </button>
        <div className="mindmap-navigation__spacer" aria-hidden="true" />
        <button type="button" onClick={onPanLeft} aria-label="Pan left" title="Pan left (Arrow Left)">
          <DirectionIcon direction="left" />
        </button>
        <button
          type="button"
          onClick={onResetView}
          aria-label="Center view"
          title="Center view (C)"
          className="mindmap-navigation__center"
        >
          <CrosshairIcon />
        </button>
        <button
          type="button"
          onClick={onPanRight}
          aria-label="Pan right"
          title="Pan right (Arrow Right)"
        >
          <DirectionIcon direction="right" />
        </button>
        <div className="mindmap-navigation__spacer" aria-hidden="true" />
        <button type="button" onClick={onPanDown} aria-label="Pan down" title="Pan down (Arrow Down)">
          <DirectionIcon direction="down" />
        </button>
        <div className="mindmap-navigation__spacer" aria-hidden="true" />
      </div>
      <div className="mindmap-navigation__zoom" aria-live="polite">
        <button type="button" onClick={onZoomOut} disabled={!canZoomOut} title="Zoom out (-)">
          <ZoomIcon mode="out" />
        </button>
        <span>{zoomPercentage}%</span>
        <button type="button" onClick={onZoomIn} disabled={!canZoomIn} title="Zoom in (+)">
          <ZoomIcon mode="in" />
        </button>
      </div>
    </div>
  )
}
