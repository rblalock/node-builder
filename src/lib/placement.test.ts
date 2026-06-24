import { describe, expect, it } from 'vitest'
import { pointOnRay, radialDistance, wedgeBisectorAngle } from './geometry'
import { clampPlacementDistance, resolveChildOnWedge, resolvePlacementFromPoint } from './placement'
import { createNode, makeWedgeAtBisector } from './sizeTiers'
import type { Node } from '../types/graph'

export function assertChildPlacementInvariant(parent: Node, child: Node) {
  if (!child.parentId || !child.parentWedgeId) {
    throw new Error('child missing parent linkage')
  }
  const wedge = parent.wedges.find((w) => w.id === child.parentWedgeId)
  if (!wedge) throw new Error('parent wedge not found')

  const angle = wedgeBisectorAngle(wedge)
  const expectedDistance = radialDistance(parent, { x: child.x, y: child.y }, angle)
  const expectedPos = pointOnRay({ x: parent.x, y: parent.y }, angle, child.distance!)

  expect(child.distance).toBeCloseTo(expectedDistance, 3)
  expect(child.x).toBeCloseTo(expectedPos.x, 3)
  expect(child.y).toBeCloseTo(expectedPos.y, 3)
}

describe('placement', () => {
  it('resolveChildOnWedge clamps and positions on ray', () => {
    const parent = createNode('p', 'standard', 'large', 100, 100)
    const wedge = makeWedgeAtBisector('w0', 0, 'large')
    parent.wedges = [wedge]
    const resolved = resolveChildOnWedge(parent, wedge.id, 80)!
    const angle = wedgeBisectorAngle(wedge)
    expect(resolved.distance).toBe(80)
    expect(resolved.x).toBeCloseTo(100 + Math.cos(angle) * 80, 3)
    expect(resolved.y).toBeCloseTo(100 - Math.sin(angle) * 80, 3)
  })

  it('resolvePlacementFromPoint projects onto wedge ray without clamping', () => {
    const parent = createNode('p', 'standard', 'large', 0, 0)
    const wedge = makeWedgeAtBisector('w0', 0, 'large')
    parent.wedges = [wedge]
    const angle = wedgeBisectorAngle(wedge)
    const offRay = { x: 80, y: 20 }
    const resolved = resolvePlacementFromPoint(parent, wedge.id, offRay)!
    expect(resolved.distance).toBeCloseTo(radialDistance(parent, offRay, angle), 3)
    expect(resolved.x).toBeCloseTo(pointOnRay({ x: 0, y: 0 }, angle, resolved.distance).x, 3)
  })

  it('clampPlacementDistance enforces bounds', () => {
    expect(clampPlacementDistance(10)).toBe(50)
    expect(clampPlacementDistance(200)).toBe(200)
    expect(clampPlacementDistance(500)).toBe(300)
  })
})