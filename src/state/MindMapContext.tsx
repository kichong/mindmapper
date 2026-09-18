/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useReducer, type Dispatch } from 'react'
import { mindMapReducer, loadPersistedState, type MindMapAction, type MindMapState } from './mindMapReducer'
import { useMindMapPersistence } from './useMindMapPersistence'
export { ROOT_NODE_ID } from './mindMapReducer'
export type { MindMapAction, MindMapState } from './mindMapReducer'
export {
  DEFAULT_NODE_COLOR,
  TEXT_SIZE_CHOICES,
  normalizeTextSize,
} from './mindMapModel'
export type {
  MindMapAnnotation,
  MindMapArrow,
  MindMapCrossLink,
  MindMapEllipse,
  MindMapLine,
  MindMapNode,
  MindMapRectangle,
  MindMapRing,
  MindMapShape,
  TextSize,
} from './mindMapModel'


interface MindMapContextValue {
  state: MindMapState
  dispatch: Dispatch<MindMapAction>
}
const MindMapContext = createContext<MindMapContextValue | undefined>(undefined)

export function MindMapProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mindMapReducer, undefined, loadPersistedState)
  const value = useMemo(() => ({ state, dispatch }), [state])

  useMindMapPersistence(state)

  return <MindMapContext.Provider value={value}>{children}</MindMapContext.Provider>
}

export function useMindMap() {
  const context = useContext(MindMapContext)
  if (!context) {
    throw new Error('useMindMap must be used within a MindMapProvider')
  }
  return context
}
