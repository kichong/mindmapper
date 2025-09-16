/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer } from 'react';

export interface MindNode {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
}

interface Snapshot {
  nodes: Record<string, MindNode>;
  selectedId: string | null;
}

interface MindMapState extends Snapshot {
  rootId: string;
  past: Snapshot[];
  future: Snapshot[];
}

const initialState: MindMapState = {
  nodes: {
    root: { id: 'root', parentId: null, text: 'Root', x: 0, y: 0 },
  },
  rootId: 'root',
  selectedId: 'root',
  past: [],
  future: [],
};

type MindMapAction =
  | { type: 'ADD_NODE'; parentId: string }
  | { type: 'SELECT_NODE'; id: string }
  | { type: 'MOVE_NODE'; id: string; x: number; y: number }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function cloneSnapshot(state: Snapshot): Snapshot {
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    selectedId: state.selectedId,
  };
}

function reducer(state: MindMapState, action: MindMapAction): MindMapState {
  switch (action.type) {
    case 'ADD_NODE': {
      const id = crypto.randomUUID();
      const parent = state.nodes[action.parentId];
      const node: MindNode = {
        id,
        parentId: action.parentId,
        text: 'New node',
        x: parent.x + 120,
        y: parent.y,
      };
      return {
        ...state,
        past: [...state.past, cloneSnapshot(state)],
        future: [],
        nodes: { ...state.nodes, [id]: node },
        selectedId: id,
      };
    }
    case 'SELECT_NODE':
      return { ...state, selectedId: action.id };
    case 'MOVE_NODE': {
      const node = state.nodes[action.id];
      return {
        ...state,
        past: [...state.past, cloneSnapshot(state)],
        future: [],
        nodes: {
          ...state.nodes,
          [action.id]: { ...node, x: action.x, y: action.y },
        },
      };
    }
    case 'UNDO': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      const newPast = state.past.slice(0, -1);
      return {
        ...state,
        nodes: previous.nodes,
        selectedId: previous.selectedId,
        past: newPast,
        future: [cloneSnapshot(state), ...state.future],
      };
    }
    case 'REDO': {
      const next = state.future[0];
      if (!next) return state;
      const newFuture = state.future.slice(1);
      return {
        ...state,
        nodes: next.nodes,
        selectedId: next.selectedId,
        past: [...state.past, cloneSnapshot(state)],
        future: newFuture,
      };
    }
    default:
      return state;
  }
}

const MindMapContext = createContext<{
  state: MindMapState;
  dispatch: React.Dispatch<MindMapAction>;
}>({ state: initialState, dispatch: () => {} });

export function MindMapProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <MindMapContext.Provider value={{ state, dispatch }}>
      {children}
    </MindMapContext.Provider>
  );
}

export function useMindMap() {
  return useContext(MindMapContext);
}

