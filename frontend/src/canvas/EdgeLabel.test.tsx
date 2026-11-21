import { fireEvent, render, screen } from '@testing-library/react'
import { ReactFlow, ReactFlowProvider, useEdges } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { beforeAll, expect, test } from 'vitest'
import { ArrowLabel } from '@/canvas/EdgeLabel'
import { LabelEditing } from '@/canvas/label-editing'
import { FarContext, ReadOnlyContext } from '@/canvas/readonly'
import type { AppEdge, EdgeLabel } from '@/canvas/types'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

function Probe() {
  const [edge] = useEdges<AppEdge>()
  return <ArrowLabel edge={edge} label={edge.data?.label} at={{ x: 150, y: 0 }} onSize={() => {}} />
}

function Board({ editing: first = null }: { editing?: string | null }) {
  const [editing, setEditing] = useState<string | null>(first)
  return (
    <LabelEditing.Provider value={{ editing, setEditing }}>
      <svg>
        <Probe />
      </svg>
      <output data-testid="editing">{editing ?? ''}</output>
    </LabelEditing.Provider>
  )
}

function renderLabel(
  label: EdgeLabel | undefined,
  {
    editing = null,
    readOnly = false,
    far = false,
  }: { editing?: string | null; readOnly?: boolean; far?: boolean } = {},
) {
  const edges: AppEdge[] = [{ id: 'e', source: 'a', target: 'b', data: label ? { label } : {} }]
  const seen = { edges }
  function Spy() {
    const now = useEdges<AppEdge>()
    useEffect(() => {
      seen.edges = now
    })
    return null
  }
  render(
    <ReactFlowProvider initialEdges={edges}>
      {/* Takes the edges as its own, so a label's change lands in the store. */}
      <ReactFlow defaultNodes={[]} defaultEdges={edges} />
      <ReadOnlyContext.Provider value={readOnly}>
        <FarContext.Provider value={far}>
          <Board editing={editing} />
          <Spy />
        </FarContext.Provider>
      </ReadOnlyContext.Provider>
    </ReactFlowProvider>,
  )
  return () => seen.edges[0].data?.label
}

test('a label shows its text in its size and fill', () => {
  renderLabel({ text: 'waits for API', size: 'large', color: 'pink' })
  const label = screen.getByTestId('arrow-label')
  expect(label.textContent).toBe('waits for API')
  expect(label.style.fontSize).toBe('20px')
  expect(label.style.background).toContain('--sticky-pink')
})

test('an arrow without a label shows nothing until it is edited', () => {
  renderLabel(undefined)
  expect(screen.queryByTestId('arrow-label')).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('typing a new label and Enter stores it; Shift+Enter is a new line', () => {
  const label = renderLabel(undefined, { editing: 'e' })
  const field = screen.getByRole('textbox', { name: 'Arrow label' })
  fireEvent.change(field, { target: { value: 'ships\nin' } })
  fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })
  expect(screen.getByRole('textbox')).toBe(field)
  fireEvent.keyDown(field, { key: 'Enter' })
  fireEvent.blur(field)
  expect(label()).toEqual({ text: 'ships\nin' })
  expect(screen.getByTestId('editing').textContent).toBe('')
})

test('Enter that confirms an input method character keeps the editor open', () => {
  renderLabel(undefined, { editing: 'e' })
  const field = screen.getByRole('textbox', { name: 'Arrow label' })
  fireEvent.change(field, { target: { value: 'にほん' } })
  fireEvent.keyDown(field, { key: 'Enter', isComposing: true })
  expect(screen.getByRole('textbox')).toBe(field)
  expect(screen.getByTestId('editing').textContent).toBe('e')
})

test('Escape keeps the text', () => {
  const label = renderLabel({ text: 'old', at: 0.2 }, { editing: 'e' })
  const field = screen.getByRole('textbox')
  fireEvent.change(field, { target: { value: 'new' } })
  fireEvent.keyDown(field, { key: 'Escape' })
  fireEvent.blur(field)
  expect(label()).toEqual({ text: 'new', at: 0.2 })
})

test('clearing the text removes the label', () => {
  const label = renderLabel({ text: 'old' }, { editing: 'e' })
  const field = screen.getByRole('textbox')
  fireEvent.change(field, { target: { value: '  ' } })
  fireEvent.blur(field)
  expect(label()).toBeUndefined()
})

test('a viewer gets no editor and the label takes no pointer', () => {
  renderLabel({ text: 'hi' }, { editing: 'e', readOnly: true })
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByTestId('arrow-label').style.pointerEvents).toBe('none')
})

test('far out a label is a bar', () => {
  renderLabel({ text: 'hello' }, { far: true })
  expect(screen.queryByTestId('arrow-label')).toBeNull()
  expect(document.querySelector('.edge-label-bar')).not.toBeNull()
})

test('zooming far out while typing keeps what was typed and ends editing', () => {
  const edges: AppEdge[] = [{ id: 'e', source: 'a', target: 'b', data: {} }]
  const seen = { edges }
  function Spy() {
    const now = useEdges<AppEdge>()
    useEffect(() => {
      seen.edges = now
    })
    return null
  }
  function Zoom() {
    const [far, setFar] = useState(false)
    return (
      <FarContext.Provider value={far}>
        <button type="button" onClick={() => setFar(true)}>
          zoom far
        </button>
        <Board editing="e" />
      </FarContext.Provider>
    )
  }
  render(
    <ReactFlowProvider initialEdges={edges}>
      <ReactFlow defaultNodes={[]} defaultEdges={edges} />
      <Zoom />
      <Spy />
    </ReactFlowProvider>,
  )
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'half typed' } })
  fireEvent.click(screen.getByRole('button', { name: 'zoom far' }))
  expect(seen.edges[0].data?.label).toEqual({ text: 'half typed' })
  expect(screen.getByTestId('editing').textContent).toBe('')
})
