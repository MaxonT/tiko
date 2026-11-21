import { useReactFlow } from '@xyflow/react'
import { useMemo, useState } from 'react'
import { withLabelStyle } from '@/canvas/edge-label'
import { barNodes, type Style } from '@/canvas/selection-props'
import type { AppEdge, AppNode } from '@/canvas/types'
import { useShortcut } from '@/lib/shortcuts'

type LabelStyle = Pick<Style, 'color' | 'size'>

/** Arrows as drawn: a label tried from the arrow bar, named for screen readers, ringed by search. */
export function labelled(
  edges: AppEdge[],
  preview: LabelStyle | null,
  hits: ReadonlySet<string> | null,
): AppEdge[] {
  if (!edges.some((e) => e.data?.label)) return edges
  return edges.map((e) => {
    const label = e.data?.label
    if (!label) return e
    const tried = preview && e.selected ? withLabelStyle(e, preview) : e
    const hit = hits?.has(e.id)
    return {
      ...tried,
      ariaLabel: `Arrow: ${label.text}`,
      ...(hit && { className: [e.className, 'search-hit'].filter(Boolean).join(' ') }),
    }
  })
}

type Options = {
  edges: AppEdge[]
  setEdges: (update: (current: AppEdge[]) => AppEdge[]) => void
  hits: ReadonlySet<string> | null
  readOnly: boolean
  far: boolean
}

/**
 * Everything the board does for arrow labels: which label is being edited, the look the arrow
 * bar tries before a pick, the bar's picks, the Enter shortcut and the arrows as drawn.
 */
export function useArrowLabels({ edges, setEdges, hits, readOnly, far }: Options) {
  const flow = useReactFlow<AppNode, AppEdge>()
  const [editing, setEditing] = useState<string | null>(null)
  // Only the arrow bar sets it, so a style tried on other elements never shows on a label.
  const [preview, setPreview] = useState<LabelStyle | null>(null)
  const editingValue = useMemo(() => ({ editing, setEditing }), [editing])
  // Rebuilt only when arrows, the tried look or search change, not on every frame of a drag.
  const shown = useMemo(() => labelled(edges, preview, hits), [edges, preview, hits])

  useShortcut(
    'labelArrow',
    () => {
      const picked = flow.getEdges().filter((e) => e.selected)
      if (picked.length === 1 && barNodes(flow.getNodes()).length === 0) setEditing(picked[0].id)
    },
    { enabled: !readOnly && !far },
  )

  return {
    editingValue,
    shown,
    /** A double-click on an arrow starts its label. */
    edit: (id: string) => !readOnly && setEditing(id),
    /** What the arrow bar needs for the selected arrows. */
    bar: (selected: AppEdge[]) => ({
      onStyle: (style: LabelStyle) =>
        setEdges((current) => current.map((e) => (e.selected ? withLabelStyle(e, style) : e))),
      onPreview: setPreview,
      onAddLabel:
        selected.length === 1 && !selected[0].data?.label
          ? () => setEditing(selected[0].id)
          : undefined,
    }),
  }
}
