import { describe, expect, it, beforeEach } from 'vitest'
import {
  canAssignWedge,
  findFreeArcGaps,
  gapTooSmallForAnyWedge,
  proposeWedgeAtAngle,
  validateFreeArcPlacement,
  validatePlacementCapacity,
} from './wedgeCapacity'
import { createNode, makeWedgeAtBisector } from './sizeTiers'
import {
  createRootNode,
  placeChildAtAngle,
  preparePlacementWedge,
  resetIdCounter,
} from './graphMutations'
import type { GraphState, Wedge } from '../types/graph'

const empty: GraphState = { nodes: {}, rootIds: [], selectedNodeId: null }

describe('wedgeCapacity', () => {
  beforeEach(() => resetIdCounter())

  it('allows assigning active dynamic wedge during placement commit', () => {
    const graph = createRootNode(empty, 'large', 'standard', { x: 0, y: 0 })
    const rootId = graph.rootIds[0]
    const prepared = preparePlacementWedge(graph, rootId, 0, 'large', 'standard')
    expect(prepared.error).toBeUndefined()
    const wedgeId = prepared.wedgeId!
    expect(canAssignWedge(prepared.state.nodes[rootId], wedgeId)).toBe(true)
    expect(validatePlacementCapacity(prepared.state.nodes[rootId], wedgeId).ok).toBe(true)
  })

  it('allows multiple children at arbitrary angles on the same parent', () => {
    let graph = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = graph.rootIds[0]
    const angles = [0, Math.PI / 2, Math.PI]

    for (let i = 0; i < angles.length; i++) {
      const result = placeChildAtAngle(graph, rootId, angles[i], 'large', 'standard', 80 + i * 20)
      expect(result.error, `placement ${i} failed`).toBeUndefined()
      graph = result.state
    }

    const occupied = graph.nodes[rootId].wedges.filter((w) => w.state === 'occupied')
    expect(occupied).toHaveLength(3)
  })

  it('blocks wedge that would overlap occupied slot', () => {
    const occupied: Wedge = {
      id: 'occ',
      startAngle: 0,
      arcDegrees: 90,
      state: 'occupied',
      childSize: 'large',
      childNodeId: 'child-1',
    }
    const overlapping = makeWedgeAtBisector('overlap', 0, 'large')
    const patched = createNode('n', 'standard', 'large', 0, 0)
    patched.wedges = [occupied, overlapping]
    expect(canAssignWedge(patched, overlapping.id)).toBe(false)
  })

  it('allows free-arc placement in tight gaps when arcs do not overlap', () => {
    const node = createNode('n', 'standard', 'large', 0, 0)
    const occupied: Wedge = {
      id: 'occ',
      startAngle: 0,
      arcDegrees: 300,
      state: 'occupied',
      childSize: 'large',
      childNodeId: 'c1',
    }
    const freeNode = { ...node, wedges: [occupied] }
    const result = validateFreeArcPlacement(freeNode, 310, 40)
    expect(result.ok).toBe(true)
  })

  it('detects zero-span gaps are skipped in free-arc gap finder', () => {
    const node = createNode('n', 'standard', 'large', 0, 0)
    const w0 = { ...makeWedgeAtBisector('a', 0, 'large'), state: 'occupied' as const, childNodeId: 'a' }
    const w1 = {
      ...makeWedgeAtBisector('b', Math.PI / 2, 'large'),
      state: 'occupied' as const,
      childNodeId: 'b',
    }
    const gaps = findFreeArcGaps({ ...node, wedges: [w0, w1] })
    expect(gaps.length).toBeGreaterThan(0)
    expect(gaps.some((g) => !g.tooSmall)).toBe(true)
  })

  it('gapTooSmallForAnyWedge flags narrow spans', () => {
    expect(gapTooSmallForAnyWedge(createNode('n', 'standard', 'small', 0, 0), 0, 30)).toBe(true)
    expect(gapTooSmallForAnyWedge(createNode('n', 'standard', 'small', 0, 0), 0, 0)).toBe(false)
  })

  it('proposeWedgeAtAngle creates wedge at clicked angle', () => {
    const node = createNode('n', 'standard', 'large', 0, 0)
    const proposed = proposeWedgeAtAngle(node, Math.PI / 4, 'large', 'w1')
    expect(proposed.ok).toBe(true)
    if (proposed.ok) {
      expect(proposed.wedge.arcDegrees).toBe(90)
      expect(proposed.wedge.state).toBe('active')
    }
  })

  it('validatePlacementCapacity rejects overlapping wedges', () => {
    const node = createNode('n', 'standard', 'large', 0, 0)
    const occupied: Wedge = {
      id: 'occ',
      startAngle: 0,
      arcDegrees: 90,
      state: 'occupied',
      childSize: 'large',
      childNodeId: 'c1',
    }
    const overlapping = makeWedgeAtBisector('overlap', Math.PI / 4, 'large')
    const patched = { ...node, wedges: [occupied, overlapping] }
    expect(validatePlacementCapacity(patched, 'overlap').ok).toBe(false)
  })

  it('allows second child on parent after diagonal first child', () => {
    let graph = createRootNode(empty, 'large', 'standard', { x: 400, y: 300 })
    const rootId = graph.rootIds[0]
    graph = placeChildAtAngle(graph, rootId, Math.PI / 4, 'large', 'standard', 80).state
    const second = placeChildAtAngle(graph, rootId, Math.PI, 'large', 'standard', 90)
    expect(second.error).toBeUndefined()
    expect(second.state.nodes[rootId].wedges.filter((w) => w.state === 'occupied')).toHaveLength(2)
  })
})