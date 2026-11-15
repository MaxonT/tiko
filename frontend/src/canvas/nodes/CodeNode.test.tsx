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

function Board({ data }: { data: CodeData }) {
  const [nodes, , onNodesChange] = useNodesState<AppNode>([
    // A stored height: jsdom measures nothing, and xyflow hides a node it has not measured.
    { id: 'k', type: 'code', position: { x: 0, y: 0 }, width: 480, height: 120, data },
  ])
  useEffect(() => {
    current = nodes
  }, [nodes])
  return <ReactFlow nodes={nodes} nodeTypes={nodeTypes} onNodesChange={onNodesChange} />
}

function show(data: CodeData, readOnly = false) {
  render(
    <ReadOnlyContext.Provider value={readOnly}>
      <ReactFlowProvider>
        <div style={{ width: 800, height: 600 }}>
          <Board data={data} />
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
  show({ text: 'secret = 1', language: 'plain', collapsed: true }, true)
  fireEvent.click(screen.getByRole('button', { name: 'Unfold code' }))
  expect(saved().collapsed).toBe(true)
  expect(screen.getByRole('button', { name: 'Fold code' })).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy code' })))
  expect(writeText).toHaveBeenCalledWith('secret = 1')
  fireEvent.doubleClick(screen.getByText('secret = 1'))
  expect(screen.queryByRole('textbox')).toBeNull()
})
