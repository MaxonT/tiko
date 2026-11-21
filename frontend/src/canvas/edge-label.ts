import type { XYPosition } from '@xyflow/react'
import type { AppEdge, EdgeLabel, SHAPE_COLORS } from '@/canvas/types'

/** A path as points with the running length at each, so a share of the length maps to a point. */
export type Polyline = { points: XYPosition[]; lengths: number[]; total: number }
export type Size = { width: number; height: number }

export const LABEL_MAX = 500
export const LABEL_WIDTH = 240
// Kept clear around both ends of an arrow: its head and the side of the element it is tied to.
const END_CLEAR = 12
const CUBIC_STEPS = 48

const FAR_BAR = 12

/** The bar a label is far out: about as wide as its text would be. */
export const farBar = (label: EdgeLabel | undefined): Size => ({
  width: Math.min(LABEL_WIDTH, Math.max(24, (label?.text.length ?? 0) * 7)),
  height: FAR_BAR,
})

/** M, L and C commands in absolute coordinates: what tiko draws, and what a bent arrow adds. */
export function flatten(path: string): Polyline {
  const numbers = (path.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
  const commands = path.match(/[MLC]/gi) ?? []
  const points: XYPosition[] = []
  let at = 0
  for (const command of commands) {
    const take = () => ({ x: numbers[at++], y: numbers[at++] })
    const kind = command.toUpperCase()
    if (kind === 'M' || kind === 'L') {
      points.push(take())
    } else if (kind === 'C') {
      const p0 = points[points.length - 1] ?? { x: 0, y: 0 }
      const [p1, p2, p3] = [take(), take(), take()]
      for (let i = 1; i <= CUBIC_STEPS; i++) {
        const t = i / CUBIC_STEPS
        const u = 1 - t
        const a = u * u * u
        const b = 3 * u * u * t
        const c = 3 * u * t * t
        const d = t * t * t
        points.push({
          x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
          y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
        })
      }
    }
  }
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - prev.x, points[i].y - prev.y))
  }
  return { points, lengths, total: lengths[lengths.length - 1] ?? 0 }
}

/** The point at a distance along the path, and the index of the segment it is on. */
export function pointAtLength(poly: Polyline, distance: number): XYPosition & { index: number } {
  const { points, lengths, total } = poly
  if (points.length < 2) return { ...(points[0] ?? { x: 0, y: 0 }), index: 0 }
  const d = Math.max(0, Math.min(total, distance))
  let lo = 0
  let hi = lengths.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (lengths[mid] <= d) lo = mid
    else hi = mid
  }
  const span = lengths[hi] - lengths[lo]
  const k = span > 0 ? (d - lengths[lo]) / span : 0
  return {
    x: points[lo].x + (points[hi].x - points[lo].x) * k,
    y: points[lo].y + (points[hi].y - points[lo].y) * k,
    index: lo,
  }
}

export const pointAt = (poly: Polyline, share: number) => pointAtLength(poly, share * poly.total)

// Whether a level box centered on `center` keeps clear of a circle around `end`.
function clearOf(center: XYPosition, size: Size, end: XYPosition, radius: number) {
  const dx = Math.max(Math.abs(end.x - center.x) - size.width / 2, 0)
  const dy = Math.max(Math.abs(end.y - center.y) - size.height / 2, 0)
  return dx * dx + dy * dy >= radius * radius
}

/** The shares a label of this size can take: off both ends; null when only the middle fits. */
export function shareRange(poly: Polyline, size: Size): [number, number] | null {
  const { points, total } = poly
  if (points.length < 2 || total <= 0) return null
  const start = points[0]
  const end = points[points.length - 1]
  const step = Math.max(total / 400, 1)
  let lo = 0
  while (lo <= total && !clearOf(pointAtLength(poly, lo), size, start, END_CLEAR)) lo += step
  let hi = total
  while (hi >= 0 && !clearOf(pointAtLength(poly, hi), size, end, END_CLEAR)) hi -= step
  return lo < hi ? [lo / total, hi / total] : null
}

