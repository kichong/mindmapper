export type MindMapToolIconName =
  | 'child'
  | 'idea'
  | 'hierarchy'
  | 'cross-link'
  | 'text'
  | 'ring'
  | 'ellipse'
  | 'rectangle'
  | 'arrow'
  | 'line'

export function MindMapToolIcon({ name }: { name: MindMapToolIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.5,
  }

  return (
    <svg className="mindmap-toolbar__icon" viewBox="0 0 20 20" aria-hidden="true">
      {name === 'child' ? (
        <>
          <circle cx="5" cy="10" r="2.4" {...common} />
          <path d="M7.4 10h3.7" {...common} />
          <circle cx="14" cy="10" r="2.4" {...common} />
          <path d="M14 8.8v2.4M12.8 10h2.4" {...common} strokeWidth="1.15" />
        </>
      ) : null}
      {name === 'idea' ? (
        <>
          <circle cx="9" cy="10" r="4.6" {...common} />
          <path d="M14.8 4.5v3.4M13.1 6.2h3.4" {...common} strokeWidth="1.3" />
        </>
      ) : null}
      {name === 'hierarchy' ? (
        <>
          <circle cx="5.5" cy="10" r="2.5" {...common} />
          <circle cx="14.5" cy="10" r="2.5" {...common} />
          <path d="M8 10h4" {...common} />
        </>
      ) : null}
      {name === 'cross-link' ? (
        <>
          <circle cx="5" cy="12.5" r="2.3" {...common} />
          <circle cx="15" cy="7.5" r="2.3" {...common} />
          <path d="M7.1 11.6c2.4-.8 3.5-2.6 5.8-3.3" {...common} />
        </>
      ) : null}
      {name === 'text' ? (
        <>
          <path d="M5 5.5h10M10 5.5v9" {...common} />
          <path d="M7.5 14.5h5" {...common} />
        </>
      ) : null}
      {name === 'ring' ? (
        <>
          <circle cx="10" cy="10" r="6.2" {...common} />
          <circle cx="10" cy="10" r="3.5" {...common} opacity=".42" />
        </>
      ) : null}
      {name === 'ellipse' ? <ellipse cx="10" cy="10" rx="7" ry="4.5" {...common} /> : null}
      {name === 'rectangle' ? <rect x="3.5" y="5" width="13" height="10" rx="2.2" {...common} /> : null}
      {name === 'arrow' ? (
        <>
          <path d="M3.5 10h11" {...common} />
          <path d="m11.5 6.5 3.5 3.5-3.5 3.5" {...common} />
        </>
      ) : null}
      {name === 'line' ? (
        <>
          <path d="m4.5 14.5 11-9" {...common} />
          <circle cx="4.5" cy="14.5" r="1.2" fill="currentColor" />
          <circle cx="15.5" cy="5.5" r="1.2" fill="currentColor" />
        </>
      ) : null}
    </svg>
  )
}
