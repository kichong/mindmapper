import { useCallback, useEffect, useRef } from 'react'
import { STORAGE_KEY, type MindMapState } from './mindMapReducer'

// Serialize only after interaction settles. Page lifecycle events flush the latest
// committed state, so navigating away before the debounce expires keeps edits.
export function useMindMapPersistence(state: MindMapState) {
  const latest = useRef(state)
  const pending = useRef(false)
  const flush = useCallback(() => {
    if (!pending.current) return
    try {
      const { nodes, annotations, shapes, crossLinks, selectedNodeIds, selectedAnnotationId, selectedShapeId } = latest.current
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        nodes, annotations, shapes, crossLinks, selectedNodeIds, selectedAnnotationId, selectedShapeId,
      }))
      pending.current = false
    } catch (error) {
      console.error('Failed to persist mind map state', error)
    }
  }, [])

  useEffect(() => {
    latest.current = state
    pending.current = true
    const timer = window.setTimeout(flush, 250)
    return () => window.clearTimeout(timer)
  }, [state, flush])

  useEffect(() => {
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [flush])
}
