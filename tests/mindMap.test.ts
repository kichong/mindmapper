import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { initialState, mindMapReducer as reduce, loadPersistedState } from '../src/state/mindMapReducer'
import { parseImportedMindMapDocument as parse, serializeMindMapDocument as serialize } from '../src/utils/mindMapDocument'
import { createShape } from '../src/utils/createShape'

const node = { id: 'old', parentId: null, text: 'Legacy', x: 10, y: -20 }
const shapeA = createShape('ring', { x: -200, y: 100 }, '#5bc0ce')
const shapeB = createShape('rectangle', { x: 200, y: 100 }, '#8f84d8')
const grouped = () => {
  let state = reduce(initialState, { type: 'ADD_SHAPE', shape: shapeA })
  state = reduce(state, { type: 'ADD_SHAPE', shape: shapeB })
  return reduce(state, { type: 'SET_SELECTED_SHAPES', shapeIds: [shapeA.id, shapeB.id] })
}

test('legacy node-only maps retain content and normalize omitted styling', () => {
  const document = parse({ nodes: [node], metadata: { old: true } })!
  assert.equal(document.nodes[0].color, '#4f46e5')
  assert.equal(document.nodes[0].textSize, 'medium')
  assert.equal(document.nodes[0].x, 10)
  assert.deepEqual(document.shapes, [])
  assert.equal(parse({ nodes: [null, {}] }), null)
  assert.equal(parse({ shapes: [] }), null)
})

test('published llms.txt examples still import and round-trip', () => {
  const source = readFileSync('llms.txt', 'utf8')
  const examples = [...source.matchAll(/^\{\r?\n[\s\S]*?^\}/gm)].map(([json]) => JSON.parse(json)).filter((value) => Array.isArray(value.nodes))
  assert.ok(examples.length >= 3)
  for (const example of examples) {
    const document = parse(example)!
    assert.ok(document)
    assert.deepEqual(parse(JSON.parse(serialize(document))), document)
  }
})

test('all five shape kinds, annotations, cross-links and unknown metadata remain compatible', () => {
  const shapes = (['ring', 'ellipse', 'rectangle', 'arrow', 'line'] as const).map((kind) => createShape(kind, { x: 12, y: 45 }, '#123456'))
  const document = parse({ nodes: [node, { ...node, id: 'child', parentId: 'old', textSize: 'invalid' }], annotations: [{ id: 'label', text: 'Title', x: 0, y: 1 }], shapes,
    crossLinks: [{ id: 'link', sourceId: 'old', targetId: 'child' }], metadata: { version: 0 } })!
  assert.equal(document.shapes.length, 5)
  assert.equal(document.annotations[0].textSize, 'medium')
  assert.equal(document.crossLinks.length, 1)
  assert.deepEqual(parse(JSON.parse(serialize(document))), document)
  assert.deepEqual(Object.keys(JSON.parse(serialize(document))).sort(), ['annotations', 'crossLinks', 'exportedAt', 'nodes', 'shapes'])
})

test('empty and shape-only documents import, export and restore from storage', () => {
  for (const shapes of [[], [shapeA]]) {
    const document = parse({ nodes: [], annotations: [], shapes, crossLinks: [] })!
    assert.ok(document)
    assert.deepEqual(parse(JSON.parse(serialize(document))), document)
    const oldWindow = globalThis.window
    Object.assign(globalThis, { window: { localStorage: { getItem: () => serialize(document) } } })
    try { assert.deepEqual(loadPersistedState().shapes, shapes) }
    finally { Object.assign(globalThis, { window: oldWindow }) }
  }
})

test('shape selection validates ids, preserves groups on edits and clears when nodes are selected', () => {
  const state = grouped()
  assert.deepEqual(state.selectedShapeIds, [shapeA.id, shapeB.id])
  assert.deepEqual(state.selectedNodeIds, [])
  assert.equal(reduce(state, { type: 'SET_SELECTED_SHAPES', shapeIds: [shapeA.id, shapeA.id, 'missing'] }).selectedShapeIds.length, 1)
  assert.equal(reduce(state, { type: 'SET_SELECTED_NODES', nodeIds: ['root'] }).selectedShapeIds.length, 0)
  assert.equal(reduce(state, { type: 'SELECT_SHAPE', shapeId: null }).selectedShapeIds.length, 0)
})

test('group movement is transient and group colors undo together without losing positions', () => {
  const state = grouped()
  const moved = reduce(state, { type: 'MOVE_SHAPES', updates: state.shapes.map((shape) => ({ shapeId: shape.id, x: shape.x + 50, y: shape.y + 20 })) })
  assert.equal(moved.history, state.history)
  assert.equal(moved.shapes[0].x, shapeA.x + 50)
  const colored = reduce(moved, { type: 'COLOR_SHAPES', shapeIds: state.selectedShapeIds, color: '#ff0000' })
  assert.equal(colored.history.past.length, moved.history.past.length + 1)
  const undone = reduce(colored, { type: 'UNDO' })
  assert.deepEqual(undone.shapes, moved.shapes)
  assert.deepEqual(undone.selectedShapeIds, state.selectedShapeIds)
  assert.deepEqual(reduce(undone, { type: 'REDO' }).shapes, colored.shapes)
})

test('group deletion is one undo step and history shares immutable records', () => {
  const state = grouped()
  const deleted = reduce(state, { type: 'DELETE_SHAPES', shapeIds: state.selectedShapeIds })
  assert.equal(deleted.shapes.length, 0)
  assert.deepEqual(deleted.selectedShapeIds, [])
  assert.equal(deleted.history.past.at(-1)!.nodes, state.nodes)
  assert.equal(deleted.history.past.at(-1)!.shapes, state.shapes)
  assert.deepEqual(reduce(deleted, { type: 'UNDO' }).shapes, state.shapes)
  assert.equal(state.shapes.length, 2)
})
