export type NodeSize = 'small' | 'medium' | 'large'

export type NodeKind = 'standard' | 'bridge' | 'edge-insert'

export type WedgeState = 'available' | 'active' | 'occupied' | 'reserved'

export interface Wedge {
  id: string
  startAngle: number
  arcDegrees: number
  state: WedgeState
  childNodeId?: string
  childSize: NodeSize
}

export interface Node {
  id: string
  kind: NodeKind
  size: NodeSize
  x: number
  y: number
  wedges: Wedge[]
  parentId?: string
  parentWedgeId?: string
  distance?: number
}

export interface Point {
  x: number
  y: number
}

export interface GraphState {
  nodes: Record<string, Node>
  rootIds: string[]
  selectedNodeId: string | null
}

export type PlacementMode =
  | { type: 'idle' }
  | {
      type: 'placing'
      parentId: string
      wedgeId: string
      childSize: NodeSize
      childKind: NodeKind
      angle: number
      distance: number
    }
  | {
      type: 'repositioning'
      nodeId: string
      parentId: string
      wedgeId: string
      angle: number
      distance: number
    }

export const MIN_PLACEMENT_DISTANCE = 50
export const MAX_PLACEMENT_DISTANCE = 300