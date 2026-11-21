import { expect, test } from 'vitest'
import {
  clampShare,
  cutDashes,
  editedLabel,
  flatten,
  pointAt,
  project,
  shareRange,
  snapMiddle,
  styledLabel,
  tidyLabel,
} from '@/canvas/edge-label'
import { turnedBezier } from '@/canvas/TurnedEdge'
import { Position } from '@xyflow/react'

const STRAIGHT = 'M0,0 C50,0 50,0 300,0'
const HOOK = 'M0,0 C200,0 200,100 0,100'
// Control points crossed over, so the curve loops through itself.
const LOOP = 'M0,0 C300,200 -200,200 100,0'

test('a path flattens to points with their running length', () => {
  const poly = flatten('M0,0 L30,40 L30,100')
  expect(poly.points).toEqual([
    { x: 0, y: 0 },
    { x: 30, y: 40 },
    { x: 30, y: 100 },
  ])
  expect(poly.lengths).toEqual([0, 50, 110])
  expect(flatten(STRAIGHT).total).toBeCloseTo(300, 0)
})

test('a share is a share of the length, not of the curve formula', () => {
  // The controls bunch the curve's parameter near the start; the length does not care.
  const mid = pointAt(flatten(STRAIGHT), 0.5)
  expect(mid.x).toBeCloseTo(150, 0)
  expect(mid.y).toBeCloseTo(0, 5)
})

test('the middle of a hook is at the bend, and of an arrow tiko draws on its curve', () => {
  const bend = pointAt(flatten(HOOK), 0.5)
  expect(bend.x).toBeCloseTo(150, 0)
  expect(bend.y).toBeCloseTo(50, 0)
  const drawn = turnedBezier(
    { x: 0, y: 0 },
    Position.Right,
    0,
    { x: 200, y: 120 },
    Position.Left,
    0,
  )
  const point = pointAt(flatten(drawn), 0.5)
  expect(point.x).toBeCloseTo(100, 0)
  expect(point.y).toBeCloseTo(60, 0)
})

test('a label keeps clear of both ends', () => {
  const poly = flatten(STRAIGHT)
  const size = { width: 60, height: 20 }
  const [lo, hi] = shareRange(poly, size)!
  expect(lo * poly.total).toBeCloseTo(42, -1)
  expect(hi * poly.total).toBeCloseTo(258, -1)
  expect(clampShare(poly, 0, size)).toBe(lo)
  expect(clampShare(poly, 1, size)).toBe(hi)
  expect(clampShare(poly, 0.3, size)).toBe(0.3)
})

test('a label keeps off the elements at both ends', () => {
  const size = { width: 60, height: 20 }
  // Out of the right side of an element, then down past it.
  const out = flatten('M0,0 L100,0 L100,300')
  const element = { x: -160, y: -60, width: 160, height: 120 }
  const [lo] = shareRange(out, size, [element, null])!
  expect(pointAt(out, lo).x - size.width / 2).toBeGreaterThanOrEqual(0)
  // Along the side of the element all the way: no place off it, so the middle.
  const along = flatten('M0,0 L0,300')
  const beside = { x: 0, y: -10, width: 160, height: 320 }
  expect(shareRange(along, size)).not.toBeNull()
  expect(shareRange(along, size, [beside, null])).toBeNull()
})

test('a label wider than its arrow stays in the middle', () => {
  const poly = flatten('M0,0 L50,0')
  expect(shareRange(poly, { width: 80, height: 20 })).toBeNull()
  expect(clampShare(poly, 0.1, { width: 80, height: 20 })).toBe(0.5)
})

test('a looping arrow still has a point at every share and a range', () => {
  const poly = flatten(LOOP)
  for (const share of [0, 0.25, 0.5, 0.75, 1]) {
    const p = pointAt(poly, share)
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  }
  expect(shareRange(poly, { width: 40, height: 18 })).not.toBeNull()
})

test('a stored label leaves out the middle, no fill and medium', () => {
  expect(tidyLabel({ text: 'a', at: 0.5, size: 'medium' })).toEqual({ text: 'a' })
  expect(tidyLabel({ text: 'a', at: 0.12345, color: 'pink', size: 'large' })).toEqual({
    text: 'a',
    at: 0.123,
    color: 'pink',
    size: 'large',
  })
})

