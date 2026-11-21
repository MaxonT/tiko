import { useReactFlow, type XYPosition } from '@xyflow/react'
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LABEL_MAX, LABEL_WIDTH, editedLabel, farBar, type Size } from '@/canvas/edge-label'
import { LabelEditing } from '@/canvas/label-editing'
import { FarContext, useReadOnly } from '@/canvas/readonly'
import { fillCss, textPx } from '@/canvas/selection-props'
import type { AppEdge, EdgeLabel } from '@/canvas/types'

// Room the foreignObject gives the label; the label itself is centered in it and measured.
const ROOM_W = LABEL_WIDTH + 40
const ROOM_H = 1200

function labelLook(label: EdgeLabel | undefined): React.CSSProperties {
  const color = label?.color
  return {
    fontSize: textPx('shape', label?.size),
    lineHeight: 1.35,
    maxWidth: LABEL_WIDTH,
    padding: '2px 4px',
    borderRadius: 4,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    textAlign: 'center',
    color: color && color !== 'surface' ? 'var(--sticky-foreground)' : 'var(--foreground)',
    background: color ? fillCss(color) : undefined,
    boxShadow: color === 'surface' ? 'inset 0 0 0 1px var(--border)' : undefined,
  }
}

type Props = {
  edge: Pick<AppEdge, 'id' | 'selected'>
  label: EdgeLabel | undefined
  /** Where the label's middle sits on the arrow. */
  at: XYPosition
  /** The label's measured box, so the arrow places it and leaves its line out under it. */
  onSize: (size: Size) => void
  /** Set when the label can slide along its arrow. */
  drag?: { onPointerDown: (event: React.PointerEvent<HTMLElement>) => void; active: boolean }
}

/**
 * Words on an arrow, level, centered on `at`. Drawn inside the arrow's own SVG, so they stack
 * with it: an arrow between elements in a frame is lifted above the frame, and so is its label.
 */
export function ArrowLabel({ edge, label, at, onSize, drag }: Props) {
  const { editing, setEditing } = useContext(LabelEditing)
  const readOnly = useReadOnly()
  const far = useContext(FarContext)
  const { updateEdgeData } = useReactFlow<never, AppEdge>()
  const box = useRef<HTMLDivElement>(null)
  const isEditing = editing === edge.id && !readOnly && !far
  // Far out a label has no editor; editing ends instead of waiting to come back.
  useEffect(() => {
    if (far && editing === edge.id) setEditing(null)
  }, [far, editing, edge.id, setEditing])

  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => onSize({ width: element.offsetWidth, height: element.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [far, isEditing, onSize])

  if (!label && !isEditing) return null

  const finish = (typed: string) => {
    setEditing(null)
    const next = editedLabel(label, typed)
    if (next?.text !== label?.text) updateEdgeData(edge.id, { label: next })
  }

  return (
    <foreignObject
      x={at.x - ROOM_W / 2}
      y={at.y - ROOM_H / 2}
      width={ROOM_W}
      height={ROOM_H}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      <div className="flex h-full w-full items-center justify-center">
        {far ? (
          <div
            className="edge-label-bar"
            style={{
              ...farBar(label),
              borderRadius: 3,
              background: label?.color
                ? fillCss(label.color)
                : 'color-mix(in oklch, currentColor 25%, transparent)',
            }}
          />
        ) : isEditing ? (
          <LabelField boxRef={box} label={label} onDone={finish} />
        ) : (
          <div
            ref={box}
            data-testid="arrow-label"
            className={`edge-label nopan${edge.selected ? ' outline-primary outline-1' : ''}`}
            onPointerDown={drag?.onPointerDown}
            style={{
              ...labelLook(label),
              pointerEvents: readOnly ? 'none' : 'auto',
              cursor: drag ? (drag.active ? 'grabbing' : 'grab') : undefined,
              touchAction: drag ? 'none' : undefined,
            }}
          >
            {label?.text}
          </div>
        )}
      </div>
    </foreignObject>
  )
}

function LabelField({
  boxRef,
  label,
  onDone,
}: {
  boxRef: React.RefObject<HTMLDivElement | null>
  label: EdgeLabel | undefined
  onDone: (text: string) => void
}) {
  const [draft, setDraft] = useState(label?.text ?? '')
  const done = useRef(false)
  const latest = useRef({ draft, onDone, typed: false })
  useLayoutEffect(() => {
    latest.current = { draft, onDone, typed: draft !== (label?.text ?? '') }
  })
  // Zooming far out takes the field away without a blur: what was typed is kept all the same.
  useEffect(
    () => () => {
      const { draft: text, onDone: finish, typed } = latest.current
      if (!done.current && typed) finish(text)
    },
    [],
  )
  return (
    <div ref={boxRef} className="grid" style={{ ...labelLook(label), pointerEvents: 'auto' }}>
      {/* The hidden copy sizes the field to its text, wrapping at the label's width. */}
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {draft || 'Label'}{' '}
      </span>
      <textarea
        autoFocus
        rows={1}
        value={draft}
        maxLength={LABEL_MAX}
        placeholder="Label"
        aria-label="Arrow label"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          done.current = true
          onDone(draft)
        }}
        onKeyDown={(event) => {
          // The canvas must not take the keys: Enter would select, Delete would remove.
          event.stopPropagation()
          if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Escape') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        className="nodrag nopan nowheel col-start-1 row-start-1 resize-none overflow-hidden bg-transparent text-center outline-none placeholder:opacity-50"
        style={{ font: 'inherit', color: 'inherit', overflowWrap: 'anywhere' }}
      />
    </div>
  )
}