/** The share a label is drawn at: its own, pulled in off the ends, or the middle when nothing fits. */
export function clampShare(poly: Polyline, share: number, size: Size): number {
  const range = shareRange(poly, size)
  if (!range) return 0.5
  return Math.max(range[0], Math.min(range[1], share))
}

type Rect = { left: number; right: number; top: number; bottom: number }

// The part of the segment inside the box, as shares of the segment (Liang-Barsky).
function clip(p: XYPosition, q: XYPosition, box: Rect): [number, number] | null {
  const dx = q.x - p.x
  const dy = q.y - p.y
  let t0 = 0
  let t1 = 1
  for (const [step, room] of [
    [-dx, p.x - box.left],
    [dx, box.right - p.x],
    [-dy, p.y - box.top],
    [dy, box.bottom - p.y],
  ]) {
    if (step === 0) {
      if (room < 0) return null
      continue
    }
    const t = room / step
    if (step < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return null
  }
  return t1 > t0 ? [t0, t1] : null
}

/**
 * A dash pattern, in the polyline's own length, that leaves the line out where it runs under
 * the label's box grown by `gap`; every stretch under it, so a loop through the label is cut too.
 * Used with `pathLength` set to the polyline's length. Null when the line never meets the box.
 */
export function cutDashes(poly: Polyline, center: XYPosition, size: Size, gap = 3): string | null {
  const { points, lengths, total } = poly
  if (points.length < 2 || size.width <= 0 || total <= 0) return null
  const box = {
    left: center.x - size.width / 2 - gap,
    right: center.x + size.width / 2 + gap,
    top: center.y - size.height / 2 - gap,
    bottom: center.y + size.height / 2 + gap,
  }
  const cuts: [number, number][] = []
  for (let i = 1; i < points.length; i++) {
    const part = clip(points[i - 1], points[i], box)
    if (!part) continue
    const span = lengths[i] - lengths[i - 1]
    const start = lengths[i - 1] + part[0] * span
    const end = lengths[i - 1] + part[1] * span
    const last = cuts[cuts.length - 1]
    // Pieces that touch are one stretch under the label.
    if (last && start - last[1] < 1e-6) last[1] = end
    else cuts.push([start, end])
  }
  if (cuts.length === 0) return null
  const dashes: number[] = []
  let at = 0
  for (const [start, end] of cuts) {
    dashes.push(start - at, end - start)
    at = end
  }
  dashes.push(total - at, 0)
  return dashes.map((n) => Math.round(n * 100) / 100).join(' ')
}

/** A label as stored: the middle, no fill and medium leave their fields out. */
export function tidyLabel(label: EdgeLabel): EdgeLabel {
  const { text, at, color, size } = label
  return {
    text,
    ...(at !== undefined && Math.abs(at - 0.5) > 0.0005 && { at: Math.round(at * 1000) / 1000 }),
    ...(color && { color }),
    ...(size && size !== 'medium' && { size }),
  }
}

type LabelStyle = { color?: (typeof SHAPE_COLORS)[number]; size?: EdgeLabel['size'] }

/** A label with a fill or a size from the selection bar; no fill takes the fill away. */
export function styledLabel(label: EdgeLabel, { color, size }: LabelStyle): EdgeLabel {
  const next = { ...label, ...(size && { size }) }
  if (color === 'none') delete next.color
  else if (color) next.color = color
  return tidyLabel(next)
}

/** An arrow with its label styled, or the arrow itself when it has no label. */
export function withLabelStyle(edge: AppEdge, style: LabelStyle): AppEdge {
  const label = edge.data?.label
  return label ? { ...edge, data: { ...edge.data, label: styledLabel(label, style) } } : edge
}

/** Typed words become the label; nothing but spaces removes it. */
export function editedLabel(label: EdgeLabel | undefined, typed: string): EdgeLabel | undefined {
  const text = typed.slice(0, LABEL_MAX)
  if (!text.trim()) return undefined
  return tidyLabel({ ...label, text })
}
