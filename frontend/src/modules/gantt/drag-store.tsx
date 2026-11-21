import { GripVertical } from 'lucide-react'
import { createContext, forwardRef, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { INDENT } from '@/modules/gantt/drag'
import type { Row } from '@/modules/gantt/rows'
import type { TreeRow } from '@/modules/gantt/tree'
import { cn } from '@/lib/utils'

// The ghost shows this many rows, then a count of the rest.
export const GHOST_ROWS = 5

export type Layout = {
  /** How far each row that stays is moved to close the lifted rows' place and open the gap. */
  shift: Map<string, number>
  /** Rows lifted into the ghost. */
  hidden: Set<string>
  /** The row the moved rows become children of. */
  parentId: string | null
  /** Rows glide to their places; off for the frame a drop lands in and under reduced motion. */
  animate: boolean
  placeholder: { top: number; height: number; depth: number; fits: boolean } | null
}

export type Ghost = { rows: TreeRow[]; startDepth: number; outside: boolean; count: number }

/**
 * What a row drag shows while the pointer moves, outside React state: the Gantt does not render
 * again on every move, only the small parts that read this.
 */
export class DragStore {
  layout: Layout | null = null
  ghost: Ghost | null = null
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  set(layout: Layout | null, ghost: Ghost | null = this.ghost) {
    this.layout = layout
    this.ghost = ghost
    this.listeners.forEach((listener) => listener())
  }
}

export const DragStoreContext = createContext<DragStore | null>(null)

const idle = () => () => {}

function useDrag<T>(read: (store: DragStore) => T, fallback: T) {
  const store = useContext(DragStoreContext)
  return useSyncExternalStore(store?.subscribe ?? idle, () => (store ? read(store) : fallback))
}

/** A row of one part of the Gantt (label, field cells, timeline), moved aside while rows drag. */
export function Shift({
  id,
  label,
  className,
  children,
}: {
  id: string
  /** The label part, which marks the row the dragged rows will nest under. */
  label?: boolean
  className?: string
  children: ReactNode
}) {
  // One string, so a row renders again only when its own place changes.
  const state = useDrag((store) => {
    const layout = store.layout
    if (!layout) return ''
    const parent = label && layout.parentId === id ? 'p' : ''
    return `${layout.shift.get(id) ?? 0}|${layout.hidden.has(id) ? 'h' : ''}|${layout.animate ? 'a' : ''}|${parent}`
  }, '')
  const [shift, hidden, animate, parent] = state.split('|')
  const y = Number(shift || 0)
  return (
    <div
      data-shift={id}
      className={cn(
        className,
        parent &&
          'relative before:bg-primary before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-0.5',
      )}
      style={
        state
          ? {
              transform: y ? `translateY(${y}px)` : undefined,
              transition: animate ? 'transform 150ms ease-out' : undefined,
              visibility: hidden ? 'hidden' : undefined,
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}

/** Where the dragged rows will land, at the level they will take. */
export function Placeholder() {
  const place = useDrag((store) => store.layout?.placeholder ?? null, null)
  const animate = useDrag((store) => Boolean(store.layout?.animate), false)
  if (!place) return null
  return (
    <div
      data-testid="gantt-drop-place"
      data-depth={place.depth}
      className={cn(
        'pointer-events-none absolute right-1 z-10 rounded-sm border border-dashed px-1 text-[12px]',
        place.fits
          ? 'bg-accent border-primary/40'
          : 'border-destructive text-destructive bg-destructive/5',
      )}
      style={{
        top: place.top + 2,
        height: place.height - 4,
        left: 4 + place.depth * INDENT,
        transition: animate ? 'left 100ms ease-out' : undefined,
      }}
    >
      {!place.fits && 'Too deep: 5 levels at most'}
    </div>
  )
}

/** The dragged rows under the pointer; the drag moves it by its style, not by rendering. */
export const DragGhost = forwardRef<
  HTMLDivElement,
  { labelOf: (row: Row) => string; height: number; width: number }
>(function DragGhost({ labelOf, height, width }, ref) {
  const ghost = useDrag((store) => store.ghost, null)
  if (!ghost) return null
  const extra = ghost.rows.length - GHOST_ROWS
  return (
    <div
      ref={ref}
      data-testid="gantt-drag-ghost"
      className="bg-card pointer-events-none absolute top-0 left-0 z-20 rounded-sm shadow-md will-change-transform"
      style={{ width }}
    >
      {ghost.rows.slice(0, GHOST_ROWS).map(({ row, depth }) => (
        <div
          key={row.id}
          className="flex items-center gap-1 border-b border-border/60 pr-1"
          style={{ height, paddingLeft: 4 + depth * INDENT }}
        >
          <GripVertical className="text-muted-foreground/60 size-3.5 shrink-0" />
          <span className="truncate">{labelOf(row)}</span>
        </div>
      ))}
      {extra > 0 && (
        <div className="text-muted-foreground px-2 py-1 text-[12px]">+ {extra} more</div>
      )}
      {ghost.outside && (
        <div className="text-muted-foreground px-2 py-1 text-[12px]">
          {ghost.count > 1 ? `${ghost.count} rows to the board` : 'Drop on the board'}
        </div>
      )}
    </div>
  )
})

/** Dependency lines point at the rows' old places while rows move, so they step aside. */
export function FadeWhileDragging({ children }: { children: ReactNode }) {
  const dragging = useDrag((store) => store.ghost !== null, false)
  return (
    <div className={cn('transition-opacity duration-100', dragging && 'opacity-0')}>{children}</div>
  )
}
