import { useCallback, useEffect, useState } from 'react'
import { NodeGraph } from '../components/NodeGraph'
import { useNodeGraph } from '../hooks/useNodeGraph'
import type { NodeKind, NodeSize } from '../types/graph'
import './App.css'

declare global {
  interface Window {
    __errors: string[]
  }
}

window.__errors = window.__errors ?? []

export default function App() {
  const {
    graph,
    placement,
    feedback,
    reset,
    addRoot,
    selectNode,
    beginPlacement,
    beginPlacementAtAngle,
    updatePlacementDistance,
    commitPlacement,
    cancelPlacement,
    beginReposition,
    updateRepositionDistance,
    endReposition,
    reportBlocked,
    removeSelected,
    insertOnEdge,
  } = useNodeGraph()

  const [rootSize, setRootSize] = useState<NodeSize>('large')
  const [rootKind, setRootKind] = useState<NodeKind>('standard')
  const [childSize, setChildSize] = useState<NodeSize>('small')
  const [childKind, setChildKind] = useState<NodeKind>('standard')

  useEffect(() => {
    const onError = (msg: string) => {
      window.__errors.push(msg)
    }
    window.addEventListener('error', (e) => onError(e.message))
    window.addEventListener('unhandledrejection', (e) => onError(String(e.reason)))

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelPlacement()
      if (e.key === 'Delete' || e.key === 'Backspace') removeSelected()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [cancelPlacement, removeSelected])

  const handleCreateRoot = useCallback(() => {
    addRoot(rootSize, rootKind, { x: 400, y: 300 })
  }, [addRoot, rootSize, rootKind])

  const hasRoots = graph.rootIds.length > 0

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Nodal Builder</h1>
        <div className="toolbar-group">
          <label>
            Root size
            <select value={rootSize} onChange={(e) => setRootSize(e.target.value as NodeSize)} disabled={hasRoots}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label>
            Root kind
            <select value={rootKind} onChange={(e) => setRootKind(e.target.value as NodeKind)} disabled={hasRoots}>
              <option value="standard">Standard</option>
              <option value="bridge">Bridge</option>
            </select>
          </label>
          <button type="button" data-testid="create-root" onClick={handleCreateRoot} disabled={hasRoots}>
            Create Root
          </button>
        </div>
        <div className="toolbar-group">
          <label title="Size of the next node you place from any hub.">
            New node size
            <select value={childSize} onChange={(e) => setChildSize(e.target.value as NodeSize)}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label>
            Child kind
            <select value={childKind} onChange={(e) => setChildKind(e.target.value as NodeKind)}>
              <option value="standard">Standard</option>
              <option value="bridge">Bridge</option>
            </select>
          </label>
        </div>
        <button type="button" data-testid="reset-canvas" onClick={reset}>
          Reset
        </button>
        {feedback && <p className="feedback" data-testid="feedback">{feedback}</p>}
        {placement.type === 'idle' && hasRoots && (
          <p className="hint">
            Click a node&apos;s outer ring, drag outward, release. Pick New node size first — any hub works. Gray wedge points at parent (can&apos;t branch there).
          </p>
        )}
        {placement.type === 'placing' && (
          <p className="hint">Drag outward to set distance, release to place. Esc to cancel.</p>
        )}
        {placement.type === 'repositioning' && <p className="hint">Dragging radially — angle locked.</p>}
      </header>
      <main className="canvas">
        <NodeGraph
          graph={graph}
          placement={placement}
          childSize={childSize}
          childKind={childKind}
          onWedgePlacementStart={beginPlacement}
          onPerimeterPlacementStart={beginPlacementAtAngle}
          onPlacementDistanceChange={updatePlacementDistance}
          onPlacementCommit={commitPlacement}
          onPlacementCancel={cancelPlacement}
          onRepositionStart={beginReposition}
          onRepositionDistanceChange={updateRepositionDistance}
          onRepositionEnd={endReposition}
          onSelectNode={selectNode}
          onInsertEdge={insertOnEdge}
          onBlocked={reportBlocked}
        />
      </main>
    </div>
  )
}