import type { Node, NodeKind, NodeSize, Wedge, WedgeState } from '../types/graph'

export const NODE_RADIUS: Record<NodeSize, number> = {
  small: 12,
  medium: 20,
  large: 32,
}

export const WEDGE_ARC_BY_SIZE: Record<NodeSize, number> = {
  small: 45,
  medium: 60,
  large: 90,
}

export const MIN_WEDGE_GAP_DEGREES = 15

export function nodeRadius(size: NodeSize): number {
  return NODE_RADIUS[size]
}

export function isTierCompatible(parentSize: NodeSize, childSize: NodeSize, kind: NodeKind): boolean {
  if (kind === 'bridge') {
    return childSize === 'medium' || childSize === 'large'
  }
  if (kind === 'edge-insert') {
    return childSize === 'small'
  }
  return parentSize === childSize
}

export function bridgeAllowsTier(parentSize: NodeSize, childSize: NodeSize): boolean {
  if (parentSize === 'medium' && childSize === 'large') return true
  if (parentSize === 'large' && childSize === 'medium') return true
  return parentSize === childSize
}

function makeWedge(
  id: string,
  startAngleDeg: number,
  childSize: NodeSize,
  state: WedgeState = 'available',
): Wedge {
  return {
    id,
    startAngle: (startAngleDeg * Math.PI) / 180,
    arcDegrees: WEDGE_ARC_BY_SIZE[childSize],
    state,
    childSize,
  }
}

export function makeWedgeAtBisector(
  id: string,
  bisectorAngleRad: number,
  childSize: NodeSize,
  state: WedgeState = 'available',
): Wedge {
  const arc = WEDGE_ARC_BY_SIZE[childSize]
  const bisectorDeg = (bisectorAngleRad * 180) / Math.PI
  const startDeg = bisectorDeg - arc / 2
  return makeWedge(id, startDeg, childSize, state)
}

/** Claims perimeter arc on a child pointing back toward its parent. */
export function createIncomingReservedWedge(
  prefix: string,
  fromParentAngleRad: number,
  size: NodeSize,
): Wedge {
  const towardParent = fromParentAngleRad + Math.PI
  return {
    ...makeWedgeAtBisector(`${prefix}-in`, towardParent, size, 'reserved'),
    state: 'reserved',
  }
}

export function finalizeChildWedges(
  childId: string,
  kind: NodeKind,
  size: NodeSize,
  parentAngleRad: number,
): Wedge[] {
  const incoming = createIncomingReservedWedge(childId, parentAngleRad, size)
  if (kind === 'edge-insert') {
    return createOrientedEdgeInsertWedges(childId, parentAngleRad, parentAngleRad + Math.PI / 2)
  }
  if (kind === 'bridge') {
    return [incoming, ...createWedgesForNode('bridge', size, childId)]
  }
  return [incoming]
}

export function createOrientedEdgeInsertWedges(
  prefix: string,
  continuationAngleRad: number,
  branchAngleRad: number,
): Wedge[] {
  const arc = WEDGE_ARC_BY_SIZE.small
  const half = arc / 2
  const contDeg = (continuationAngleRad * 180) / Math.PI - half
  const branchDeg = (branchAngleRad * 180) / Math.PI - half
  return [
    { ...makeWedge(`${prefix}-w0`, contDeg, 'small', 'reserved'), state: 'reserved' },
    { ...makeWedge(`${prefix}-w1`, branchDeg, 'small', 'reserved'), state: 'reserved' },
  ]
}

export function createWedgesForNode(kind: NodeKind, _size: NodeSize, prefix: string): Wedge[] {
  if (kind === 'edge-insert') {
    return createOrientedEdgeInsertWedges(prefix, 0, Math.PI)
  }

  if (kind === 'bridge') {
    return [
      makeWedge(`${prefix}-w0`, 0, 'large'),
      makeWedge(`${prefix}-w1`, 180, 'medium'),
    ]
  }

  return []
}

export function createNode(
  id: string,
  kind: NodeKind,
  size: NodeSize,
  x: number,
  y: number,
  parentId?: string,
  parentWedgeId?: string,
  distance?: number,
): Node {
  return {
    id,
    kind,
    size,
    x,
    y,
    wedges: createWedgesForNode(kind, size, id),
    parentId,
    parentWedgeId,
    distance,
  }
}

export function getChildKindForPlacement(
  parent: Node,
  _wedge: Wedge,
  requestedKind: NodeKind,
): NodeKind {
  if (requestedKind === 'bridge' && parent.kind !== 'bridge') return 'bridge'
  if (requestedKind === 'edge-insert') return 'standard'
  return requestedKind === 'bridge' ? 'bridge' : 'standard'
}

export function validateTierPlacement(
  parent: Node,
  wedge: Wedge,
  childSize: NodeSize,
  childKind: NodeKind,
): { ok: true } | { ok: false; reason: string } {
  if (childKind === 'bridge' && parent.size !== 'medium') {
    return { ok: false, reason: 'Bridge nodes can only be placed from medium parents' }
  }

  if (parent.kind === 'bridge' || childKind === 'bridge') {
    if (!bridgeAllowsTier(parent.size, childSize)) {
      return { ok: false, reason: `Bridge placement does not support ${childSize} nodes here` }
    }
    if (wedge.childSize !== childSize) {
      return { ok: false, reason: `Use the ${wedge.childSize} wedge slot on this bridge node` }
    }
    return { ok: true }
  }

  return { ok: true }
}