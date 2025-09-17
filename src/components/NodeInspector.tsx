import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { DEFAULT_NODE_COLORS, type NodeColor } from '../constants/palette'
import { useMindMap } from '../state/MindMapContext'

interface NodeInspectorProps {
  palette?: readonly NodeColor[]
}

const DEFAULT_PALETTE = DEFAULT_NODE_COLORS

export default function NodeInspector({ palette = DEFAULT_PALETTE }: NodeInspectorProps) {
  const {
    state: { nodes, selectedNodeId },
    dispatch,
  } = useMindMap()

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const [draftLabel, setDraftLabel] = useState(selectedNode?.text ?? '')

  useEffect(() => {
    setDraftLabel(selectedNode?.text ?? '')
  }, [selectedNode?.id, selectedNode?.text])

  const commitLabel = useCallback(() => {
    if (!selectedNode) {
      return
    }

    const trimmed = draftLabel.trim()
    const nextLabel = trimmed.length > 0 ? trimmed : 'Untitled'

    if (nextLabel === selectedNode.text) {
      if (trimmed.length === draftLabel.length) {
        return
      }
    }

    dispatch({
      type: 'UPDATE_NODE',
      nodeId: selectedNode.id,
      updates: { text: nextLabel },
    })
  }, [dispatch, draftLabel, selectedNode])

  const handleLabelChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraftLabel(event.target.value)
  }, [])

  const handleLabelBlur = useCallback(() => {
    commitLabel()
  }, [commitLabel])

  const handleLabelKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitLabel()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setDraftLabel(selectedNode?.text ?? '')
      }
    },
    [commitLabel, selectedNode?.text],
  )

  const handleColorSelect = useCallback(
    (color: string) => {
      if (!selectedNode || color === selectedNode.color) {
        return
      }

      dispatch({
        type: 'UPDATE_NODE',
        nodeId: selectedNode.id,
        updates: { color },
      })
    },
    [dispatch, selectedNode],
  )

  const handleColorInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleColorSelect(event.target.value)
    },
    [handleColorSelect],
  )

  if (!selectedNode) {
    return (
      <aside className="node-inspector" aria-live="polite">
        <h2 className="node-inspector__title">Node details</h2>
        <p className="node-inspector__hint">Select a node to edit its label or color.</p>
      </aside>
    )
  }

  return (
    <aside className="node-inspector" aria-live="polite">
      <h2 className="node-inspector__title">Node details</h2>
      <label className="node-inspector__field">
        <span className="node-inspector__label">Label</span>
        <input
          value={draftLabel}
          onChange={handleLabelChange}
          onBlur={handleLabelBlur}
          onKeyDown={handleLabelKeyDown}
          placeholder="Node title"
          className="node-inspector__input"
          type="text"
        />
      </label>
      <fieldset className="node-inspector__field">
        <legend className="node-inspector__label">Color</legend>
        <div className="node-inspector__swatches">
          {palette.map((color) => {
            const isActive = color === selectedNode.color
            return (
              <button
                key={color}
                type="button"
                className={`node-inspector__swatch${isActive ? ' node-inspector__swatch--active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                aria-label={`Use color ${color}`}
                aria-pressed={isActive}
              />
            )
          })}
          <label className="node-inspector__color-picker">
            <span className="node-inspector__sr-only">Custom color</span>
            <input type="color" value={selectedNode.color} onChange={handleColorInput} />
          </label>
        </div>
      </fieldset>
    </aside>
  )
}
