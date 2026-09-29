import { useCallback, useEffect, useRef } from 'react'
import { type MindMapState } from './mindMapReducer'
import { getTabId, newTabId, setTabId, tabStorageKey, LAST_SNAPSHOT_KEY } from './tabStorage'

// Serialize only after interaction settles. Page lifecycle events flush the latest
// committed state, so navigating away before the debounce expires keeps edits.
export function useMindMapPersistence(state: MindMapState) {
  const latest = useRef(state)
  const pending = useRef(false)
  const tabId = useRef<string | null>(null)
  if (tabId.current === null && typeof window !== 'undefined') tabId.current = getTabId()
  const flush = useCallback(() => {
    if (!pending.current) return
    try {
      const { nodes, annotations, shapes, crossLinks, selectedNodeIds, selectedAnnotationId, selectedShapeId } = latest.current
      if (!tabId.current) return
      const key = tabStorageKey(tabId.current)
      window.localStorage.setItem(key, JSON.stringify({
        nodes, annotations, shapes, crossLinks, selectedNodeIds, selectedAnnotationId, selectedShapeId,
      }))
      window.localStorage.setItem(LAST_SNAPSHOT_KEY, key)
      pending.current = false
    } catch (error) {
      console.error('Failed to persist mind map state', error)
    }
  }, [])

  useEffect(() => {
    if (!tabId.current || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('mindmapper:tabs')
    const instanceId = newTabId()
    channel.onmessage = (event: MessageEvent<{ type: string; tabId: string; instanceId: string }>) => {
      const message = event.data
      if (!message || message.tabId !== tabId.current || message.instanceId === instanceId) return
      if (message.type === 'hello') {
        channel.postMessage({ type: 'occupied', tabId: tabId.current, instanceId })
      } else if (message.type === 'occupied') {
        const nextId = newTabId()
        try {
          setTabId(nextId)
          tabId.current = nextId
          pending.current = true
          flush()
        } catch (error) {
          console.error('Failed to separate duplicated mind map tab', error)
        }
      }
    }
    channel.postMessage({ type: 'hello', tabId: tabId.current, instanceId })
    return () => channel.close()
  }, [flush])

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
