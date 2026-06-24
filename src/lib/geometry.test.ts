import { describe, expect, it } from 'vitest'
import {
  connectionAnchor,
  edgeMidpoint,
  pointOnRay,
  radialDistance,
  wedgeBisectorAngle,
  wedgeHitTest,
  wedgesOverlap,
} from './geometry'
import { createNode } from './sizeTiers'

describe('geometry', () => {
  it('computes wedge bisector angle', () => {
    const wedge = {
      id: 'w1',
      startAngle: 0,
      arcDegrees: 90,
      state: 'available' as const,
      childSize: 'large' as const,
    }
    expect(wedgeBisectorAngle(wedge)).toBeCloseTo(Math.PI / 4, 5)
  })

  it('places point on ray', () => {
    const p = pointOnRay({ x: 100, y: 100 }, 0, 50)
    expect(p.x).toBeCloseTo(150, 5)
    expect(p.y).toBeCloseTo(100, 5)
  })

  it('projects radial distance along angle', () => {
    const parent = { x: 0, y: 0 }
    const child = { x: 80, y: 0 }
    expect(radialDistance(parent, child, 0)).toBeCloseTo(80, 5)
    expect(radialDistance(parent, child, Math.PI / 2)).toBeCloseTo(0, 5)
  })

  it('detects overlapping wedges', () => {
    const a = {
      id: 'a',
      startAngle: 0,
      arcDegrees: 60,
      state: 'available' as const,
      childSize: 'medium' as const,
    }
    const b = {
      id: 'b',
      startAngle: (30 * Math.PI) / 180,
      arcDegrees: 60,
      state: 'available' as const,
      childSize: 'medium' as const,
    }
    const c = {
      id: 'c',
      startAngle: (120 * Math.PI) / 180,
      arcDegrees: 60,
      state: 'available' as const,
      childSize: 'medium' as const,
    }
    expect(wedgesOverlap(a, b)).toBe(true)
    expect(wedgesOverlap(a, c)).toBe(false)
  })

  it('hit tests wedge sectors', () => {
    const node = createNode('n1', 'standard', 'large', 400, 300)
    node.wedges = [
      {
        id: 'w0',
        startAngle: -Math.PI / 4,
        arcDegrees: 90,
        state: 'available',
        childSize: 'large',
      },
    ]
    const hit = wedgeHitTest(node, { x: 420, y: 300 })
    expect(hit).toBe('w0')
  })

  it('computes edge midpoint', () => {
    const parent = createNode('p', 'standard', 'large', 0, 0)
    const child = createNode('c', 'standard', 'large', 100, 100, 'p')
    const mid = edgeMidpoint(parent, child)
    expect(mid.x).toBe(50)
    expect(mid.y).toBe(50)
  })

  it('connectionAnchor fallback uses correct angle toward child', () => {
    const parent = createNode('p', 'standard', 'large', 0, 0)
    const child = createNode('c', 'standard', 'large', 100, 0, 'p')
    const anchor = connectionAnchor(parent, child)
    expect(anchor.x).toBeCloseTo(32, 0)
    expect(anchor.y).toBeCloseTo(0, 0)
  })
})