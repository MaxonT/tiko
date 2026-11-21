import { act, render, screen } from '@testing-library/react'
import { ReactFlow, ReactFlowProvider, useEdges } from '@xyflow/react'
import { useEffect } from 'react'
import { beforeAll, expect, test } from 'vitest'
import { flatten, shareRange } from '@/canvas/edge-label'
import { useLabelDrag } from '@/canvas/label-drag'
import type { AppEdge, EdgeLabel } from '@/canvas/types'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.setPointerCapture ??= () => {}
})

const poly = flatten('M0,0 L300,0')
const box = { width: 60, height: 20 }

function Handle({ enabled }: { enabled: boolean }) {
  const [edge] = useEdges<AppEdge>()
  const drag = useLabelDrag('e', edge.data?.label, poly, shareRange(poly, box), enabled)
  return (
    <div
      data-testid="label"
      data-share={drag.dragged ?? ''}
      data-draggable={drag.draggable}
      onPointerDown={drag.onPointerDown}
    />
  )
}

function renderDrag(label: EdgeLabel, enabled = true) {
  const edges: AppEdge[] = [{ id: 'e', source: 'a', target: 'b', data: { label } }]
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
      <ReactFlow defaultNodes={[]} defaultEdges={edges} />
      <Handle enabled={enabled} />
      <Spy />
    </ReactFlowProvider>,
  )
  return { handle: screen.getByTestId('label'), label: () => seen.edges[0].data?.label }
}

// jsdom has no PointerEvent: plain events carry the fields the drag reads.
const pointer = (el: HTMLElement, type: string, x = 0) =>
  act(() => {
    const event = new Event(type, { bubbles: true })
    el.dispatchEvent(Object.assign(event, { button: 0, clientX: x, clientY: 0, pointerId: 1 }))
  })
const press = (el: HTMLElement, x: number) => pointer(el, 'pointerdown', x)
const moveTo = (el: HTMLElement, x: number) => pointer(el, 'pointermove', x)
const release = (el: HTMLElement) => pointer(el, 'pointerup')

test('a drag slides the label and is written once on release', () => {
  const { handle, label } = renderDrag({ text: 'then' })
  press(handle, 150)
  moveTo(handle, 90)
  expect(Number(handle.dataset.share)).toBeCloseTo(0.3, 2)
  expect(label()).toEqual({ text: 'then' })
  release(handle)
  expect(label()?.at).toBeCloseTo(0.3, 2)
  expect(handle.dataset.share).toBe('')
})

test('a press without a move changes nothing, and near the middle the label snaps back', () => {
  const { handle, label } = renderDrag({ text: 'then', at: 0.2 })
  press(handle, 60)
  moveTo(handle, 61)
  release(handle)
  expect(label()).toEqual({ text: 'then', at: 0.2 })
  press(handle, 60)
  moveTo(handle, 152)
  release(handle)
  expect(label()).toEqual({ text: 'then' })
})

test('the label stops short of the ends', () => {
  const { handle, label } = renderDrag({ text: 'then' })
  press(handle, 150)
  moveTo(handle, 400)
  release(handle)
  expect(label()!.at! * 300).toBeCloseTo(258, -1)
})

test('a viewer cannot drag', () => {
  const { handle, label } = renderDrag({ text: 'then' }, false)
  expect(handle.dataset.draggable).toBe('false')
  press(handle, 150)
  moveTo(handle, 60)
  release(handle)
  expect(label()).toEqual({ text: 'then' })
})
