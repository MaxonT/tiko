import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactFlow, ReactFlowProvider, useNodesState } from '@xyflow/react'
import { useEffect } from 'react'
import { beforeAll, expect, test, vi } from 'vitest'
import { CodeNode } from '@/canvas/nodes/CodeNode'
import { ReadOnlyContext } from '@/canvas/readonly'
import type { AppNode, CodeData } from '@/canvas/types'

const nodeTypes = { code: CodeNode }

beforeAll(() => {
  // xyflow measures nodes; jsdom has no layout.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

let current: AppNode[] = []
let setCurrent: (change: (nodes: AppNode[]) => AppNode[]) => void = () => {}

type Options = { readOnly?: boolean; selected?: boolean; height?: number }

function Board({ data, selected, height }: { data: CodeData } & Options) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([
    // jsdom measures nothing, and xyflow hides a node it has not measured.
    {
      id: 'k',
      type: 'code',
      position: { x: 0, y: 0 },
      width: 480,
      measured: { width: 480, height: 120 },
      height,
      data,
      selected,
    },
  ])
  useEffect(() => {
    current = nodes
    setCurrent = setNodes
  }, [nodes, setNodes])
  return <ReactFlow nodes={nodes} nodeTypes={nodeTypes} onNodesChange={onNodesChange} />
}

function show(data: CodeData, { readOnly = false, ...node }: Options = {}) {
  render(
    <ReadOnlyContext.Provider value={readOnly}>
      <ReactFlowProvider>
        <div style={{ width: 800, height: 600 }}>
          <Board data={data} {...node} />
        </div>
      </ReactFlowProvider>
    </ReadOnlyContext.Provider>,
  )
}

const saved = () => current[0].data as CodeData

test('tab indents inside the editor and the text is saved on leaving it', () => {
  show({ text: 'x', language: 'plain' })
  fireEvent.doubleClick(screen.getByText('x'))
  const field = screen.getByRole('textbox', { name: 'Code' }) as HTMLTextAreaElement
  field.setSelectionRange(0, 0)
  fireEvent.keyDown(field, { key: 'Tab' })
  expect(field.value).toBe('  x')
  fireEvent.keyDown(field, { key: 'Escape' })
  expect(saved().text).toBe('  x')
})

test('code is colored once its language loads', async () => {
  show({ text: 'def f(): pass', language: 'python' })
  await waitFor(
    () => {
      const style = screen.getByText('def').style
      expect(style.getPropertyValue('--code-light')).not.toBe('')
      expect(style.getPropertyValue('--code-dark')).not.toBe('')
    },
    { timeout: 5000 },
  )
})

test('folding is saved and shows the first line with the line count', () => {
  show({ text: 'SELECT 1;\nSELECT 2;', language: 'plain' })
  fireEvent.click(screen.getByRole('button', { name: 'Fold code' }))
  expect(saved().collapsed).toBe(true)
  expect(screen.getByText(/2 lines/)).toBeTruthy()
})

test('a viewer unfolds a block for themselves only and can copy it', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText } })
  show({ text: 'secret = 1', language: 'plain', collapsed: true }, { readOnly: true })
  fireEvent.click(screen.getByRole('button', { name: 'Unfold code' }))
  expect(saved().collapsed).toBe(true)
  expect(screen.getByRole('button', { name: 'Fold code' })).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy code' })))
  expect(writeText).toHaveBeenCalledWith('secret = 1')
  fireEvent.doubleClick(screen.getByText('secret = 1'))
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('a folded block shows its title instead of its first line', () => {
  show({
    title: 'Health check',
    text: 'curl -s localhost/health',
    language: 'bash',
    collapsed: true,
  })
  expect(screen.getByText('Health check')).toBeTruthy()
  expect(screen.queryByText('curl -s localhost/health')).toBeNull()
})

test('typing in the language list narrows it and Enter picks the first match', () => {
  show({ text: 'x = 1', language: 'plain' }, { selected: true })
  fireEvent.click(screen.getByRole('button', { name: /Plain text/ }))
  const find = screen.getByRole('combobox', { name: 'Find a language' })
  fireEvent.change(find, { target: { value: 'py' } })
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Python'])
  fireEvent.keyDown(find, { key: 'Enter' })
  expect(saved().language).toBe('python')
})

test('arrow keys keep the active language in view, wrapping around', () => {
  const seen = vi.fn()
  Element.prototype.scrollIntoView = function (this: Element) {
    seen(this.textContent)
  }
  show({ text: 'x = 1', language: 'plain' }, { selected: true })
  fireEvent.click(screen.getByRole('button', { name: /Plain text/ }))
  const find = screen.getByRole('combobox', { name: 'Find a language' })
  const options = screen.getAllByRole('option')
  fireEvent.keyDown(find, { key: 'ArrowUp' })
  expect(seen).toHaveBeenLastCalledWith(options.at(-1)!.textContent)
  fireEvent.keyDown(find, { key: 'ArrowDown' })
  expect(seen).toHaveBeenLastCalledWith(options[0].textContent)
})

test('a stored height is dropped, so the block follows its code', async () => {
  show({ text: 'x', language: 'plain' }, { height: 118 })
  await waitFor(() => expect(current[0].height).toBeUndefined())
})

test('line numbers come on from the header and a click on one marks its line', () => {
  show({ text: 'a\nb\nc', language: 'plain' }, { selected: true })
  fireEvent.click(screen.getByRole('button', { name: 'Line numbers' }))
  expect(saved().numbered).toBe(true)
  fireEvent.click(screen.getAllByTitle('Mark line')[1])
  expect(saved().marked).toEqual([2])
  fireEvent.click(screen.getByTitle('Unmark line'))
  expect(saved().marked).toEqual([])
})

test('a press on the block itself closes the language list', () => {
  show({ text: 'x = 1', language: 'plain' }, { selected: true })
  fireEvent.click(screen.getByRole('button', { name: /Plain text/ }))
  expect(screen.getByRole('listbox')).toBeTruthy()
  fireEvent.pointerDown(screen.getByText('x = 1'))
  expect(screen.queryByRole('listbox')).toBeNull()
})

test('an edit survives the editor leaving the screen without a blur', () => {
  show({ text: 'x', language: 'plain', marked: [1] })
  fireEvent.doubleClick(screen.getByText('x'))
  const field = screen.getByRole('textbox', { name: 'Code' })
  fireEvent.change(field, { target: { value: 'top\nx' } })
  // Far zoom and culling unmount the node as hiding it does.
  act(() => setCurrent((nodes) => nodes.map((n) => ({ ...n, hidden: true }))))
  expect(saved()).toMatchObject({ text: 'top\nx', marked: [2] })
})

test('an editor that leaves unchanged writes nothing', () => {
  show({ text: 'x', language: 'plain' })
  fireEvent.doubleClick(screen.getByText('x'))
  const before = current[0].data
  act(() => setCurrent((nodes) => nodes.map((n) => ({ ...n, hidden: true }))))
  expect(current[0].data).toBe(before)
})
