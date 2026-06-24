import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeKind, NodeSize, PlacementMode } from '../types/graph'
import { MIN_PLACEMENT_DISTANCE } from '../types/graph'

export function usePlacementDrag() {
  const [placement, setPlacement] = useState<PlacementMode>({ type: 'idle' })
  const placementRef = useRef<PlacementMode>({ type: 'idle' })

  useEffect(() => {
    placementRef.current = placement
  }, [placement])

  const startPlacement = useCallback(
    (
      parentId: string,
      wedgeId: string,
      childSize: NodeSize,
      childKind: NodeKind,
      angle: number,
    ) => {
      const mode = {
        type: 'placing' as const,
        parentId,
        wedgeId,
        childSize,
        childKind,
        angle,
        distance: MIN_PLACEMENT_DISTANCE + 30,
      }
      placementRef.current = mode
      setPlacement(mode)
    },
    [],
  )

  const updateDistance = useCallback((distance: number) => {
    setPlacement((prev) => {
      if (prev.type !== 'placing') return prev
      const next = { ...prev, distance }
      placementRef.current = next
      return next
    })
  }, [])

  const cancel = useCallback(() => {
    placementRef.current = { type: 'idle' }
    setPlacement({ type: 'idle' })
  }, [])

  const canCommit =
    placement.type === 'placing' && placement.distance >= MIN_PLACEMENT_DISTANCE

  return {
    placement,
    placementRef,
    startPlacement,
    updateDistance,
    cancel,
    canCommit,
    setPlacement,
  }
}