export const DEFAULT_NODE_COLORS = [
  '#22d3ee',
  '#a855f7',
  '#10b981',
  '#f97316',
  '#facc15',
  '#38bdf8',
  '#fb7185',
] as const

export type NodeColor = (typeof DEFAULT_NODE_COLORS)[number]
