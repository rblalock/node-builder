import { angleInWedge, wedgesOverlap } from './geometry'
import { MIN_WEDGE_GAP_DEGREES, WEDGE_ARC_BY_SIZE, makeWedgeAtBisector } from './sizeTiers'
import type { Node, NodeKind, NodeSize, Wedge } from '../types/graph'

function normalizeDegrees(deg: number): number {
  let d = deg % 360
  if (d < 0) d += 360
  return d
}

function wedgeEndDeg(wedge: Wedge): number {
  return normalizeDegrees((wedge.startAngle * 180) / Math.PI + wedge.arcDegrees)
}

function wedgeStartDeg(wedge: Wedge): number {
  return normalizeDegrees((wedge.startAngle * 180) / Math.PI)
}

export function occupiedWedges(node: Node): Wedge[] {
  return node.wedges.filter((w) => w.state === 'occupied' || w.state === 'reserved')
}

export function canAssignWedge(node: Node, wedgeId: string): boolean {
  const wedge = node.wedges.find((w) => w.id === wedgeId)
  if (!wedge) return false
  if (wedge.state !== 'available' && wedge.state !== 'active') return false

  const others = occupiedWedges(node).filter((w) => w.id !== wedgeId)
  return !others.some((other) => wedgesOverlap(wedge, other))
}

export function gapTooSmallForAnyWedge(_node: Node, gapStartDeg: number, gapEndDeg: number): boolean {
  const gapSize = gapEndDeg >= gapStartDeg ? gapEndDeg - gapStartDeg : 360 - gapStartDeg + gapEndDeg
  const minArc = Math.min(...Object.values(WEDGE_ARC_BY_SIZE))
  return gapSize > 0 && gapSize < minArc + MIN_WEDGE_GAP_DEGREES
}

/** Gaps between occupied arcs on a free-form perimeter (not predefined slots). */
export function findFreeArcGaps(node: Node): Array<{ start: number; end: number; tooSmall: boolean }> {
  const occupied = occupiedWedges(node)
    .map((w) => ({ start: wedgeStartDeg(w), end: wedgeEndDeg(w) }))
    .sort((a, b) => a.start - b.start)

  if (occupied.length === 0) {
    return [{ start: 0, end: 360, tooSmall: false }]
  }

  const gaps: Array<{ start: number; end: number; tooSmall: boolean }> = []
  for (let i = 0; i < occupied.length; i++) {
    const current = occupied[i]
    const next = occupied[(i + 1) % occupied.length]
    const gapStart = current.end
    const gapEnd = i === occupied.length - 1 && next.start <= current.start ? next.start + 360 : next.start
    const span = gapEnd - gapStart
    if (span <= 0) continue
    const normalizedEnd = normalizeDegrees(gapEnd)
    gaps.push({
      start: gapStart,
      end: normalizedEnd,
      tooSmall: gapTooSmallForAnyWedge(node, gapStart, normalizedEnd),
    })
  }

  return gaps
}

export function validateFreeArcPlacement(
  node: Node,
  startAngleDeg: number,
  arcDegrees: number,
  existingWedgeId?: string,
): { ok: true } | { ok: false; reason: string } {
  const existing = existingWedgeId ? node.wedges.find((w) => w.id === existingWedgeId) : undefined
  const candidate: Wedge = existing ?? {
    id: '__candidate__',
    startAngle: (startAngleDeg * Math.PI) / 180,
    arcDegrees,
    state: 'available',
    childSize: 'small',
  }

  const occupiedOthers = occupiedWedges(node).filter((w) => w.id !== existingWedgeId)
  if (occupiedOthers.some((w) => wedgesOverlap(candidate, w))) {
    return { ok: false, reason: 'Arc overlaps an occupied region' }
  }

  return { ok: true }
}

/** Slot placement: overlap check + free-arc gap validation on the node's perimeter. */
export function validatePlacementCapacity(node: Node, wedgeId: string): { ok: true } | { ok: false; reason: string } {
  if (!canAssignWedge(node, wedgeId)) {
    return { ok: false, reason: 'Wedge overlaps another occupied slot' }
  }

  const wedge = node.wedges.find((w) => w.id === wedgeId)
  if (!wedge) return { ok: false, reason: 'Wedge not found' }

  return validateFreeArcPlacement(
    node,
    (wedge.startAngle * 180) / Math.PI,
    wedge.arcDegrees,
    wedgeId,
  )
}

export function proposeWedgeAtAngle(
  node: Node,
  angleRad: number,
  childSize: NodeSize,
  wedgeId: string,
): { ok: true; wedge: Wedge } | { ok: false; reason: string } {
  const arc = WEDGE_ARC_BY_SIZE[childSize]
  const bisectorDeg = normalizeDegrees((angleRad * 180) / Math.PI)
  const startDeg = bisectorDeg - arc / 2
  const validation = validateFreeArcPlacement(node, startDeg, arc)
  if (!validation.ok) return validation

  return {
    ok: true,
    wedge: {
      ...makeWedgeAtBisector(wedgeId, angleRad, childSize, 'active'),
      state: 'active',
    },
  }
}

export function findPresetWedgeAtAngle(
  node: Node,
  angleRad: number,
  childSize: NodeSize,
): Wedge | undefined {
  return node.wedges.find(
    (w) =>
      (w.state === 'available' || w.state === 'active') &&
      w.childSize === childSize &&
      angleInWedge(angleRad, w),
  )
}

export function resolvePlacementWedge(
  node: Node,
  angleRad: number,
  childSize: NodeSize,
  _childKind: NodeKind,
  wedgeId: string,
): { ok: true; wedge: Wedge } | { ok: false; reason: string } {
  if (node.kind === 'bridge' || node.kind === 'edge-insert') {
    const preset = findPresetWedgeAtAngle(node, angleRad, childSize)
    if (!preset) {
      return { ok: false, reason: 'Click an available wedge slot on this node' }
    }
    return { ok: true, wedge: preset }
  }

  const overlapping = occupiedWedges(node).find((w) => angleInWedge(angleRad, w))
  if (overlapping) {
    return { ok: false, reason: 'That arc is already occupied' }
  }

  return proposeWedgeAtAngle(node, angleRad, childSize, wedgeId)
}

/** @deprecated use findFreeArcGaps for free-form arcs */
export const findGaps = findFreeArcGaps