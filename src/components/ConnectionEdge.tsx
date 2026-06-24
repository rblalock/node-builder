import { connectionAnchor, edgeMidpoint } from '../lib/geometry'
import type { Node } from '../types/graph'

interface ConnectionEdgeProps {
  parent: Node
  child: Node
  showInsert?: boolean
  onInsert?: () => void
}

export function ConnectionEdge({ parent, child, showInsert, onInsert }: ConnectionEdgeProps) {
  const anchor = connectionAnchor(parent, child)
  const midpoint = edgeMidpoint(parent, child)

  return (
    <g data-testid={`edge-${parent.id}-${child.id}`}>
      <line
        x1={anchor.x}
        y1={anchor.y}
        x2={child.x}
        y2={child.y}
        stroke="#8a8a96"
        strokeWidth={1.5}
        pointerEvents="none"
      />
      {showInsert && onInsert && (
        <g>
          <circle
            cx={midpoint.x}
            cy={midpoint.y}
            r={6}
            fill="#d4e4f7"
            stroke="#4a90d9"
            strokeWidth={1.5}
            data-testid={`insert-handle-${parent.id}-${child.id}`}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onInsert()
            }}
          />
          <title>Insert edge node</title>
        </g>
      )}
    </g>
  )
}