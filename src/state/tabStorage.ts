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
