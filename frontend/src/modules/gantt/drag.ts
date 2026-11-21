import { MAX_DEPTH, type TreeRow } from '@/modules/gantt/tree'

// One tree level, in label pixels and in drag distance.
export const INDENT = 16

export type DropTarget = {
  /** Gap index among the rows that stay. */
  slot: number
  /** The row the moved rows land after; null for the top. */
  aboveId: string | null
  depth: number
  /** The row they become children of. */
  parentId: string | null
  /** False when no depth keeps the tree within its levels. */
  fits: boolean
}

/**
 * Where moving rows land: the gap nearest the ghost's top edge among the rows that stay, at the
 * depth the sideways distance asks for, clamped to what the rows around the gap allow.
 */
export function dropTarget({
  rest,
  ghostTop,
  rowHeight,
  dx,
  startDepth,
  deepest,
}: {
  rest: TreeRow[]
  /** The ghost's top below the first row, in module pixels. */
  ghostTop: number
  rowHeight: number
  dx: number
  startDepth: number
  /** How many levels the moving rows reach below their top rows. */
  deepest: number
}): DropTarget {
  const slot = Math.min(Math.max(Math.round(ghostTop / rowHeight), 0), rest.length)
  const above = rest[slot - 1]
  const below = rest[slot]
  const min = below ? below.depth : 0
  const max = Math.min(above ? above.depth + 1 : 0, MAX_DEPTH - 1 - deepest)
  const fits = max >= min
  const asked = startDepth + Math.round(dx / INDENT)
  const depth = fits ? Math.min(Math.max(asked, min), max) : min
  let parentId: string | null = null
  if (depth > 0) {
    for (let i = slot - 1; i >= 0; i--) {
      if (rest[i].depth === depth - 1) {
        parentId = rest[i].row.id
        break
      }
    }
  }
  return { slot, aboveId: above?.row.id ?? null, depth, parentId, fits }
}

/** A click on a row: alone, toggled with Cmd or Ctrl, or a span from the anchor with Shift. */
export function select(
  selected: ReadonlySet<string>,
  anchor: string | null,
  id: string,
  order: string[],
  keys: { shift: boolean; toggle: boolean },
): { selected: Set<string>; anchor: string } {
  if (keys.shift && anchor !== null && order.includes(anchor)) {
    const [from, to] = [order.indexOf(anchor), order.indexOf(id)].sort((a, b) => a - b)
    const span = order.slice(from, to + 1)
    return { selected: new Set(keys.toggle ? [...selected, ...span] : span), anchor }
  }
  if (keys.toggle) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { selected: next, anchor: id }
  }
  return { selected: new Set([id]), anchor: id }
}
