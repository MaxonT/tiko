import { getBezierPath, Position } from '@xyflow/react'
import { expect, test } from 'vitest'
import { facingSides, localSide, turnedBezier, turnedBox, turnedEnd } from '@/canvas/TurnedEdge'

const numbers = (path: string) => path.match(/-?\d+(\.\d+)?/g)!.map(Number)

test('between upright elements the arrow is the same curve as before', () => {
  const [ours] = [
    turnedBezier({ x: 0, y: 0 }, Position.Right, 0, { x: 300, y: 80 }, Position.Left, 0),
  ]
  const [theirs] = getBezierPath({
    sourceX: 0,
    sourceY: 0,
    sourcePosition: Position.Right,
    targetX: 300,
    targetY: 80,
    targetPosition: Position.Left,
  })
  expect(numbers(ours)).toEqual(numbers(theirs))
})

test('an end on a turned element leaves along that element’s turned side', () => {
  // A left side turned a quarter clockwise faces up.
  const [, , c1x, c1y] = numbers(
    turnedBezier({ x: 0, y: 0 }, Position.Left, 90, { x: 0, y: -200 }, Position.Bottom, 0),
  )
  expect(c1x).toBeCloseTo(0)
  expect(c1y).toBeLessThan(0)
})

test('an arrow meets a turned element in the middle of its turned side', () => {
  const box = { x: 0, y: 0, width: 200, height: 100 }
  // Upright: the right side's middle.
  expect(turnedEnd(box, Position.Right, 0)).toEqual({ x: 200, y: 50 })
  // A quarter turn clockwise takes the right side to the bottom.
  const end = turnedEnd(box, Position.Right, 90)
  expect(end.x).toBeCloseTo(100)
  expect(end.y).toBeCloseTo(150)
  // A shape whose side sits inside its box.
  expect(turnedEnd(box, Position.Left, 0, 10)).toEqual({ x: 20, y: 50 })
})

test('an arrow without sides joins the sides that face each other', () => {
  const card = { x: 0, y: 0, width: 260, height: 40 }
  expect(facingSides({ x: -20, y: 160, width: 380, height: 180 }, card)).toEqual([
    Position.Top,
    Position.Bottom,
  ])
  expect(facingSides(card, { x: 400, y: 10, width: 200, height: 200 })).toEqual([
    Position.Right,
    Position.Left,
  ])
})

test('a turned element joins with the side that now faces the other one', () => {
  // Turned upside down, its left side faces right.
  expect(localSide(Position.Right, 180)).toBe(Position.Left)
  // A quarter turn clockwise points the right side down.
  expect(localSide(Position.Bottom, 90)).toBe(Position.Right)
  expect(localSide(Position.Top, 0)).toBe(Position.Top)
  const box = { x: 0, y: 0, width: 100, height: 100 }
  const end = turnedEnd(box, localSide(Position.Right, 180), 180)
  expect(end.x).toBeCloseTo(100)
  expect(end.y).toBeCloseTo(50)
})

test('a turned element keeps labels off all it covers, its corners included', () => {
  const node = (rotation: number) =>
    ({
      internals: { positionAbsolute: { x: 0, y: 0 } },
      measured: { width: 100, height: 100 },
      data: { rotation },
    }) as unknown as Parameters<typeof turnedBox>[0]
  expect(turnedBox(node(0))).toEqual({ x: 0, y: 0, width: 100, height: 100 })
  const turned = turnedBox(node(45))!
  expect(turned.width).toBeCloseTo(141.42, 1)
  expect(turned.x).toBeCloseTo(-20.71, 1)
  expect(turnedBox(undefined)).toBeNull()
})
