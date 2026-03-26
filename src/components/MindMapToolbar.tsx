import type {
  ChangeEventHandler,
  KeyboardEventHandler,
  ReactNode,
  RefObject,
} from 'react'
import type { TextSize } from '../state/mindMapModel'

export type ToolbarActionButton = {
  key: string
  title: string
  ariaLabel: string
  disabled: boolean
  onClick: () => void
  icon: ReactNode
  hiddenLabel: string
}

type TextSizeOption = {
  value: TextSize
  label: string
}

type NodeColorOption = {
  value: string
  label: string
  isSelected: boolean
}

type MindMapToolbarProps = {
  isCollapsed: boolean
  toolbarBodyId: string
  onToggleCollapse: () => void
  creationActions: ToolbarActionButton[]
  shapeActions: ToolbarActionButton[]
  textEditorLabel: string
  textDraft: string
  onTextChange: ChangeEventHandler<HTMLInputElement>
  onTextKeyDown: KeyboardEventHandler<HTMLInputElement>
  textInputPlaceholder: string
  isTextEditingDisabled: boolean
  textInputAriaLabel: string
  textInputTitle?: string
  textInputRef: RefObject<HTMLInputElement | null>
  selectedTextSize: TextSize
  onTextSizeChange: ChangeEventHandler<HTMLSelectElement>
  textSizeAriaLabel: string
  textSizeTitle?: string
  textSizeOptions: TextSizeOption[]
  showNodeColorControls: boolean
  hasMixedNodeColors: boolean
  nodeColorApplyTarget: string
  isNodeColorDisabled: boolean
  nodeColorOptions: NodeColorOption[]
  onNodeColorChange: (color: string) => void
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="mindmap-toolbar__toggle-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d={collapsed ? 'M5 7.5 10 12.5 15 7.5' : 'M5 12.5 10 7.5 15 12.5'}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function MindMapToolbar({
  isCollapsed,
  toolbarBodyId,
  onToggleCollapse,
  creationActions,
  shapeActions,
  textEditorLabel,
  textDraft,
  onTextChange,
  onTextKeyDown,
  textInputPlaceholder,
  isTextEditingDisabled,
  textInputAriaLabel,
  textInputTitle,
  textInputRef,
  selectedTextSize,
  onTextSizeChange,
  textSizeAriaLabel,
  textSizeTitle,
  textSizeOptions,
  showNodeColorControls,
  hasMixedNodeColors,
  nodeColorApplyTarget,
  isNodeColorDisabled,
  nodeColorOptions,
  onNodeColorChange,
}: MindMapToolbarProps) {
  const className = `mindmap-toolbar${isCollapsed ? ' mindmap-toolbar--collapsed' : ''}`

  return (
    <div className={className}>
      <div className="mindmap-toolbar__header">
        <div className="mindmap-toolbar__toolset">
          <div className="mindmap-toolbar__quick-actions" role="group" aria-label="Create and link items">
            {creationActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                title={action.title}
                aria-label={action.ariaLabel}
                className="mindmap-toolbar__symbol-button"
                disabled={action.disabled}
              >
                {action.icon}
                <span className="visually-hidden">{action.hiddenLabel}</span>
              </button>
            ))}
          </div>
          <div className="mindmap-toolbar__quick-actions" role="group" aria-label="Create shapes">
            {shapeActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                title={action.title}
                aria-label={action.ariaLabel}
                className="mindmap-toolbar__icon-button"
                disabled={action.disabled}
              >
                {action.icon}
                <span className="visually-hidden">{action.hiddenLabel}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mindmap-toolbar__toggle"
          aria-expanded={!isCollapsed}
          aria-controls={toolbarBodyId}
          aria-label={isCollapsed ? 'Open edit controls' : 'Close edit controls'}
          title={isCollapsed ? 'Open edit controls' : 'Close edit controls'}
        >
          <span className="mindmap-toolbar__toggle-copy">Edit</span>
          <ChevronIcon collapsed={isCollapsed} />
        </button>
      </div>
      {isCollapsed ? null : (
        <div className="mindmap-toolbar__body" id={toolbarBodyId}>
          <div className="mindmap-toolbar__row mindmap-toolbar__row--editors">
            <div className="mindmap-toolbar__text-editor">
              <label className="mindmap-toolbar__text-control">
                <span className="mindmap-toolbar__text-label">{textEditorLabel}</span>
                <input
                  type="text"
                  value={textDraft}
                  onChange={onTextChange}
                  onKeyDown={onTextKeyDown}
                  placeholder={textInputPlaceholder}
                  disabled={isTextEditingDisabled}
                  aria-label={textInputAriaLabel}
                  className="mindmap-toolbar__text-input"
                  ref={textInputRef}
                  title={textInputTitle}
                />
              </label>
              <label className="mindmap-toolbar__text-control">
                <span className="mindmap-toolbar__text-label">Text size</span>
                <select
                  value={selectedTextSize}
                  onChange={onTextSizeChange}
                  disabled={isTextEditingDisabled}
                  aria-label={textSizeAriaLabel}
                  className="mindmap-toolbar__text-select"
                  title={textSizeTitle}
                >
                  {textSizeOptions.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </label>
              {showNodeColorControls ? (
                <div className="mindmap-toolbar__text-control mindmap-toolbar__color-control">
                  <span className="mindmap-toolbar__text-label">
                    {hasMixedNodeColors ? 'Node color (mixed)' : 'Node color'}
                  </span>
                  <div className="mindmap-toolbar__color-options" role="group" aria-label="Node color">
                    {nodeColorOptions.map((option) => {
                      const swatchClassName = `mindmap-toolbar__color-swatch${
                        option.isSelected ? ' mindmap-toolbar__color-swatch--selected' : ''
                      }`

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={swatchClassName}
                          style={{ backgroundColor: option.value }}
                          onClick={() => onNodeColorChange(option.value)}
                          aria-pressed={option.isSelected}
                          aria-label={`Apply ${option.label} to ${nodeColorApplyTarget}`}
                          title={
                            isNodeColorDisabled
                              ? 'Unlock edits to change color'
                              : `Apply ${option.label} to ${nodeColorApplyTarget}`
                          }
                          disabled={isNodeColorDisabled}
                        >
                          <span className="visually-hidden">
                            {option.isSelected
                              ? `${option.label} selected for ${nodeColorApplyTarget}`
                              : `Use ${option.label} for ${nodeColorApplyTarget}`}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
