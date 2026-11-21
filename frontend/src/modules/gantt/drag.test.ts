import { describe, expect, it } from 'vitest'
import { dropTarget, select } from '@/modules/gantt/drag'
import type { TreeRow } from '@/modules/gantt/tree'

// A at 0, B at 1, C at 2, D at 1, E at 0.
const rest: TreeRow[] = (
  [
    ['A', 0],
    ['B', 1],
    ['C', 2],
    ['D', 1],
    ['E', 0],
  ] as const
).map(([id, depth]) => ({ row: { id, title: '', start: '', end: '' }, depth, hasChildren: false }))

const at = (ghostTop: number, dx = 0, startDepth = 0, deepest = 0) =>
  dropTarget({ rest, ghostTop, rowHeight: 34, dx, startDepth, deepest })

describe('dropTarget', () => {
  it('picks the nearest gap, changing at half a row', () => {
    expect(at(0).slot).toBe(0)
    expect(at(16).slot).toBe(0)
    expect(at(18).slot).toBe(1)
    expect(at(-200).slot).toBe(0)
    expect(at(9999).slot).toBe(5)
  })

  it('clamps the level between the row below and one under the row above', () => {
    // Between C (2) and D (1): levels 1 to 3.
    expect(at(3 * 34).depth).toBe(1)
    expect(at(3 * 34, 16, 1).depth).toBe(2)
    expect(at(3 * 34, 32, 1)).toMatchObject({ depth: 3, parentId: 'C', aboveId: 'C', fits: true })
    expect(at(3 * 34, 999).depth).toBe(3)
    expect(at(3 * 34, -999).depth).toBe(1)
    // As a sibling of B and D: their parent is A.
    expect(at(3 * 34).parentId).toBe('A')
    // At the top only the first level.
    expect(at(0, 99)).toMatchObject({ depth: 0, parentId: null, aboveId: null })
  })

  it('starts from the dragged row’s own level', () => {
    expect(at(3 * 34, 0, 2).depth).toBe(2)
    expect(at(3 * 34, -16, 2).depth).toBe(1)
  })

  it('does not fit when the moving rows would go past five levels', () => {
    // A branch two levels deep under C would reach level 5.
    expect(at(3 * 34, 32, 0, 2).depth).toBe(2)
    expect(at(3 * 34, 0, 0, 4).fits).toBe(false)
  })
})

describe('select', () => {
  const order = ['a', 'b', 'c', 'd', 'e']
  const plain = { shift: false, toggle: false }
  const toggle = { shift: false, toggle: true }
  const shift = { shift: true, toggle: false }
  const ids = (result: { selected: Set<string> }) => [...result.selected].sort()

  it('selects a row alone, toggles with Cmd, spans with Shift', () => {
    expect(ids(select(new Set(['a', 'c']), 'a', 'b', order, plain))).toEqual(['b'])
    const toggled = select(new Set(['b']), 'b', 'd', order, toggle)
    expect(ids(toggled)).toEqual(['b', 'd'])
    expect(ids(select(toggled.selected, 'd', 'b', order, toggle))).toEqual(['d'])
    expect(ids(select(new Set(['b']), 'b', 'd', order, shift))).toEqual(['b', 'c', 'd'])
    expect(ids(select(new Set(['d']), 'd', 'b', order, shift))).toEqual(['b', 'c', 'd'])
    // The anchor stays for the next Shift-click.
    expect(select(new Set(['b']), 'b', 'd', order, shift).anchor).toBe('b')
  })

  it('adds the span to the selection with Shift and Cmd', () => {
    const added = select(new Set(['a']), 'c', 'e', order, { shift: true, toggle: true })
    expect(ids(added)).toEqual(['a', 'c', 'd', 'e'])
  })

  it('starts from the clicked row when the anchor is gone', () => {
    expect(ids(select(new Set(), 'x', 'c', order, shift))).toEqual(['c'])
  })
})
