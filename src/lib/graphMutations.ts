import {
  angleBetweenPoints,
  connectionAnchor,
  edgeMidpoint,
  nearestWedgeToAngle,
} from './geometry'
import {
  applyPlacementToNode,
  resolveChildOnWedge,
  resolvePlacementFromPoint,
} from './placement'
import { createOrientedEdgeInsertWedges, createNode, finalizeChildWedges } from './sizeTiers'
import { proposeWedgeAtAngle, resolvePlacementWedge, validatePlacementCapacity } from './wedgeCapacity'
import { validateTierPlacement } from './sizeTiers'
import type { GraphState, Node, NodeKind, NodeSize } from '../types/graph'

let idCounter = 0

export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

export function resetIdCounter(): void {
  idCounter = 0
}

export function createRootNode(
  state: GraphState,
  size: NodeSize,
  kind: NodeKind,
  center: { x: number; y: number },
): GraphState {
  const id = nextId('node')
  const node = createNode(id, kind, size, center.x, center.y)
  return {
    nodes: { ...state.nodes, [id]: node },
    rootIds: [...state.rootIds, id],
    selectedNodeId: id,
  }
}

export function placeChildAtAngle(
  state: GraphState,
  parentId: string,
  angleRad: number,
  childSize: NodeSize,
  childKind: NodeKind,
  distance: number,
): { state: GraphState; error?: string } {
  const prepared = preparePlacementWedge(state, parentId, angleRad, childSize, childKind)
  if (prepared.error || !prepared.wedgeId) return { state, error: prepared.error ?? 'Could not prepare wedge' }
  return placeChildNode(prepared.state, parentId, prepared.wedgeId, childSize, childKind, distance)
}

export function placeChildNode(
  state: GraphState,
  parentId: string,
  wedgeId: string,
  childSize: NodeSize,
  childKind: NodeKind,
  distance: number,
): { state: GraphState; error?: string } {
  const parent = state.nodes[parentId]
  if (!parent) return { state, error: 'Parent not found' }

  const wedge = parent.wedges.find((w) => w.id === wedgeId)
  if (!wedge) return { state, error: 'Wedge not found' }

  const tierCheck = validateTierPlacement(parent, wedge, childSize, childKind)
  if (!tierCheck.ok) return { state, error: tierCheck.reason }

  const capacityCheck = validatePlacementCapacity(parent, wedgeId)
  if (!capacityCheck.ok) return { state, error: capacityCheck.reason }

  const placement = resolveChildOnWedge(parent, wedgeId, distance)
  if (!placement) return { state, error: 'Wedge not found' }

  const childId = nextId('node')
  const childBase = createNode(
    childId,
    childKind,
    childSize,
    placement.x,
    placement.y,
    parentId,
    wedgeId,
    placement.distance,
  )
  const child = applyPlacementToNode(
    {
      ...childBase,
      wedges: finalizeChildWedges(childId, childKind, childSize, placement.angle),
    },
    placement,
    parentId,
    wedgeId,
  )

  const updatedParent: Node = {
    ...parent,
    wedges: parent.wedges.map((w) =>
      w.id === wedgeId ? { ...w, state: 'occupied', childNodeId: childId } : w,
    ),
  }

  return {
    state: {
      ...state,
      nodes: {
        ...state.nodes,
        [parentId]: updatedParent,
        [childId]: child,
      },
      selectedNodeId: childId,
    },
  }
}

export function updateChildDistance(
  state: GraphState,
  nodeId: string,
  distance: number,
): GraphState {
  const node = state.nodes[nodeId]
  if (!node?.parentId || !node.parentWedgeId) return state

  const parent = state.nodes[node.parentId]
  if (!parent) return state

  const placement = resolveChildOnWedge(parent, node.parentWedgeId, distance)
  if (!placement) return state

  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: applyPlacementToNode(node, placement, node.parentId, node.parentWedgeId),
    },
  }
}

export function insertEdgeNode(
  state: GraphState,
  parentId: string,
  childId: string,
): { state: GraphState; error?: string } {
  const parent = state.nodes[parentId]
  const child = state.nodes[childId]
  if (!parent || !child) return { state, error: 'Connection not found' }

  const wedge = parent.wedges.find((w) => w.childNodeId === childId)
  if (!wedge) return { state, error: 'No wedge connects these nodes' }

  const midpoint = edgeMidpoint(parent, child)
  const insertPlacement = resolvePlacementFromPoint(parent, wedge.id, midpoint)
  if (!insertPlacement) return { state, error: 'Could not resolve insert placement' }

  const toChildAngle = angleBetweenPoints(
    { x: insertPlacement.x, y: insertPlacement.y },
    { x: child.x, y: child.y },
  )
  const branchAngle = angleBetweenPoints(
    { x: insertPlacement.x, y: insertPlacement.y },
    {
      x: insertPlacement.x + Math.cos(toChildAngle + Math.PI / 2) * 10,
      y: insertPlacement.y - Math.sin(toChildAngle + Math.PI / 2) * 10,
    },
  )

  const insertId = nextId('node')
  const orientedWedges = createOrientedEdgeInsertWedges(insertId, toChildAngle, branchAngle)
  const continuationWedge = nearestWedgeToAngle(orientedWedges, toChildAngle)

  const insertBase = createNode(
    insertId,
    'edge-insert',
    'small',
    insertPlacement.x,
    insertPlacement.y,
    parentId,
    wedge.id,
    insertPlacement.distance,
  )

  const updatedParent: Node = {
    ...parent,
    wedges: parent.wedges.map((w) =>
      w.id === wedge.id ? { ...w, childNodeId: insertId } : w,
    ),
  }

  const updatedInsert: Node = {
    ...applyPlacementToNode(insertBase, insertPlacement, parentId, wedge.id),
    wedges: orientedWedges.map((w) => {
      if (w.id === continuationWedge.id) {
        return { ...w, state: 'occupied' as const, childNodeId: childId }
      }
      return { ...w, state: 'available' as const }
    }),
  }

  const childPlacement = resolvePlacementFromPoint(updatedInsert, continuationWedge.id, {
    x: child.x,
    y: child.y,
  })
  if (!childPlacement) return { state, error: 'Could not resolve child placement after insert' }

  const updatedChild = applyPlacementToNode(
    child,
    childPlacement,
    insertId,
    continuationWedge.id,
  )

  return {
    state: {
      ...state,
      nodes: {
        ...state.nodes,
        [parentId]: updatedParent,
        [insertId]: updatedInsert,
        [childId]: updatedChild,
      },
      selectedNodeId: insertId,
    },
  }
}

