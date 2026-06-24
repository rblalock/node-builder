import { describe, expect, it, beforeEach } from 'vitest'
import {
  createRootNode,
  deleteNode,
  insertEdgeNode,
  placeChildAtAngle,
  resetIdCounter,
  updateChildDistance,
} from './graphMutations'
import { edgeMidpoint, radialDistance, wedgeBisectorAngle } from './geometry'
import { assertChildPlacementInvariant } from './placement.test'
import type { GraphState } from '../types/graph'

const empty: GraphState = { nodes: {}, rootIds: [], selectedNodeId: null }

describe('graphMutations', () => {
  beforeEach(() => resetIdCounter())

  it('creates root node on empty graph', () => {
    const next = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    expect(next.rootIds).toHaveLength(1)
    expect(Object.keys(next.nodes)).toHaveLength(1)
    expect(next.nodes[next.rootIds[0]].wedges).toHaveLength(0)
  })

  it('places child at computed radial position', () => {
    const withRoot = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = withRoot.rootIds[0]
    const angle = 0
    const { state, error } = placeChildAtAngle(withRoot, rootId, angle, 'large', 'standard', 100)
    expect(error).toBeUndefined()
    const wedge = state.nodes[rootId].wedges[0]
    const childId = wedge.childNodeId!
    const child = state.nodes[childId]
    expect(child.x).toBeCloseTo(400 + Math.cos(angle) * 100, 1)
    expect(child.y).toBeCloseTo(300 - Math.sin(angle) * 100, 1)
    expect(child.distance).toBe(100)
    expect(child.wedges.some((w) => w.state === 'reserved')).toBe(true)
    assertChildPlacementInvariant(state.nodes[rootId], child)
  })

  it('allows multiple children in different directions from one parent', () => {
    let graph = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = graph.rootIds[0]
    graph = placeChildAtAngle(graph, rootId, 0, 'large', 'standard', 60).state
    const second = placeChildAtAngle(graph, rootId, Math.PI / 2, 'large', 'standard', 80)
    const third = placeChildAtAngle(second.state, rootId, Math.PI, 'large', 'standard', 100)
    expect(second.error).toBeUndefined()
    expect(third.error).toBeUndefined()
    expect(third.state.nodes[rootId].wedges.filter((w) => w.state === 'occupied')).toHaveLength(3)
  })

  it('allows branching from a child node beside its incoming wedge', () => {
    let graph = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = graph.rootIds[0]
    graph = placeChildAtAngle(graph, rootId, Math.PI / 4, 'large', 'standard', 80).state
    const childId = graph.nodes[rootId].wedges[0].childNodeId!
    const branch = placeChildAtAngle(graph, childId, 0, 'large', 'standard', 70)
    expect(branch.error).toBeUndefined()
    expect(branch.state.nodes[childId].wedges.filter((w) => w.state === 'occupied')).toHaveLength(1)
  })

  it('allows child nodes to grow their own branches', () => {
    let graph = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = graph.rootIds[0]
    graph = placeChildAtAngle(graph, rootId, 0, 'large', 'standard', 100).state
    const childId = graph.nodes[rootId].wedges[0].childNodeId!
    const grandchild = placeChildAtAngle(graph, childId, Math.PI / 2, 'large', 'standard', 90)
    expect(grandchild.error).toBeUndefined()
    expect(grandchild.state.nodes[childId].wedges.some((w) => w.state === 'occupied')).toBe(true)
  })

  it('updates child distance radially only', () => {
    const withRoot = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = withRoot.rootIds[0]
    const angle = 0
    const placed = placeChildAtAngle(withRoot, rootId, angle, 'large', 'standard', 100).state
    const wedge = placed.nodes[rootId].wedges[0]
    const childId = wedge.childNodeId!
    const moved = updateChildDistance(placed, childId, 150)
    const child = moved.nodes[childId]
    expect(child.distance).toBe(150)
    expect(child.x).toBeCloseTo(400 + Math.cos(angle) * 150, 1)
    expect(child.y).toBeCloseTo(300 - Math.sin(angle) * 150, 1)
    assertChildPlacementInvariant(moved.nodes[rootId], child)
  })

  it('inserts edge node with correct insert and continued child placement invariants', () => {
    const withRoot = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = withRoot.rootIds[0]
    const placed = placeChildAtAngle(withRoot, rootId, 0, 'large', 'standard', 120).state
    const wedge = placed.nodes[rootId].wedges[0]
    const childId = wedge.childNodeId!
    const parent = placed.nodes[rootId]
    const childBefore = placed.nodes[childId]
    const mid = edgeMidpoint(parent, childBefore)

    const inserted = insertEdgeNode(placed, rootId, childId)
    expect(inserted.error).toBeUndefined()

    const insertId = inserted.state.nodes[rootId].wedges.find((w) => w.id === wedge.id)!.childNodeId!
    const insertNode = inserted.state.nodes[insertId]
    const childAfter = inserted.state.nodes[childId]

    expect(insertNode.x).toBeCloseTo(mid.x, 1)
    expect(insertNode.y).toBeCloseTo(mid.y, 1)
    expect(insertNode.kind).toBe('edge-insert')
    expect(insertNode.distance).not.toBe(childBefore.distance)

    const contWedge = insertNode.wedges.find((w) => w.childNodeId === childId)!
    expect(contWedge.state).toBe('occupied')
    const branchWedge = insertNode.wedges.find((w) => w.id !== contWedge.id)
    expect(branchWedge?.state).toBe('available')

    expect(childAfter.parentId).toBe(insertId)
    expect(childAfter.parentWedgeId).toBe(contWedge.id)
    expect(childAfter.distance).not.toBe(120)

    const contAngle = wedgeBisectorAngle(contWedge)
    const expectedChildDistance = radialDistance(
      insertNode,
      { x: childAfter.x, y: childAfter.y },
      contAngle,
    )
    expect(childAfter.distance).toBeCloseTo(expectedChildDistance, 3)

    assertChildPlacementInvariant(parent, insertNode)
    assertChildPlacementInvariant(insertNode, childAfter)
  })

  it('deleteNode removes subtree and frees parent wedge', () => {
    const withRoot = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = withRoot.rootIds[0]
    const placed = placeChildAtAngle(withRoot, rootId, 0, 'large', 'standard', 100).state
    const wedge = placed.nodes[rootId].wedges[0]
    const childId = wedge.childNodeId!
    const deleted = deleteNode(placed, childId)
    expect(deleted.nodes[childId]).toBeUndefined()
    expect(deleted.nodes[rootId].wedges.find((w) => w.id === wedge.id)).toBeUndefined()
  })

  it('placeChildAtAngle allows small child on large parent', () => {
    const withRoot = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = withRoot.rootIds[0]
    const result = placeChildAtAngle(withRoot, rootId, 0, 'small', 'standard', 100)
    expect(result.error).toBeUndefined()
    const childId = result.state.nodes[rootId].wedges[0].childNodeId!
    expect(result.state.nodes[childId].size).toBe('small')
  })

  it('placeChildAtAngle allows small branch off small child', () => {
    let graph = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = graph.rootIds[0]
    graph = placeChildAtAngle(graph, rootId, 0, 'small', 'standard', 80).state
    const childId = graph.nodes[rootId].wedges[0].childNodeId!
    const branch = placeChildAtAngle(graph, childId, Math.PI / 2, 'small', 'standard', 60)
    expect(branch.error).toBeUndefined()
    expect(Object.keys(branch.state.nodes)).toHaveLength(3)
  })
})