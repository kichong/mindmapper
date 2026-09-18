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
  tone?: 'neutral' | 'cyan' | 'violet' | 'mint' | 'amber' | 'coral'
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
  showTextControls: boolean
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
  showColorControls: boolean
  colorControlLabel: string
  hasMixedColors: boolean
  colorApplyTarget: string
  isColorDisabled: boolean
  colorOptions: NodeColorOption[]
  onColorChange: (color: string) => void
  showShapeThickness: boolean
  shapeThickness: number
  shapeThicknessMin: number
  shapeThicknessMax: number
  onShapeThicknessChange: ChangeEventHandler<HTMLInputElement>
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
  showTextControls,
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
  showColorControls,
  colorControlLabel,
  hasMixedColors,
  colorApplyTarget,
  isColorDisabled,
  colorOptions,
  onColorChange,
  showShapeThickness,
  shapeThickness,
  shapeThicknessMin,
  shapeThicknessMax,
  onShapeThicknessChange,
}: MindMapToolbarProps) {
  const className = `mindmap-toolbar${isCollapsed ? ' mindmap-toolbar--collapsed' : ''}`

  return (
    <div className={className}>
      <div className="mindmap-toolbar__header">
        <div className="mindmap-toolbar__toolset">
          <div className="mindmap-toolbar__quick-actions mindmap-toolbar__quick-actions--ideas" role="group" aria-label="Create and link items">
            {creationActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                title={action.title}
                aria-label={action.ariaLabel}
                className={`mindmap-toolbar__tool-button mindmap-toolbar__tool-button--${action.tone ?? 'neutral'}`}
                disabled={action.disabled}
              >
                {action.icon}
                <span className="visually-hidden">{action.hiddenLabel}</span>
              </button>
            ))}
          </div>
          <div className="mindmap-toolbar__quick-actions mindmap-toolbar__quick-actions--shapes" role="group" aria-label="Create shapes">
            {shapeActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                title={action.title}
                aria-label={action.ariaLabel}
                className={`mindmap-toolbar__tool-button mindmap-toolbar__tool-button--${action.tone ?? 'neutral'}`}
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
              {showTextControls ? <label className="mindmap-toolbar__text-control">
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
              </label> : null}
              {showTextControls ? <label className="mindmap-toolbar__text-control">
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
              </label> : null}
              {showColorControls ? (
                <div className="mindmap-toolbar__text-control mindmap-toolbar__color-control">
                  <span className="mindmap-toolbar__text-label">
                    {hasMixedColors ? `${colorControlLabel} (mixed)` : colorControlLabel}
                  </span>
                  <div className="mindmap-toolbar__color-options" role="group" aria-label={colorControlLabel}>
                    {colorOptions.map((option) => {
                      const swatchClassName = `mindmap-toolbar__color-swatch${
                        option.isSelected ? ' mindmap-toolbar__color-swatch--selected' : ''
                      }`

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={swatchClassName}
                          style={{ backgroundColor: option.value }}
                          onClick={() => onColorChange(option.value)}
                          aria-pressed={option.isSelected}
                          aria-label={`Apply ${option.label} to ${colorApplyTarget}`}
                          title={
                            isColorDisabled
                              ? 'Unlock edits to change color'
                              : `Apply ${option.label} to ${colorApplyTarget}`
                          }
                          disabled={isColorDisabled}
                        >
                          <span className="visually-hidden">
                            {option.isSelected
                              ? `${option.label} selected for ${colorApplyTarget}`
                              : `Use ${option.label} for ${colorApplyTarget}`}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {showShapeThickness ? (
                <label className="mindmap-toolbar__text-control mindmap-toolbar__thickness-control">
                  <span className="mindmap-toolbar__text-label">
                    Stroke <output>{Math.round(shapeThickness)} px</output>
                  </span>
                  <input
                    className="mindmap-toolbar__range"
                    type="range"
                    min={shapeThicknessMin}
                    max={shapeThicknessMax}
                    step="1"
                    value={shapeThickness}
                    onChange={onShapeThicknessChange}
                    disabled={isColorDisabled}
                    aria-label="Selected shape stroke width"
                  />
                </label>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
