import { pointOnRay } from '../lib/geometry'
import { nodeRadius } from '../lib/sizeTiers'
import type { NodeKind, NodeSize, Point } from '../types/graph'

interface PlacementPreviewProps {
  origin: Point
  angle: number
  distance: number
  childSize: NodeSize
  childKind: NodeKind
}

export function PlacementPreview({ origin, angle, distance, childSize }: PlacementPreviewProps) {
  const ghost = pointOnRay(origin, angle, distance)
  const radius = nodeRadius(childSize)

  return (
    <g data-testid="placement-preview">
      <line
        x1={origin.x}
        y1={origin.y}
        x2={ghost.x}
        y2={ghost.y}
        stroke="#3cb371"
        strokeWidth={2}
        strokeDasharray="6 4"
        pointerEvents="none"
      />
      <circle
        cx={ghost.x}
        cy={ghost.y}
        r={radius}
        fill="rgba(60, 179, 113, 0.25)"
        stroke="#3cb371"
        strokeWidth={2}
        strokeDasharray="4 3"
        pointerEvents="none"
        data-testid="placement-ghost"
      />
    </g>
  )
}