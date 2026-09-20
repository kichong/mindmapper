import type { ReactNode } from 'react'

// Reserve room for bottom commands before sizing the horizontal creation bar.
export function MindMapControlDock({ children }: { children: ReactNode }) {
  return <div className="mindmap-left-dock">{children}</div>
}
