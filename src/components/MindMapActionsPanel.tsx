import type { ReactNode } from 'react'

export type MindMapActionButton = {
  key: string
  label: string
  title: string
  disabled?: boolean
  onClick: () => void
  ariaPressed?: boolean
  ariaLabel?: string
  icon?: ReactNode
  hiddenLabel?: string
}

export type MindMapActionGroup = {
  key: string
  label: string
  buttons: MindMapActionButton[]
}

type MindMapActionsPanelProps = {
  isCollapsed: boolean
  actionsBodyId: string
  title: string
  onToggleCollapse: () => void
  toggleTitle: string
  toggleLabel: string
  toggleIcon: string
  groups: MindMapActionGroup[]
}

export function MindMapActionsPanel({
  isCollapsed,
  actionsBodyId,
  title,
  onToggleCollapse,
  toggleTitle,
  toggleLabel,
  toggleIcon,
  groups,
}: MindMapActionsPanelProps) {
  const className = `mindmap-actions${isCollapsed ? ' mindmap-actions--collapsed' : ''}`

  return (
    <div className={className} role="group" aria-label="Edit commands">
      <div className="mindmap-actions__header">
        <div className="mindmap-actions__summary">
          <span className="mindmap-actions__eyebrow">Canvas controls</span>
          <span className="mindmap-actions__title">{title}</span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mindmap-actions__collapse-button"
          aria-expanded={!isCollapsed}
          aria-controls={actionsBodyId}
          title={toggleTitle}
        >
          <span aria-hidden="true">{toggleIcon}</span>
          <span className="visually-hidden">{toggleLabel}</span>
        </button>
      </div>
      <div id={actionsBodyId} className="mindmap-actions__body" hidden={isCollapsed}>
        {groups.map((group) => (
          <div className="mindmap-actions__group" key={group.key}>
            <span className="mindmap-actions__group-label">{group.label}</span>
            <div className="mindmap-actions__row">
              {group.buttons.map((button) => (
                <button
                  key={button.key}
                  type="button"
                  onClick={button.onClick}
                  disabled={button.disabled}
                  title={button.title}
                  aria-pressed={button.ariaPressed}
                  aria-label={button.ariaLabel}
                >
                  {button.icon ? (
                    <span aria-hidden="true" className="mindmap-actions__icon">
                      {button.icon}
                    </span>
                  ) : null}
                  {button.hiddenLabel ? (
                    <span className="visually-hidden">{button.hiddenLabel}</span>
                  ) : (
                    button.label
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
