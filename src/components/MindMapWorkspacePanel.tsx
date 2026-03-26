import type { ChangeEventHandler, RefObject } from 'react'

type KeyboardShortcut = {
  keys: string
  description: string
}

type MindMapWorkspacePanelProps = {
  workspaceStatus: string
  isLocked: boolean
  onImportJson: () => void
  isExportMenuOpen: boolean
  onToggleExportMenu: () => void
  onExportJson: () => void
  onExportPng: () => void
  exportMenuRef: RefObject<HTMLDivElement | null>
  isShortcutsOpen: boolean
  onToggleShortcutsMenu: () => void
  shortcutsMenuId: string
  shortcuts: readonly KeyboardShortcut[]
  shortcutsVisibleHeight: number | null
  shortcutsMenuRef: RefObject<HTMLDivElement | null>
  shortcutsListRef: RefObject<HTMLUListElement | null>
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: ChangeEventHandler<HTMLInputElement>
}

export function MindMapWorkspacePanel({
  workspaceStatus,
  isLocked,
  onImportJson,
  isExportMenuOpen,
  onToggleExportMenu,
  onExportJson,
  onExportPng,
  exportMenuRef,
  isShortcutsOpen,
  onToggleShortcutsMenu,
  shortcutsMenuId,
  shortcuts,
  shortcutsVisibleHeight,
  shortcutsMenuRef,
  shortcutsListRef,
  fileInputRef,
  onFileChange,
}: MindMapWorkspacePanelProps) {
  return (
    <div className="mindmap-io-panel">
      <div className="mindmap-io-panel__summary">
        <span className="mindmap-io-panel__eyebrow">Workspace</span>
        <span className="mindmap-io-panel__title">{workspaceStatus}</span>
      </div>
      <div className="mindmap-io-panel__actions">
        <button
          type="button"
          onClick={onImportJson}
          title="Load from JSON file"
          className="mindmap-toolbar__io-button"
          disabled={isLocked}
        >
          Import
        </button>
        <div className="mindmap-io-panel__export" ref={exportMenuRef}>
          <button
            type="button"
            onClick={onToggleExportMenu}
            className="mindmap-toolbar__io-button"
            aria-expanded={isExportMenuOpen}
            aria-haspopup="true"
            title="Download a copy of your map"
          >
            Export
          </button>
          {isExportMenuOpen ? (
            <div className="mindmap-io-panel__export-menu" role="menu">
              <button type="button" onClick={onExportJson} role="menuitem">
                Export JSON
              </button>
              <button type="button" onClick={onExportPng} role="menuitem">
                Export PNG
              </button>
            </div>
          ) : null}
        </div>
        <div className="mindmap-shortcuts" ref={shortcutsMenuRef}>
          <button
            type="button"
            onClick={onToggleShortcutsMenu}
            className="mindmap-toolbar__io-button"
            aria-expanded={isShortcutsOpen}
            aria-haspopup="dialog"
            aria-controls={shortcutsMenuId}
            title="See all keyboard shortcuts"
          >
            Shortcuts
          </button>
          {isShortcutsOpen ? (
            <div
              className="mindmap-shortcuts__menu"
              role="dialog"
              aria-modal="false"
              aria-label="Keyboard shortcuts"
              id={shortcutsMenuId}
            >
              <p className="mindmap-shortcuts__title">Keyboard shortcuts</p>
              <ul
                className="mindmap-shortcuts__list"
                ref={shortcutsListRef}
                style={shortcutsVisibleHeight !== null ? { maxHeight: shortcutsVisibleHeight } : undefined}
              >
                {shortcuts.map((shortcut) => (
                  <li className="mindmap-shortcuts__item" key={shortcut.keys}>
                    <span className="mindmap-shortcuts__keys">{shortcut.keys}</span>
                    <span className="mindmap-shortcuts__description">{shortcut.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
    </div>
  )
}
