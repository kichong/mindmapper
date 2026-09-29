export const STORAGE_KEY = 'mindmapper:snapshot'
export const LAST_SNAPSHOT_KEY = 'mindmapper:last-snapshot-key'
const TAB_ID_KEY = 'mindmapper:tab-id'

export function newTabId(): string {
  return crypto.randomUUID()
}

export function getTabId(): string | null {
  try {
    let id = window.sessionStorage.getItem(TAB_ID_KEY)
    if (!id) {
      id = newTabId()
      window.sessionStorage.setItem(TAB_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export function setTabId(id: string): void {
  window.sessionStorage.setItem(TAB_ID_KEY, id)
}

export function tabStorageKey(id: string): string {
  return `${STORAGE_KEY}:${id}`
}

export function documentNameKey(id: string): string {
  return `mindmapper:filename:${id}`
}

export function loadDocumentName(): string {
  try {
    const id = getTabId()
    const latest = window.localStorage.getItem(LAST_SNAPSHOT_KEY)
    const latestId = latest?.startsWith(`${STORAGE_KEY}:`) ? latest.slice(STORAGE_KEY.length + 1) : null
    return (id && window.localStorage.getItem(documentNameKey(id)))
      ?? (latestId && window.localStorage.getItem(documentNameKey(latestId)))
      ?? 'mindmap'
  } catch {
    return 'mindmap'
  }
}

export function saveDocumentName(name: string): void {
  try {
    const id = getTabId()
    if (id) window.localStorage.setItem(documentNameKey(id), name)
  } catch (error) {
    console.error('Failed to save mind map file name', error)
  }
}
