import { useCallback, useEffect, useRef } from 'react'
import type { GraphState, Node, NodeKind, NodeSize, PlacementMode } from '../types/graph'
import { MIN_PLACEMENT_DISTANCE } from '../types/graph'
import { distanceFromPointer, perimeterAngleFromPointer, wedgeBisectorAngle } from '../lib/geometry'
import { getConnections } from '../lib/graphMutations'
import { getChildKindForPlacement, validateTierPlacement } from '../lib/sizeTiers'
import { ConnectionEdge } from './ConnectionEdge'
import { NodeCircle } from './NodeCircle'
import { PlacementPreview } from './PlacementPreview'

interface NodeGraphProps {
  graph: GraphState
  placement: PlacementMode
  childSize: NodeSize
  childKind: NodeKind
  onWedgePlacementStart: (
    parentId: string,
    wedgeId: string,
    childSize: NodeSize,
    childKind: NodeKind,
    angle: number,
  ) => void
  onPerimeterPlacementStart: (
    parentId: string,
    angle: number,
    childSize: NodeSize,
    childKind: NodeKind,
  ) => boolean
  onPlacementDistanceChange: (distance: number) => void
  onPlacementCommit: () => void
  onPlacementCancel: () => void
  onRepositionStart: (
    nodeId: string,
    parentId: string,
    wedgeId: string,
    angle: number,
    distance: number,
  ) => void
  onRepositionDistanceChange: (distance: number) => void
  onRepositionEnd: () => void
  onSelectNode: (nodeId: string | null) => void
  onInsertEdge: (parentId: string, childId: string) => void
  onBlocked: (reason: string) => void
}

function nodeDepth(graph: GraphState, nodeId: string): number {
  let depth = 0
  let current: string | undefined = nodeId
  while (current && graph.nodes[current]?.parentId) {
    depth += 1
    current = graph.nodes[current].parentId
  }
  return depth
}

function sortNodesForRender(graph: GraphState): Node[] {
  return Object.values(graph.nodes).sort((a, b) => nodeDepth(graph, b.id) - nodeDepth(graph, a.id))
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const svgPt = pt.matrixTransform(ctm.inverse())
  return { x: svgPt.x, y: svgPt.y }
}

