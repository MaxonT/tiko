import { expect, test } from 'vitest'
import {
  clampShare,
  cutDashes,
  editedLabel,
  flatten,
  pointAt,
  shareRange,
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

test('a loop that runs under the label twice is cut twice', () => {
  // Out along y=0, back along y=10: both stretches pass under a label at the turn's middle.
  const poly = flatten('M0,0 L300,0 L300,10 L0,10')
  const dashes = cutDashes(poly, { x: 150, y: 5 }, { width: 40, height: 20 })!.split(' ')
  expect(dashes).toHaveLength(6)
  expect(dashes.map(Number).reduce((a, b) => a + b)).toBeCloseTo(poly.total, 5)
})
