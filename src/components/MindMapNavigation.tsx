type MindMapNavigationProps = {
  zoomPercentage: number
  canZoomOut: boolean
  canZoomIn: boolean
  onResetView: () => void
  onZoomOut: () => void
  onZoomIn: () => void
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
  onResetView,
  onZoomOut,
  onZoomIn,
}: MindMapNavigationProps) {
  return (
    <div className="mindmap-navigation" role="group" aria-label="Viewport navigation controls">
      <div className="mindmap-navigation__zoom" aria-live="polite">
        <button type="button" onClick={onResetView} aria-label="Center view" title="Center view (C)">
          <CrosshairIcon />
        </button>
        <button type="button" onClick={onZoomOut} disabled={!canZoomOut} aria-label="Zoom out" title="Zoom out (-)">
          <ZoomIcon mode="out" />
        </button>
        <span>{zoomPercentage}%</span>
        <button type="button" onClick={onZoomIn} disabled={!canZoomIn} aria-label="Zoom in" title="Zoom in (+)">
          <ZoomIcon mode="in" />
        </button>
      </div>
    </div>
  )
}