export function NodeGraph({
  graph,
  placement,
  childSize,
  childKind,
  onWedgePlacementStart,
  onPerimeterPlacementStart,
  onPlacementDistanceChange,
  onPlacementCommit,
  onPlacementCancel,
  onRepositionStart,
  onRepositionDistanceChange,
  onRepositionEnd,
  onSelectNode,
  onInsertEdge,
  onBlocked,
}: NodeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const placementRef = useRef(placement)
  const graphRef = useRef(graph)

  useEffect(() => {
    placementRef.current = placement
  }, [placement])

  useEffect(() => {
    graphRef.current = graph
  }, [graph])

  const finishDrag = useCallback(() => {
    const mode = placementRef.current
    if (mode.type === 'placing') {
      if (mode.distance >= MIN_PLACEMENT_DISTANCE) onPlacementCommit()
      else onPlacementCancel()
    } else if (mode.type === 'repositioning') {
      onRepositionEnd()
    }
  }, [onPlacementCommit, onPlacementCancel, onRepositionEnd])

  const handleDocumentPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!svgRef.current) return
      const mode = placementRef.current
      const point = clientToSvg(svgRef.current, e.clientX, e.clientY)

      if (mode.type === 'placing') {
        const parent = graphRef.current.nodes[mode.parentId]
        if (!parent) return
        const distance = distanceFromPointer({ x: parent.x, y: parent.y }, point, mode.angle)
        placementRef.current = { ...mode, distance }
        onPlacementDistanceChange(distance)
      } else if (mode.type === 'repositioning') {
        const parent = graphRef.current.nodes[mode.parentId]
        if (!parent) return
        const distance = distanceFromPointer({ x: parent.x, y: parent.y }, point, mode.angle)
        placementRef.current = { ...mode, distance }
        onRepositionDistanceChange(distance)
      }
    },
    [onPlacementDistanceChange, onRepositionDistanceChange],
  )

  const startDocumentDrag = useCallback(() => {
    const onMove = (e: PointerEvent) => handleDocumentPointerMove(e)
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      finishDrag()
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [handleDocumentPointerMove, finishDrag])

  const handleWedgeDown = useCallback(
    (nodeId: string, wedgeId: string) => {
      const node = graph.nodes[nodeId]
      if (!node) return
      const wedge = node.wedges.find((w) => w.id === wedgeId)
      if (!wedge || wedge.state !== 'available') return

      const resolvedKind = getChildKindForPlacement(node, wedge, childKind)
      const tierCheck = validateTierPlacement(node, wedge, childSize, resolvedKind)
      if (!tierCheck.ok) {
        onBlocked(tierCheck.reason)
        return
      }

      onSelectNode(nodeId)

      const angle = wedgeBisectorAngle(wedge)
      const mode = {
        type: 'placing' as const,
        parentId: nodeId,
        wedgeId,
        childSize,
        childKind: resolvedKind,
        angle,
        distance: MIN_PLACEMENT_DISTANCE + 30,
      }
      placementRef.current = mode
      onWedgePlacementStart(nodeId, wedgeId, childSize, resolvedKind, angle)
      startDocumentDrag()
    },
    [graph.nodes, childSize, childKind, onSelectNode, onWedgePlacementStart, onBlocked, startDocumentDrag],
  )

  const resolvePerimeterTarget = useCallback(
    (point: { x: number; y: number }): { nodeId: string; angle: number } | null => {
      const candidates = sortNodesForRender(graphRef.current)
        .map((node) => {
          if (node.kind === 'bridge' || node.kind === 'edge-insert') return null
          const angle = perimeterAngleFromPointer(node, point)
          if (angle === null) return null
          return { node, angle }
        })
        .filter((c): c is { node: Node; angle: number } => c !== null)

      if (candidates.length === 0) return null

      const selectedId = graphRef.current.selectedNodeId
      const selected = candidates.find((c) => c.node.id === selectedId)
      if (selected) return { nodeId: selected.node.id, angle: selected.angle }

      const shallowest = candidates.reduce((best, c) => {
        const depth = nodeDepth(graphRef.current, c.node.id)
        const bestDepth = nodeDepth(graphRef.current, best.node.id)
        return depth < bestDepth ? c : best
      })
      return { nodeId: shallowest.node.id, angle: shallowest.angle }
    },
    [],
  )

  const handlePerimeterDown = useCallback(
    (_nodeId: string, e: React.PointerEvent) => {
      if (!svgRef.current) return

      const point = clientToSvg(svgRef.current, e.clientX, e.clientY)
      const target = resolvePerimeterTarget(point)
      if (!target) return

      const node = graph.nodes[target.nodeId]
      if (!node) return

      const resolvedKind =
        childKind === 'bridge' && node.size === 'medium' ? 'bridge' : childKind === 'bridge' ? 'standard' : childKind
      if (onPerimeterPlacementStart(target.nodeId, target.angle, childSize, resolvedKind)) {
        startDocumentDrag()
      }
    },
    [graph.nodes, childSize, childKind, onPerimeterPlacementStart, resolvePerimeterTarget, startDocumentDrag],
  )

  const handleBodyDown = useCallback(
    (nodeId: string) => {
      const node = graph.nodes[nodeId]
      if (!node?.parentId || !node.parentWedgeId) return
      const parent = graph.nodes[node.parentId]
      if (!parent) return
      const wedge = parent.wedges.find((w) => w.id === node.parentWedgeId)
      if (!wedge) return
      const angle = wedgeBisectorAngle(wedge)
      const distance = node.distance ?? 80
      const mode = {
        type: 'repositioning' as const,
        nodeId,
        parentId: node.parentId,
        wedgeId: node.parentWedgeId,
        angle,
        distance,
      }
      placementRef.current = mode
      onRepositionStart(nodeId, node.parentId, node.parentWedgeId, angle, distance)
      startDocumentDrag()
    },
    [graph.nodes, onRepositionStart, startDocumentDrag],
  )

  const connections = getConnections(graph)

  return (
    <svg
      ref={svgRef}
      data-testid="node-graph"
      viewBox="0 0 800 600"
      width="100%"
      height="100%"
      style={{ background: '#1e1e24', touchAction: 'none' }}
      onPointerDown={(e) => {
        if (e.target === svgRef.current) onSelectNode(null)
      }}
    >
      {connections.map(({ parentId, childId }) => {
        const parent = graph.nodes[parentId]
        const child = graph.nodes[childId]
        if (!parent || !child) return null
        const canInsert = child.kind !== 'edge-insert' && parent.wedges.some((w) => w.childNodeId === childId)
        return (
          <ConnectionEdge
            key={`${parentId}-${childId}`}
            parent={parent}
            child={child}
            showInsert={canInsert}
            onInsert={() => onInsertEdge(parentId, childId)}
          />
        )
      })}

      {sortNodesForRender(graph).map((node) => {
        let wedgeAngle: number | undefined
        if (node.parentId && node.parentWedgeId) {
          const parent = graph.nodes[node.parentId]
          const wedge = parent?.wedges.find((w) => w.id === node.parentWedgeId)
          if (wedge) wedgeAngle = wedgeBisectorAngle(wedge)
        }
        return (
          <NodeCircle
            key={node.id}
            node={node}
            selected={graph.selectedNodeId === node.id}
            childSize={childSize}
            childKind={childKind}
            wedgeAngle={wedgeAngle}
            onSelect={onSelectNode}
            onWedgePointerDown={handleWedgeDown}
            onPerimeterPointerDown={handlePerimeterDown}
            onWedgeBlocked={onBlocked}
            onBodyPointerDown={handleBodyDown}
          />
        )
      })}

      {placement.type === 'placing' && graph.nodes[placement.parentId] && (
        <PlacementPreview
          origin={{
            x: graph.nodes[placement.parentId].x,
            y: graph.nodes[placement.parentId].y,
          }}
          angle={placement.angle}
          distance={placement.distance}
          childSize={placement.childSize}
          childKind={placement.childKind}
        />
      )}
    </svg>
  )
}