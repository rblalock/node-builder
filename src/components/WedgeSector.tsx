import { describeWedgePath } from '../lib/geometry'
import { nodeRadius } from '../lib/sizeTiers'
import type { Node, Wedge } from '../types/graph'

const WEDGE_COLORS: Record<Wedge['state'], string> = {
  available: 'rgba(160, 160, 170, 0.35)',
  active: 'rgba(217, 164, 65, 0.75)',
  occupied: 'rgba(120, 130, 150, 0.5)',
  reserved: 'rgba(100, 110, 130, 0.4)',
}

interface WedgeSectorProps {
  node: Node
  wedge: Wedge
  tierBlocked?: boolean
  onPointerDown?: (wedgeId: string) => void
}

export function WedgeSector({ node, wedge, tierBlocked, onPointerDown }: WedgeSectorProps) {
  const radius = nodeRadius(node.size)
  const path = describeWedgePath(node.x, node.y, radius, wedge)
  const interactive = wedge.state === 'available' || wedge.state === 'active'

  return (
    <path
      d={path}
      fill={tierBlocked ? 'rgba(200, 100, 100, 0.25)' : WEDGE_COLORS[wedge.state]}
      stroke={wedge.state === 'active' ? '#c9922e' : tierBlocked ? '#c06060' : 'transparent'}
      strokeWidth={1.5}
      data-testid={`wedge-${node.id}-${wedge.id}`}
      data-wedge-state={wedge.state}
      data-tier-blocked={tierBlocked ? 'true' : 'false'}
      style={{
        cursor: interactive ? (tierBlocked ? 'not-allowed' : 'crosshair') : 'default',
        pointerEvents: interactive ? 'auto' : 'none',
        opacity: tierBlocked ? 0.55 : 1,
      }}
      onPointerDown={(e) => {
        if (!interactive || !onPointerDown) return
        e.stopPropagation()
        onPointerDown(wedge.id)
      }}
    />
  )
}