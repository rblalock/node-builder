import { useCallback, useEffect, useRef, useState } from 'react'
import type { GraphState, NodeKind, NodeSize } from '../types/graph'
import {
  clearWedgeActiveStates,
  createRootNode,
  deleteNode,
  insertEdgeNode,
  placeChildNode,
  preparePlacementWedge,
  resetIdCounter,
  updateChildDistance,
} from '../lib/graphMutations'
import { usePlacementDrag } from './usePlacementDrag'

const EMPTY_GRAPH: GraphState = {
  nodes: {},
  rootIds: [],
  selectedNodeId: null,
}

export function useNodeGraph() {
  const [graph, setGraph] = useState<GraphState>(EMPTY_GRAPH)
  const [feedback, setFeedback] = useState<string | null>(null)
  const graphRef = useRef(graph)
  const {
    placement,
    placementRef,
    startPlacement,
    updateDistance,
    cancel: cancelPlacementDrag,
    setPlacement,
  } = usePlacementDrag()

  useEffect(() => {
    graphRef.current = graph
  }, [graph])

  const reset = useCallback(() => {
    resetIdCounter()
    setGraph(EMPTY_GRAPH)
    setPlacement({ type: 'idle' })
    setFeedback(null)
  }, [setPlacement])

  const addRoot = useCallback((size: NodeSize, kind: NodeKind, center: { x: number; y: number }) => {
    setGraph((prev) => createRootNode(prev, size, kind, center))
    setFeedback(null)
  }, [])

  const selectNode = useCallback((nodeId: string | null) => {
    setGraph((prev) => ({ ...prev, selectedNodeId: nodeId }))
  }, [])

  const reportBlocked = useCallback((reason: string) => {
    setFeedback(reason)
  }, [])

  const beginPlacement = useCallback(
    (parentId: string, wedgeId: string, childSize: NodeSize, childKind: NodeKind, angle: number) => {
      startPlacement(parentId, wedgeId, childSize, childKind, angle)
      setFeedback(null)
    },
    [startPlacement],
  )

  const beginPlacementAtAngle = useCallback(
    (parentId: string, angle: number, childSize: NodeSize, childKind: NodeKind): boolean => {
      const result = preparePlacementWedge(graphRef.current, parentId, angle, childSize, childKind)
      if (result.error || !result.wedgeId || result.angle === undefined) {
        setFeedback(result.error ?? 'Could not start placement')
        return false
      }
      setGraph(result.state)
      startPlacement(parentId, result.wedgeId, childSize, childKind, result.angle)
      setFeedback(null)
      return true
    },
    [startPlacement],
  )

  const updatePlacementDistance = useCallback(
    (distance: number) => {
      updateDistance(distance)
    },
    [updateDistance],
  )

  const commitPlacement = useCallback(() => {
    const pl = placementRef.current
    if (pl.type !== 'placing') return

    setGraph((g) => {
      const result = placeChildNode(
        g,
        pl.parentId,
        pl.wedgeId,
        pl.childSize,
        pl.childKind,
        pl.distance,
      )
      if (result.error) {
        setFeedback(result.error)
        return clearWedgeActiveStates(g)
      }
      setFeedback(null)
      return result.state
    })
    setPlacement({ type: 'idle' })
  }, [placementRef, setPlacement])

  const cancelPlacement = useCallback(() => {
    setGraph((prev) => clearWedgeActiveStates(prev))
    cancelPlacementDrag()
    setFeedback(null)
  }, [cancelPlacementDrag])

  const beginReposition = useCallback(
    (nodeId: string, parentId: string, wedgeId: string, angle: number, distance: number) => {
      setPlacement({
        type: 'repositioning',
        nodeId,
        parentId,
        wedgeId,
        angle,
        distance,
      })
      selectNode(nodeId)
    },
    [selectNode, setPlacement],
  )

  const updateRepositionDistance = useCallback(
    (distance: number) => {
      const pl = placementRef.current
      if (pl.type !== 'repositioning') return
      setPlacement({ ...pl, distance })
      setGraph((g) => updateChildDistance(g, pl.nodeId, distance))
    },
    [placementRef, setPlacement],
  )

  const endReposition = useCallback(() => {
    setPlacement({ type: 'idle' })
  }, [setPlacement])

  const removeSelected = useCallback(() => {
    const selected = graphRef.current.selectedNodeId
    if (!selected) return
    setGraph((prev) => deleteNode(prev, selected))
    setPlacement({ type: 'idle' })
    setFeedback(null)
  }, [setPlacement])

  const insertOnEdge = useCallback((parentId: string, childId: string) => {
    setGraph((g) => {
      const result = insertEdgeNode(g, parentId, childId)
      if (result.error) {
        setFeedback(result.error)
        return g
      }
      setFeedback(null)
      return result.state
    })
  }, [])

  return {
    graph,
    placement,
    feedback,
    reset,
    addRoot,
    selectNode,
    reportBlocked,
    beginPlacement,
    beginPlacementAtAngle,
    updatePlacementDistance,
    commitPlacement,
    cancelPlacement,
    beginReposition,
    updateRepositionDistance,
    endReposition,
    removeSelected,
    insertOnEdge,
  }
}