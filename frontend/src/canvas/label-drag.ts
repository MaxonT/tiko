import { useReactFlow } from '@xyflow/react'
import { useState } from 'react'
import {
  clampShare,
  project,
  shareRange,
  snapMiddle,
  tidyLabel,
  type Ends,
  type Polyline,
  type Size,
} from '@/canvas/edge-label'
import type { AppEdge, EdgeLabel } from '@/canvas/types'

// Screen pixels the pointer moves before a press on a label becomes a drag, not a click.
const DRAG_START = 3

/**
 * Sliding a label along its arrow: the share it is at while dragged, shown for this person
 * only, and written once on release as one undo step. A click without a move only selects.
 */
export function useLabelDrag(
  edgeId: string,
  label: EdgeLabel | undefined,
  poly: Polyline | null,
  box: Size,
  ends: Ends,
  enabled: boolean,
) {
  const { getZoom, screenToFlowPosition, updateEdgeData } = useReactFlow<never, AppEdge>()
  const [dragged, setDragged] = useState<number | null>(null)
  const draggable = enabled && !!label && !!poly && shareRange(poly, box, ends) !== null

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!draggable || !label || !poly || event.button !== 0) return
    const element = event.currentTarget
    const start = { x: event.clientX, y: event.clientY }
    let share = clampShare(poly, label.at ?? 0.5, box, ends)
    let moved = false
    element.setPointerCapture(event.pointerId)
    const move = (next: PointerEvent) => {
      if (!moved && Math.hypot(next.clientX - start.x, next.clientY - start.y) < DRAG_START) return
      moved = true
      const zoom = getZoom()
      const pointer = screenToFlowPosition({ x: next.clientX, y: next.clientY })
      share = clampShare(
        poly,
        snapMiddle(poly, project(poly, share, pointer, zoom), zoom),
        box,
        ends,
      )
      setDragged(share)
    }
    const end = (commit: boolean) => () => {
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', up)
      element.removeEventListener('pointercancel', cancel)
      setDragged(null)
      if (commit && moved) updateEdgeData(edgeId, { label: tidyLabel({ ...label, at: share }) })
    }
    const up = end(true)
    const cancel = end(false)
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', up)
    element.addEventListener('pointercancel', cancel)
  }

  return { dragged, draggable, onPointerDown }
}
