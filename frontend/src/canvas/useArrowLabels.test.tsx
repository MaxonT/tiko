import { act, fireEvent, render, screen } from '@testing-library/react'
import { applyEdgeChanges, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { beforeAll, expect, test } from 'vitest'
import * as Y from 'yjs'
import { ArrowLabel } from '@/canvas/EdgeLabel'
import { LabelEditing } from '@/canvas/label-editing'
import { ArrowBar } from '@/canvas/SelectionBar'
import type { AppEdge, AppNode } from '@/canvas/types'
import { labelled, useArrowLabels } from '@/canvas/useArrowLabels'
import { LOCAL, LiveBinding } from '@/live/binding'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const sticky = (id: string, x: number): AppNode =>
  ({
    id,
    type: 'sticky',
    position: { x, y: 0 },
    width: 100,
    height: 100,
    data: { text: id, color: 'yellow' },
  }) as AppNode
const NODES = [sticky('a', 0), sticky('b', 400)]

/**
 * The board's arrow-label wiring as the canvas has it: the hook, the shared document with its
 * undo history, the arrow bar for selected arrows, and each arrow's label. jsdom lays nothing
 * out, so arrows are not drawn by the canvas library; a button stands in for the double-click
 * the canvas hands to `edit`.
 */
function Board({ first, live }: { first: AppEdge[]; live: LiveBinding }) {
  const [edges, setEdges] = useState(first)
  useEffect(() => live.push(NODES, edges), [live, edges])
  useEffect(() => {
    const pull = () => setEdges((current) => live.pullEdges(current))
    window.addEventListener('test-pull', pull)
    return () => window.removeEventListener('test-pull', pull)
  }, [live])
  const labels = useArrowLabels({ edges, setEdges, hits: null, readOnly: false, far: false })
  const selected = edges.filter((e) => e.selected)
  return (
    <LabelEditing.Provider value={labels.editingValue}>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow
          nodes={NODES}
          edges={labels.shown}
          onEdgesChange={(changes) => setEdges((current) => applyEdgeChanges(changes, current))}
        />
      </div>
      {selected.length > 0 && (
        <ArrowBar edges={selected} {...labels.bar(selected)} onDelete={() => {}} />
      )}
      <svg>
        {labels.shown.map((edge) => (
          <g
            key={edge.id}
            data-testid={`edge-${edge.id}`}
            data-style={JSON.stringify(edge.data?.label ?? null)}
          >
            <ArrowLabel
              edge={edge}
              label={edge.data?.label}
              at={{ x: 200, y: 50 }}
              onSize={() => {}}
            />
          </g>
        ))}
      </svg>
      {edges.map((edge) => (
        <button key={edge.id} type="button" onDoubleClick={() => labels.edit(edge.id)}>
          {`double-click ${edge.id}`}
        </button>
      ))}
    </LabelEditing.Provider>
  )
}

function renderBoard(first: AppEdge[]) {
  const doc = new Y.Doc()
  const live = new LiveBinding(doc, () => {})
  const history = new Y.UndoManager([live.nodes, live.edges], {
    trackedOrigins: new Set([LOCAL]),
    captureTimeout: 0,
  })
  render(
    <ReactFlowProvider>
      <Board first={first} live={live} />
    </ReactFlowProvider>,
  )
  const stored = () => live.edges.get('e')
  const undo = () =>
    act(() => {
      history.undo()
      window.dispatchEvent(new Event('test-pull'))
    })
  return { stored, undo }
}

const type = (text: string) => {
  const field = screen.getByRole('textbox', { name: 'Arrow label' })
  fireEvent.change(field, { target: { value: text } })
  fireEvent.keyDown(field, { key: 'Enter' })
  fireEvent.blur(field)
}

test('a double-click on an arrow opens an empty label; typed words are stored and undo takes them back', () => {
  const { stored, undo } = renderBoard([{ id: 'e', source: 'a', target: 'b' }])
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.doubleClick(screen.getByRole('button', { name: 'double-click e' }))
  const field = screen.getByRole('textbox', { name: 'Arrow label' }) as HTMLTextAreaElement
  expect(field.value).toBe('')
  type('waits for API')
  expect(stored()).toEqual({ source: 'a', target: 'b', data: { label: { text: 'waits for API' } } })
  expect(screen.getByTestId('arrow-label').textContent).toBe('waits for API')
  undo()
  expect(stored()).toEqual({ source: 'a', target: 'b' })
  expect(screen.queryByTestId('arrow-label')).toBeNull()
})

test('Enter on the one selected arrow starts its label', () => {
  renderBoard([{ id: 'e', source: 'a', target: 'b', selected: true }])
  fireEvent.keyDown(document.body, { key: 'Enter', code: 'Enter' })
  expect(screen.getByRole('textbox', { name: 'Arrow label' })).toBeTruthy()
})

test('Enter with no arrow selected is left to a focused button', () => {
  renderBoard([{ id: 'e', source: 'a', target: 'b' }])
  const button = document.createElement('button')
  document.body.append(button)
  button.focus()
  const enter = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
    cancelable: true,
  })
  button.dispatchEvent(enter)
  expect(enter.defaultPrevented).toBe(false)
  expect(screen.queryByRole('textbox', { name: 'Arrow label' })).toBeNull()
  button.remove()
})

test('Add label in the arrow bar starts the label of an arrow without one', () => {
  renderBoard([{ id: 'e', source: 'a', target: 'b', selected: true }])
  fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
  expect(screen.getByRole('textbox', { name: 'Arrow label' })).toBeTruthy()
})

test('the arrow bar tries a fill on hover and sets fill and text size on the label', () => {
  const { stored } = renderBoard([
    { id: 'e', source: 'a', target: 'b', selected: true, data: { label: { text: 'blocks' } } },
  ])
  const shown = () => JSON.parse(screen.getByTestId('edge-e').dataset.style!)
  fireEvent.click(screen.getByRole('button', { name: 'Fill' }))
  fireEvent.pointerEnter(screen.getByRole('button', { name: 'pink fill' }))
  expect(shown()).toEqual({ text: 'blocks', color: 'pink' })
  expect(stored()?.data).toEqual({ label: { text: 'blocks' } })
  fireEvent.click(screen.getByRole('button', { name: 'pink fill' }))
  fireEvent.click(screen.getByRole('button', { name: 'Text size' }))
  fireEvent.click(screen.getByRole('button', { name: 'Large' }))
  expect(stored()?.data).toEqual({ label: { text: 'blocks', color: 'pink', size: 'large' } })
})

test('the arrows as drawn are the same objects while nothing about labels changes', () => {
  const edges: AppEdge[] = [{ id: 'e', source: 'a', target: 'b' }]
  expect(labelled(edges, null, null)).toBe(edges)
  const named = labelled(
    [{ id: 'e', source: 'a', target: 'b', data: { label: { text: 'x' } } }],
    null,
    null,
  )
  expect(named[0].ariaLabel).toBe('Arrow: x')
})
