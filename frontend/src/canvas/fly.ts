import type { InternalNode, SetCenter, Viewport, XYPosition } from '@xyflow/react'
import { useSyncExternalStore } from 'react'

const FLASH_MS = 1200
// At least this zoom, so a 40px cube is easy to see after the move.
const MIN_ZOOM = 0.8
// A bigger element is zoomed out until it fits this share of the window.
const FIT_SHARE = 0.8

let flashing: string | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The node the board just moved to, for a short moment. */
export function useFlashingId() {
  return useSyncExternalStore(
    subscribe,
    () => flashing,
    () => null,
  )
}

/** True for a short moment after the board moved to this node. */
export function useFlashing(id: string) {
  return useFlashingId() === id
}

type Flow = {
  getInternalNode: (id: string) => InternalNode | undefined
  getEdge: (id: string) => { source: string; target: string } | undefined
  getZoom: () => number
  setCenter: SetCenter
}

export const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Zoom that shows the whole box at no less than `min`, unless it is too big for the window. */
export function zoomFor(width: number, height: number, current: number, min = MIN_ZOOM) {
  const fit = Math.min(
    (window.innerWidth * FIT_SHARE) / Math.max(width, 1),
    (window.innerHeight * FIT_SHARE) / Math.max(height, 1),
  )
  return Math.min(Math.max(current, min), fit)
}

// Where each drawn arrow label sits on the board, kept by the arrow that draws it.
const labelPoints = new Map<string, XYPosition>()

/** Notes where an arrow's label is drawn, or that it is gone. */
export function placeLabel(edgeId: string, at: XYPosition | null) {
  if (at) labelPoints.set(edgeId, at)
  else labelPoints.delete(edgeId)
}

// A node's box; an arrow's is its label's point when drawn, else the middle between its ends.
function boxOf(flow: Flow, id: string) {
  const edge = flow.getEdge(id)
  const label = edge && labelPoints.get(id)
  if (label) return { ...label, width: 0, height: 0 }
  const ids = edge ? [edge.source, edge.target] : [id]
  const boxes = ids.flatMap((one) => {
    const node = flow.getInternalNode(one)
    if (!node) return []
    const { x, y } = node.internals.positionAbsolute
    return [
      {
        x,
        y,
        width: node.measured.width ?? node.width ?? 0,
        height: node.measured.height ?? node.height ?? 0,
      },
    ]
  })
  if (boxes.length === 0) return null
  const left = Math.min(...boxes.map((b) => b.x))
  const top = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.width))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  return edge
    ? { x: (left + right) / 2, y: (top + bottom) / 2, width: 0, height: 0 }
    : { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Moves the board to a node or an arrow's label and flashes it; `flash: false` only looks.
 * `offsetY` puts it that many screen pixels below the window center.
 */
export function flyTo(
  flow: Flow,
  id: string,
  { flash = true, minZoom = MIN_ZOOM, offsetY = 0 } = {},
) {
  const box = boxOf(flow, id)
  if (!box) return
  const { x, y, width, height } = box
  const zoom = zoomFor(width, height, flow.getZoom(), minZoom)
  void flow.setCenter(x + width / 2, y + height / 2 - offsetY / zoom, {
    zoom,
    duration: reducedMotion() ? 0 : 400,
  })
  if (!flash) return
  flashing = id
  emit()
  setTimeout(() => {
    if (flashing !== id) return
    flashing = null
    emit()
  }, FLASH_MS)
}

// Views the board jumped away from, newest last, so "Back" can return to them.
const VIEW_HISTORY = 20
let views: Viewport[] = []
const viewListeners = new Set<() => void>()

function emitViews() {
  for (const listener of viewListeners) listener()
}

/** Remembers where the board was before a jump. */
export function rememberView(view: Viewport) {
  views = [...views.slice(1 - VIEW_HISTORY), view]
  emitViews()
}

/** The last view before a jump, taken off the list. */
export function takeView() {
  const view = views.at(-1)
  if (view) {
    views = views.slice(0, -1)
    emitViews()
  }
  return view
}

/** Each board starts with no way back: views of another board mean nothing here. */
export function forgetViews() {
  views = []
  emitViews()
}

/** True while there is a view to go back to. */
export function useCanGoBack() {
  return useSyncExternalStore(
    (listener) => {
      viewListeners.add(listener)
      return () => viewListeners.delete(listener)
    },
    () => views.length > 0,
    () => false,
  )
}
