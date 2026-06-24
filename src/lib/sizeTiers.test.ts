import { describe, expect, it } from 'vitest'
import {
  bridgeAllowsTier,
  createNode,
  createWedgesForNode,
  finalizeChildWedges,
  isTierCompatible,
  makeWedgeAtBisector,
  validateTierPlacement,
} from './sizeTiers'

describe('sizeTiers', () => {
  it('creates standard nodes without preset slots', () => {
    const wedges = createWedgesForNode('standard', 'medium', 'n')
    expect(wedges).toHaveLength(0)
  })

  it('creates bridge node with large and medium wedges', () => {
    const wedges = createWedgesForNode('bridge', 'medium', 'b')
    expect(wedges.map((w) => w.childSize).sort()).toEqual(['large', 'medium'])
  })

  it('creates edge-insert with two reserved wedges', () => {
    const wedges = createWedgesForNode('edge-insert', 'small', 'e')
    expect(wedges).toHaveLength(2)
    expect(wedges.every((w) => w.state === 'reserved')).toBe(true)
  })

  it('finalizes child wedges with incoming reserved arc toward parent', () => {
    const wedges = finalizeChildWedges('child', 'standard', 'large', 0)
    expect(wedges).toHaveLength(1)
    expect(wedges[0].state).toBe('reserved')
    expect(wedges[0].arcDegrees).toBe(90)
  })

  it('enforces tier compatibility', () => {
    expect(isTierCompatible('large', 'large', 'standard')).toBe(true)
    expect(isTierCompatible('large', 'small', 'standard')).toBe(false)
    expect(isTierCompatible('medium', 'large', 'bridge')).toBe(true)
  })

  it('allows bridge tier transitions', () => {
    expect(bridgeAllowsTier('medium', 'large')).toBe(true)
    expect(bridgeAllowsTier('large', 'medium')).toBe(true)
    expect(bridgeAllowsTier('small', 'medium')).toBe(false)
  })

  it('allows any standard child size on any standard parent', () => {
    const parent = createNode('p', 'standard', 'large', 0, 0)
    const wedge = makeWedgeAtBisector('w0', 0, 'small')
    expect(validateTierPlacement(parent, wedge, 'large', 'standard').ok).toBe(true)
    expect(validateTierPlacement(parent, wedge, 'small', 'standard').ok).toBe(true)
  })
})