test('typing nothing but spaces removes a label, and text is cut at 500', () => {
  expect(editedLabel({ text: 'old', at: 0.2 }, '   ')).toBeUndefined()
  expect(editedLabel(undefined, 'new')).toEqual({ text: 'new' })
  expect(editedLabel({ text: 'old', at: 0.2 }, 'x'.repeat(600))?.text).toHaveLength(500)
})

test('a fill and a size from the bar, and no fill takes the fill away', () => {
  expect(styledLabel({ text: 'a' }, { color: 'blue', size: 'large' })).toEqual({
    text: 'a',
    color: 'blue',
    size: 'large',
  })
  expect(styledLabel({ text: 'a', color: 'blue', size: 'large' }, { color: 'none' })).toEqual({
    text: 'a',
    size: 'large',
  })
  expect(styledLabel({ text: 'a', size: 'large' }, { size: 'medium' })).toEqual({ text: 'a' })
})

test('the line is left out under the label, past its box by the gap', () => {
  const poly = flatten('M0,0 L300,0')
  expect(cutDashes(poly, { x: 150, y: 0 }, { width: 60, height: 20 })).toBe('117 66 117 0')
  expect(cutDashes(poly, { x: 150, y: 80 }, { width: 60, height: 20 })).toBeNull()
  expect(cutDashes(poly, { x: 150, y: 0 }, { width: 0, height: 0 })).toBeNull()
})

test('a dragged label follows the pointer along a straight arrow and snaps to the middle', () => {
  const poly = flatten('M0,0 L300,0')
  expect(project(poly, 0.5, { x: 60, y: 40 }, 1)).toBeCloseTo(0.2, 5)
  expect(project(poly, 0.5, { x: 900, y: 0 }, 1)).toBe(1)
  expect(snapMiddle(poly, 0.51, 1)).toBe(0.5)
  expect(snapMiddle(poly, 0.51, 4)).toBe(0.51)
  expect(snapMiddle(poly, 0.6, 1)).toBe(0.6)
})

// Straight legs drawn as curves, so each is many short pieces as a real arrow is: out on one
// diagonal, up, and back on the other diagonal, crossing itself at (100,100).
const CROSSING = 'M0,0 C0,0 200,200 200,200 C200,200 200,0 200,0 C200,0 0,200 0,200'

test('through a crossing a dragged label stays on the branch it is on', () => {
  const poly = flatten(CROSSING)
  const before = project(poly, 0, { x: 90, y: 90 }, 1)
  expect(pointAt(poly, before)).toMatchObject({ x: 90, y: 90 })
  const after = project(poly, before, { x: 110, y: 110 }, 1)
  expect(pointAt(poly, after).x).toBeCloseTo(110, 5)
  // Still on the way out, the first third of the arrow, not the way back through (110,110).
  expect(after).toBeLessThan(0.3)
})

test('a part of the arrow clearly nearer to the pointer takes the label', () => {
  const poly = flatten(CROSSING)
  const from = project(poly, 0, { x: 50, y: 50 }, 1)
  // The way back passes through (60,140); the label's own stretch is 57 units away.
  const to = pointAt(poly, project(poly, from, { x: 60, y: 140 }, 1))
  expect(to.x).toBeCloseTo(60, 0)
  expect(to.y).toBeCloseTo(140, 0)
  // Zoomed out, the same stray is few screen pixels: the label stays on its stretch.
  const kept = pointAt(poly, project(poly, from, { x: 60, y: 140 }, 0.5))
  expect(kept.x).toBeCloseTo(kept.y, 5)
})

test('a loop that runs under the label twice is cut twice', () => {
  // Out along y=0, back along y=10: both stretches pass under a label at the turn's middle.
  const poly = flatten('M0,0 L300,0 L300,10 L0,10')
  const dashes = cutDashes(poly, { x: 150, y: 5 }, { width: 40, height: 20 })!.split(' ')
  expect(dashes).toHaveLength(6)
  expect(dashes.map(Number).reduce((a, b) => a + b)).toBeCloseTo(poly.total, 5)
})
