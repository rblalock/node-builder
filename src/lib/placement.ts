import {
  pointOnRay,
  radialDistance,
  wedgeBisectorAngle,
} from './geometry'
import type { Node, Point } from '../types/graph'
import { MAX_PLACEMENT_DISTANCE, MIN_PLACEMENT_DISTANCE } from '../types/graph'

export interface ResolvedPlacement {
  x: number
  y: number
  distance: number
  angle: number
}

export function clampPlacementDistance(distance: number): number {
  return Math.min(MAX_PLACEMENT_DISTANCE, Math.max(MIN_PLACEMENT_DISTANCE, distance))
}

export function resolveChildOnWedge(
  parent: Node,
  wedgeId: string,
  distance: number,
): ResolvedPlacement | null {
  const wedge = parent.wedges.find((w) => w.id === wedgeId)
  if (!wedge) return null

  const angle = wedgeBisectorAngle(wedge)
  const clampedDistance = clampPlacementDistance(distance)
  const position = pointOnRay({ x: parent.x, y: parent.y }, angle, clampedDistance)

  return {
    x: position.x,
    y: position.y,
    distance: clampedDistance,
    angle,
  }
}

/** Project an existing point onto the parent wedge ray (preserves radial distance). */
export function resolvePlacementFromPoint(
  parent: Node,
  wedgeId: string,
  point: Point,
): ResolvedPlacement | null {
  const wedge = parent.wedges.find((w) => w.id === wedgeId)
  if (!wedge) return null

  const angle = wedgeBisectorAngle(wedge)
  const distance = Math.max(0, radialDistance(parent, point, angle))
  const position = pointOnRay({ x: parent.x, y: parent.y }, angle, distance)

  return {
    x: position.x,
    y: position.y,
    distance,
    angle,
  }
}

export function applyPlacementToNode(
  node: Node,
  placement: ResolvedPlacement,
  parentId: string,
  parentWedgeId: string,
): Node {
  return {
    ...node,
    x: placement.x,
    y: placement.y,
    distance: placement.distance,
    parentId,
    parentWedgeId,
  }
}