export function deleteNode(state: GraphState, nodeId: string): GraphState {
  const node = state.nodes[nodeId]
  if (!node) return state

  const toDelete = new Set<string>()
  const collect = (id: string) => {
    toDelete.add(id)
    const n = state.nodes[id]
    if (!n) return
    for (const w of n.wedges) {
      if (w.childNodeId) collect(w.childNodeId)
    }
  }
  collect(nodeId)

  const nodes = { ...state.nodes }
  for (const id of toDelete) {
    delete nodes[id]
  }

  for (const n of Object.values(nodes)) {
    n.wedges = n.wedges.filter((w) => !w.childNodeId || !toDelete.has(w.childNodeId))
  }

  return {
    nodes,
    rootIds: state.rootIds.filter((id) => !toDelete.has(id)),
    selectedNodeId: state.selectedNodeId && toDelete.has(state.selectedNodeId) ? null : state.selectedNodeId,
  }
}

export function clearWedgeActiveStates(state: GraphState): GraphState {
  const nodes: Record<string, Node> = {}
  for (const [id, node] of Object.entries(state.nodes)) {
    nodes[id] = {
      ...node,
      wedges: node.wedges
        .filter((w) => !(w.state === 'active' && !w.childNodeId))
        .map((w) => (w.state === 'active' && w.childNodeId ? { ...w, state: 'occupied' as const } : w)),
    }
  }
  return { ...state, nodes }
}

export function preparePlacementWedge(
  state: GraphState,
  parentId: string,
  angleRad: number,
  childSize: NodeSize,
  childKind: NodeKind,
): { state: GraphState; wedgeId?: string; angle?: number; error?: string } {
  const parent = state.nodes[parentId]
  if (!parent) return { state, error: 'Parent not found' }

  const wedgeId = nextId('wedge')
  const resolved = resolvePlacementWedge(parent, angleRad, childSize, childKind, wedgeId)
  if (!resolved.ok) return { state, error: resolved.reason }

  const preset = parent.wedges.find((w) => w.id === resolved.wedge.id)
  const wedge =
    preset ??
    (() => {
      const proposed = proposeWedgeAtAngle(parent, angleRad, childSize, wedgeId)
      return proposed.ok ? proposed.wedge : resolved.wedge
    })()

  const tierCheck = validateTierPlacement(parent, wedge, childSize, childKind)
  if (!tierCheck.ok) return { state, error: tierCheck.reason }

  const capacityCheck = validatePlacementCapacity(
    preset ? parent : { ...parent, wedges: [...parent.wedges, wedge] },
    wedge.id,
  )
  if (!capacityCheck.ok) return { state, error: capacityCheck.reason }

  const updatedParent: Node = {
    ...parent,
    wedges: preset
      ? parent.wedges.map((w) => {
          if (w.id === wedge.id && w.state === 'available') return { ...w, state: 'active' }
          if (w.state === 'active') return { ...w, state: 'available' }
          return w
        })
      : [...parent.wedges.filter((w) => w.state !== 'active' || w.childNodeId), { ...wedge, state: 'active' }],
  }

  return {
    state: { ...state, nodes: { ...state.nodes, [parentId]: updatedParent } },
    wedgeId: wedge.id,
    angle: angleRad,
  }
}

export function setWedgeActive(state: GraphState, nodeId: string, wedgeId: string): GraphState {
  const node = state.nodes[nodeId]
  if (!node) return state
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: {
        ...node,
        wedges: node.wedges.map((w) => {
          if (w.id === wedgeId && w.state === 'available') return { ...w, state: 'active' }
          if (w.state === 'active') return { ...w, state: 'available' }
          return w
        }),
      },
    },
  }
}

export function getConnections(state: GraphState): Array<{ parentId: string; childId: string }> {
  const connections: Array<{ parentId: string; childId: string }> = []
  for (const node of Object.values(state.nodes)) {
    for (const wedge of node.wedges) {
      if (wedge.childNodeId && state.nodes[wedge.childNodeId]) {
        connections.push({ parentId: node.id, childId: wedge.childNodeId })
      }
    }
  }
  return connections
}

export { connectionAnchor }