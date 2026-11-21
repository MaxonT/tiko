import { expect, test, vi } from 'vitest'
import { flyTo, placeLabel, zoomFor } from './fly'

test('keeps the zoom for small elements and zooms out to fit big ones', () => {
  window.innerWidth = 1000
  window.innerHeight = 800
  expect(zoomFor(40, 40, 1.5)).toBe(1.5)
  expect(zoomFor(40, 40, 0.3)).toBe(0.8)
  expect(zoomFor(1600, 400, 1)).toBe(0.5)
})

function flow() {
  const node = (x: number, y: number) => ({
    internals: { positionAbsolute: { x, y } },
    measured: { width: 100, height: 50 },
  })
  const nodes: Record<string, ReturnType<typeof node>> = { a: node(0, 0), b: node(400, 200) }
  return {
    getInternalNode: (id: string) => nodes[id] as never,
    getEdge: (id: string) => (id === 'e' ? { source: 'a', target: 'b' } : undefined),
    getZoom: () => 1,
    setCenter: vi.fn(() => Promise.resolve(true)),
  }
}

test('search moves the board to an arrow label where it is drawn, else to the arrow middle', () => {
  const board = flow()
  flyTo(board, 'e', { flash: false })
  expect(board.setCenter.mock.calls[0].slice(0, 2)).toEqual([250, 125])
  placeLabel('e', { x: 360, y: 190 })
  flyTo(board, 'e', { flash: false })
  expect(board.setCenter.mock.calls[1].slice(0, 2)).toEqual([360, 190])
  placeLabel('e', null)
  flyTo(board, 'e', { flash: false })
  expect(board.setCenter.mock.calls[2].slice(0, 2)).toEqual([250, 125])
})
