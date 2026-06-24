import { describeAnnulusPath, wedgeInnerRadius } from '../lib/geometry'
import { nodeRadius, validateTierPlacement } from '../lib/sizeTiers'
import type { Node, NodeKind, NodeSize } from '../types/graph'
import { WedgeSector } from './WedgeSector'

interface NodeCircleProps {
  node: Node
  selected: boolean
  childSize: NodeSize
  childKind: NodeKind
  wedgeAngle?: number
  onSelect: (nodeId: string) => void
  onWedgePointerDown: (nodeId: string, wedgeId: string) => void
  onPerimeterPointerDown: (nodeId: string, e: React.PointerEvent) => void
  onWedgeBlocked: (reason: string) => void
  onBodyPointerDown: (nodeId: string) => void
}

export function NodeCircle({
  node,
  selected,
  childSize,
  childKind,
  wedgeAngle,
  onSelect,
  onWedgePointerDown,
  onPerimeterPointerDown,
  onWedgeBlocked,
  onBodyPointerDown,
}: NodeCircleProps) {
  const radius = nodeRadius(node.size)
  const innerRadius = wedgeInnerRadius(radius)
  const isHub = node.wedges.some((w) => w.state === 'occupied' || w.state === 'reserved')
  const isChild = Boolean(node.parentId)
  const usesPresetWedges = node.kind === 'bridge' || node.kind === 'edge-insert'

  return (
    <g
      data-testid={`node-${node.id}`}
      className="node"
      data-node-kind={node.kind}
      data-x={node.x}
      data-y={node.y}
      data-distance={node.distance ?? ''}
      data-wedge-angle={wedgeAngle ?? ''}
      data-selected={selected ? 'true' : 'false'}
    >
      <circle
        cx={node.x}
        cy={node.y}
        r={radius}
        fill={node.kind === 'bridge' ? '#e8dcc8' : node.kind === 'edge-insert' ? '#eef2f8' : '#fafafa'}
        stroke={selected ? '#4a90d9' : isHub ? '#888' : '#555'}
        strokeWidth={selected ? 3 : 1.5}
        data-testid={`node-body-${node.id}`}
        pointerEvents="none"
      />
      {node.wedges.map((wedge) => {
        const tierCheck = validateTierPlacement(node, wedge, childSize, childKind)
        const tierBlocked = wedge.state === 'available' && !tierCheck.ok
        return (
          <WedgeSector
            key={wedge.id}
            node={node}
            wedge={wedge}
            tierBlocked={tierBlocked}
            onPointerDown={
              usesPresetWedges
                ? (wedgeId) => {
                    onSelect(node.id)
                    if (tierBlocked) {
                      onWedgeBlocked(tierCheck.ok ? '' : tierCheck.reason)
                      return
                    }
                    onWedgePointerDown(node.id, wedgeId)
                  }
                : undefined
            }
          />
        )
      })}
      <circle
        cx={node.x}
        cy={node.y}
        r={radius * 0.34}
        fill="transparent"
        stroke="transparent"
        data-testid={`node-select-core-${node.id}`}
        style={{ cursor: isChild ? 'grab' : 'pointer', pointerEvents: 'all' }}
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect(node.id)
          if (isChild) onBodyPointerDown(node.id)
        }}
      />
      {!usesPresetWedges && (
        <path
          d={describeAnnulusPath(node.x, node.y, innerRadius, radius)}
          fill="transparent"
          fillRule="evenodd"
          data-testid={`node-perimeter-${node.id}`}
          style={{ cursor: 'crosshair', pointerEvents: 'all' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            onSelect(node.id)
            onPerimeterPointerDown(node.id, e)
          }}
        />
      )}
      {selected && (
        <circle
          cx={node.x}
          cy={node.y}
          r={radius + 6}
          fill="none"
          stroke="#4a90d9"
          strokeWidth={1}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}
    </g>
  )
}