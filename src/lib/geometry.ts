import type { Node, Point, Wedge } from '../types/graph'
import { MAX_PLACEMENT_DISTANCE, MIN_PLACEMENT_DISTANCE } from '../types/graph'
import { nodeRadius } from './sizeTiers'

const TAU = Math.PI * 2

export function normalizeAngle(angle: number): number {
  let a = angle % TAU
  if (a < 0) a += TAU
  return a
}

export function wedgeBisectorAngle(wedge: Wedge): number {
  const start = normalizeAngle(wedge.startAngle)
  const arc = (wedge.arcDegrees * Math.PI) / 180
  return normalizeAngle(start + arc / 2)
}

export function pointOnRay(origin: Point, angle: number, distance: number): Point {
  return {
    x: origin.x + Math.cos(angle) * distance,
    y: origin.y - Math.sin(angle) * distance,
  }
}

export function radialDistance(parent: Point, child: Point, angle: number): number {
  const dx = child.x - parent.x
  const dy = child.y - parent.y
  const projected = dx * Math.cos(angle) - dy * Math.sin(angle)
  return Math.max(0, projected)
}

function arcToInterval(wedge: Wedge): [number, number] {
  const start = normalizeAngle(wedge.startAngle)
  const end = normalizeAngle(start + (wedge.arcDegrees * Math.PI) / 180)
  if (end < start) return [start, end + TAU]
  return [start, end]
}

export function wedgesOverlap(a: Wedge, b: Wedge): boolean {
  const [aStart, aEnd] = arcToInterval(a)
  const [bStart, bEnd] = arcToInterval(b)

  const overlaps = (s1: number, e1: number, s2: number, e2: number) =>
    s1 < e2 && s2 < e1

  if (overlaps(aStart, aEnd, bStart, bEnd)) return true
  if (overlaps(aStart + TAU, aEnd + TAU, bStart, bEnd)) return true
  if (overlaps(aStart, aEnd, bStart + TAU, bEnd + TAU)) return true
  return false
}

export const WEDGE_INNER_RATIO = 0.35

export function wedgeInnerRadius(outerRadius: number): number {
  return outerRadius * WEDGE_INNER_RATIO
}

export function angleInWedge(angle: number, wedge: Wedge): boolean {
  const start = normalizeAngle(wedge.startAngle)
  const arc = (wedge.arcDegrees * Math.PI) / 180
  const end = normalizeAngle(start + arc)
  const normalized = normalizeAngle(angle)
  return start <= end
    ? normalized >= start && normalized <= end
    : normalized >= start || normalized <= end
}

export function perimeterAngleFromPointer(
  node: Node,
  pointer: Point,
  radius = nodeRadius(node.size),
): number | null {
  const dx = pointer.x - node.x
  const dy = pointer.y - node.y
  const dist = Math.hypot(dx, dy)
  const inner = wedgeInnerRadius(radius)
  if (dist > radius || dist < inner) return null
  return normalizeAngle(Math.atan2(-dy, dx))
}

export function wedgeHitTest(
  node: Node,
  pointer: Point,
  radius = nodeRadius(node.size),
): string | null {
  const dx = pointer.x - node.x
  const dy = pointer.y - node.y
  const dist = Math.hypot(dx, dy)
  const inner = wedgeInnerRadius(radius)
  if (dist > radius || dist < inner) return null

  const angle = normalizeAngle(Math.atan2(-dy, dx))
  for (const wedge of node.wedges) {
    const start = normalizeAngle(wedge.startAngle)
    const arc = (wedge.arcDegrees * Math.PI) / 180
    const end = normalizeAngle(start + arc)
    const inArc =
      start <= end
        ? angle >= start && angle <= end
        : angle >= start || angle <= end
    if (inArc) return wedge.id
  }
  return null
}

export function edgeMidpoint(parent: Node, child: Node): Point {
  return {
    x: (parent.x + child.x) / 2,
    y: (parent.y + child.y) / 2,
  }
}

export function connectionAnchor(parent: Node, child: Node): Point {
  const wedge = parent.wedges.find((w) => w.childNodeId === child.id)
  const angle = wedge ? wedgeBisectorAngle(wedge) : angleBetweenPoints(parent, child)
  const radius = nodeRadius(parent.size)
  return pointOnRay({ x: parent.x, y: parent.y }, angle, radius)
}

export function describeAnnulusPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
): string {
  return [
    `M ${cx - outerRadius} ${cy}`,
    `A ${outerRadius} ${outerRadius} 0 1 0 ${cx + outerRadius} ${cy}`,
    `A ${outerRadius} ${outerRadius} 0 1 0 ${cx - outerRadius} ${cy}`,
    `M ${cx - innerRadius} ${cy}`,
    `A ${innerRadius} ${innerRadius} 0 1 1 ${cx + innerRadius} ${cy}`,
    `A ${innerRadius} ${innerRadius} 0 1 1 ${cx - innerRadius} ${cy}`,
    'Z',
  ].join(' ')
}

export function describeWedgePath(
  cx: number,
  cy: number,
  outerRadius: number,
  wedge: Wedge,
  innerRadius = wedgeInnerRadius(outerRadius),
): string {
  const start = wedge.startAngle
  const end = start + (wedge.arcDegrees * Math.PI) / 180
  const largeArc = wedge.arcDegrees > 180 ? 1 : 0

  const ox1 = cx + Math.cos(start) * outerRadius
  const oy1 = cy - Math.sin(start) * outerRadius
  const ox2 = cx + Math.cos(end) * outerRadius
  const oy2 = cy - Math.sin(end) * outerRadius
  const ix2 = cx + Math.cos(end) * innerRadius
  const iy2 = cy - Math.sin(end) * innerRadius
  const ix1 = cx + Math.cos(start) * innerRadius
  const iy1 = cy - Math.sin(start) * innerRadius

  return `M ${ox1} ${oy1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${ix1} ${iy1} Z`
}

export function angleBetweenPoints(from: Point, to: Point): number {
  return normalizeAngle(Math.atan2(-(to.y - from.y), to.x - from.x))
}

export function nearestWedgeToAngle(wedges: Wedge[], targetAngle: number): Wedge {
  let best = wedges[0]
  let bestDelta = TAU
  for (const wedge of wedges) {
    const bisector = wedgeBisectorAngle(wedge)
    const delta = Math.min(
      Math.abs(bisector - targetAngle),
      TAU - Math.abs(bisector - targetAngle),
    )
    if (delta < bestDelta) {
      bestDelta = delta
      best = wedge
    }
  }
  return best
}

export function clampDistance(distance: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, distance))
}

export function distanceFromPointer(parent: Point, pointer: Point, angle: number): number {
  return clampDistance(radialDistance(parent, pointer, angle), MIN_PLACEMENT_DISTANCE, MAX_PLACEMENT_DISTANCE)
}