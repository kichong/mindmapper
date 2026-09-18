import type { ReactNode } from 'react'

// The grid reserves space for commands before sizing the scrollable tool rail.
export function MindMapControlDock({ children }: { children: ReactNode }) {
  return <div className="mindmap-left-dock">{children}</div>
}
