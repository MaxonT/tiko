import { BaseEdge, Position, useInternalNode, type EdgeProps, type XYPosition } from '@xyflow/react'
import { memo, useCallback, useContext, useMemo, useState } from 'react'
import { ArrowLabel } from '@/canvas/EdgeLabel'
import {
  clampShare,
  cutDashes,
  farBar,
  flatten,
  pointAt,
  type Ends,
  type Size,
} from '@/canvas/edge-label'
import { LabelEditing } from '@/canvas/label-editing'
import { useLabelDrag } from '@/canvas/label-drag'
import { FarContext, useReadOnly } from '@/canvas/readonly'
import { turnVector } from '@/canvas/turn'
import { sideInset, type ShapeKind } from '@/canvas/shapes'
import type { EdgeData, Turned } from '@/canvas/types'

const OUT: Record<Position, XYPosition> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
}

// React Flow's own bezier offset, so an arrow between upright elements keeps its shape.
const offset = (distance: number) =>
  distance >= 0 ? 0.5 * distance : 0.25 * 25 * Math.sqrt(-distance)

function control(from: XYPosition, to: XYPosition, side: Position, deg: number): XYPosition {
  const out = turnVector(OUT[side], deg)
  const reach = offset((to.x - from.x) * out.x + (to.y - from.y) * out.y)
  // Rounded: a turned side gives values like 6e-17 that read badly in a path.
  const round = (n: number) => Math.round(n * 100) / 100
  return { x: round(from.x + out.x * reach), y: round(from.y + out.y * reach) }
}

/** A bezier that leaves each end square to its side, turned with the element it is tied to. */
export function turnedBezier(
  source: XYPosition,
  sourceSide: Position,
  sourceTurn: number,
  target: XYPosition,
  targetSide: Position,
  targetTurn: number,
): string {
  const c1 = control(source, target, sourceSide, sourceTurn)
  const c2 = control(target, source, targetSide, targetTurn)
  return `M${source.x},${source.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${target.x},${target.y}`
}

type Box = { x: number; y: number; width: number; height: number }

const SIDE_OF: Record<string, Position> = {
  t: Position.Top,
  r: Position.Right,
  b: Position.Bottom,
  l: Position.Left,
}

/**
 * Where an arrow meets a turned element: the middle of its side, turned around the center.
 * Worked out from the element itself, so the arrow moves in the same frame as the element.
 */
export function turnedEnd(box: Box, side: Position, deg: number, inset = 0): XYPosition {
  const half = { x: box.width / 2, y: box.height / 2 }
  const local = {
    [Position.Top]: { x: 0, y: -half.y },
    [Position.Bottom]: { x: 0, y: half.y },
    [Position.Left]: { x: -half.x + (box.width * inset) / 100, y: 0 },
    [Position.Right]: { x: half.x - (box.width * inset) / 100, y: 0 },
  }[side]
  const turned = turnVector(local, deg)
  return { x: box.x + half.x + turned.x, y: box.y + half.y + turned.y }
}

type Internal = ReturnType<typeof useInternalNode>

/**
 * The sides of two boxes that face each other: an arrow made through the API names no sides,
 * and React Flow would tie both of its ends to the first one, the top.
 */
export function facingSides(a: Box, b: Box): [Position, Position] {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2)
  const dy = b.y + b.height / 2 - (a.y + a.height / 2)
  const gapX = Math.abs(dx) - (a.width + b.width) / 2
  const gapY = Math.abs(dy) - (a.height + b.height) / 2
  if (gapX > gapY) return dx > 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right]
  return dy > 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom]
}

/** The side of an element turned by `deg` that faces `world` on the board. */
export function localSide(world: Position, deg: number): Position {
  if (!deg) return world
  const want = OUT[world]
  const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left]
  const facing = (side: Position) => {
    const v = turnVector(OUT[side], deg)
    return v.x * want.x + v.y * want.y
  }
  return sides.reduce((best, side) => (facing(side) > facing(best) ? side : best))
}

const boxOf = (node: NonNullable<Internal>): Box => ({
  ...node.internals.positionAbsolute,
  width: node.measured.width ?? 0,
  height: node.measured.height ?? 0,
})

function end(
  node: Internal,
  handle: string | null | undefined,
  at: XYPosition,
  side: Position,
  facing?: Position,
) {
  const deg = (node?.data as Turned | undefined)?.rotation ?? 0
  if (!node || !(facing || (deg && handle && SIDE_OF[handle]))) return { at, deg, side }
  const data = node.data as { shape?: ShapeKind }
  const inset = node.type === 'shape' && data.shape ? sideInset(data.shape) : 0
  const used = facing ? localSide(facing, deg) : side
  return { at: turnedEnd(boxOf(node), used, deg, inset), deg, side: used }
}

function TurnedEdgeView(props: EdgeProps) {
  const label = (props.data as EdgeData | undefined)?.label
  const { editing } = useContext(LabelEditing)
  const far = useContext(FarContext)
  const readOnly = useReadOnly()
  const labelled = !!label || editing === props.id
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const onSize = useCallback(
    (next: Size) =>
      setSize((was) => (was.width === next.width && was.height === next.height ? was : next)),
    [],
  )
  const from = useInternalNode(props.source)
  const to = useInternalNode(props.target)
  const facing =
    !props.sourceHandleId && !props.targetHandleId && from && to
      ? facingSides(boxOf(from), boxOf(to))
      : undefined
  const source = end(
    from,
    props.sourceHandleId,
    { x: props.sourceX, y: props.sourceY },
    props.sourcePosition,
    facing?.[0],
  )
  const target = end(
    to,
    props.targetHandleId,
    { x: props.targetX, y: props.targetY },
    props.targetPosition,
    facing?.[1],
  )
  const path = turnedBezier(source.at, source.side, source.deg, target.at, target.side, target.deg)
  const poly = useMemo(() => (labelled ? flatten(path) : null), [labelled, path])
  const box = far ? farBar(label) : size
  // A label never slides under the elements its arrow ties together.
  const ends: Ends = [from ? boxOf(from) : null, to ? boxOf(to) : null]
  const drag = useLabelDrag(
    props.id,
    label,
    poly,
    box,
    ends,
    !readOnly && !far && editing !== props.id,
  )
  const at = poly && pointAt(poly, clampShare(poly, drag.dragged ?? label?.at ?? 0.5, box, ends))
  // Dashes leave the line out under the label; a mask would be clipped to the arrow's SVG box.
  const dashes = poly && at && cutDashes(poly, at, box)
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        style={dashes ? { ...props.style, strokeDasharray: dashes } : props.style}
        pathLength={dashes && poly ? poly.total : undefined}
        interactionWidth={props.interactionWidth}
      />
      {at && (
        <ArrowLabel
          edge={props}
          label={label}
          at={at}
          onSize={onSize}
          drag={
            drag.draggable
              ? { onPointerDown: drag.onPointerDown, active: drag.dragged !== null }
              : undefined
          }
        />
      )}
    </>
  )
}

export const TurnedEdge = memo(TurnedEdgeView)
