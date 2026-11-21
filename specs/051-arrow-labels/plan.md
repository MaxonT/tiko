# Implementation Plan: Arrow labels

**Spec**: [spec.md](spec.md) | **Contract**: additions to [046's contract](../046-api-mcp/contracts/api-v1.md)

## Summary

An optional `data.label` on an edge: `{text, at?, color?, size?}`, absent when the arrow has no label. The label is placed on the drawn path by arc length, from a polyline the path is flattened into, in plain TypeScript, so it is unit-tested without a browser and works for any later path made of several segments. The line is cut under the label with an SVG mask. No migration; boards saved before read unchanged.

## Today

- `frontend/src/canvas/TurnedEdge.tsx`: the only edge type (`edgeTypes = { default: TurnedEdge }` in `Canvas.tsx:189`). Always one cubic bezier, `turnedBezier(...)`, between two element sides; a dangling arrow ends at an `anchor` node. `markerEnd` is `ArrowClosed` from `defaultEdgeOptions` (`Canvas.tsx:204`), not stored; no start head.
- An edge stores only `source`, `target`, `sourceHandle?`, `targetHandle?`: `Edge` in `backend/app/domain/boards.py:351` (`_Strict`, `extra="ignore"`), `StoredEdge`, `toDoc` and `storedEdge` in `frontend/src/live/doc.ts`, the edges map in `frontend/src/live/binding.ts`. In the Y doc an edge is one plain value, replaced whole (spec 009 data model).
- `binding.ts:153` takes a remote edge's ends over the local one; `push` writes `storedEdge(edge)`.
- Selection bar: `barNodes` (`selection-props.ts:28`) works on nodes only; arrows alone get no bar (spec 023 FR-001). Fill palettes and `TEXT_PX` per type live in `selection-props.ts`.
- `EditableText.tsx`: `Enter` and `Escape` blur in the one-line case, `Escape` in the multiline one; blur keeps the text.
- Search: `buildIndex(nodes, tasks)` in `frontend/src/search/index.ts`; `BoardSearch.tsx` selects and fits nodes; matches dim the rest through `hits` in `Canvas.tsx`.
- Far view: `FAR_ZOOM` in `Canvas.tsx:400`, blocks in `nodes/far.tsx`; arrows drawn as usual.
- API: `api_view.py` `_arrow` gives `id, kind, editable, from, to`; `batch.py:461` refuses any change of an arrow ("remove it and draw another").
- Transfer: `transfer.py` `FORMAT = 1`, validates `board.json` with `BoardDoc`; an older instance ignores unknown edge fields.

## Decisions

### Model

- Backend `EdgeLabel(_Strict)`: `text: str` (1..500 after strip), `at: absent_or(confloat(ge=0, le=1))`, `color: absent_or(ShapeColor)` (the shape's literal, `none` never stored), `size: absent_or(TextSize)`. `EdgeData(_Strict)`: `label: EdgeLabel | None = None`. `Edge.data: EdgeData | None = None`.
  - `data`, not a top-level `label`: xyflow's `Edge.label` is a `ReactNode` it may render itself, and later arrow styles (color, dashes) belong in the same `data`.
  - The frontend writes `at` rounded to 3 places and only when it is not 0.5; removes `color` for no fill and `size` for medium; removes `label` and then `data` when empty. An unlabeled arrow stores exactly what it stores today.
- Frontend: `AppEdge = Edge<{ label?: EdgeLabel }>` in `canvas/types.ts`; `StoredEdge.data?`; `toDoc`, `storedEdge`, the remote merge in `binding.ts:153` and `canon` carry `data`.
- `live.py` validates edges with the new model; an edge that fails it is dropped by the existing repair rule (`edge_dropped`), as any broken arrow is. The frontend never stores an empty label, so only a broken client can hit it.

### Geometry (`frontend/src/canvas/edge-label.ts`, pure)

- `flatten(path: string): Polyline`: parses `M`, `L`, `C` (what tiko draws now and what bent arrows will add) into points, a cubic as 48 steps, and a running length table. Memoised per path string in the edge view.
- `pointAt(poly, share)`: binary search on the length table, linear between points.
- `clampShare(poly, share, box, ends)`: the label's box (measured width and height, centered on the point, level) must keep clear of a 12px circle around each end and off the boxes of the two elements the arrow ties (added in slice 2: on a hook the circle alone let a label slide under its element). Walk inward from each end on the table to the first share where the box clears; if the two limits cross, the only place is 0.5.
- `project(poly, from, pointer, scale)`: hill-climb from the index of the current share in both directions while the distance to the pointer falls, stepping over dips shorter than 3 points; that is the local nearest point on the branch the label is on. Compute the global nearest too; take it only when the local one is more than 48 screen px from the pointer and the global one is under half of that. At a self-crossing both are near the pointer, so the label stays on its branch.
  - Rejected: `SVGPathElement.getPointAtLength` and `getTotalLength`. jsdom has no SVG geometry, so it could not be unit-tested, and it would need a DOM path for the far view and for future server-side use.
- `snap(share, poly, scale)`: within 8 screen px of the middle → 0.5.

### Rendering (`TurnedEdge.tsx`)

- With `data.label`: flatten the path, place the label at `clampShare(pointAt(at ?? 0.5))`, render the text in a `foreignObject` inside the edge's own `<g>` as a `div` with `nodrag nopan`, `pointer-events: all` for editors, `max-width: 240px`, `white-space: pre-wrap`, `overflow-wrap: anywhere`, padding 2×4, the size from the shape's `TEXT_PX`, `--foreground` text; with a fill, the sticky token background, `--sticky-foreground` text, radius 4px.
- The cut (changed in T004): `cutDashes` clips each polyline segment to the label box grown by 3px and turns the stretches under it into a `stroke-dasharray`, with `pathLength` set to the polyline's length so the dashes line up with the drawn curve. A loop that runs under the label twice is cut twice. The box comes from the label's measured size (a `ResizeObserver` on the label into the edge's state), so wrapping and size changes reflow the cut.
  - Rejected after trying it: an SVG `<mask>`. xyflow draws each edge in an `<svg>` of the default 300×150 with `overflow: visible`, and the mask is clipped to that box, so most of a line vanished.
- Selected arrow: the label gets a 1px `--primary` ring; `aria-label` on the edge is "Arrow: <text>".
- Far view: the same place, a bar `12px` tall, `min(textWidth, 240)` wide, radius 3, `currentColor` at 25% or the label's fill; no editor, no drag.

### Editing

- `onEdgeDoubleClick` in `Canvas.tsx` (not read-only, not far): add `{label: {text: ''}}` if missing and set `editingLabel = edge.id`. The label div swaps to a `textarea` built like `EditableText`'s multiline branch: `Enter` without Shift blurs, `Escape` blurs; blur commits trimmed text, empty removes the label. A double-click on the label div edits it.
- `Enter` on one selected edge and the bar's "Add label" call the same function.
- The text is written once, when editing finishes, through `updateEdgeData`, as `EditableText` writes a text node; one undo step.

### Drag

- `pointerdown` on the label (editor, not editing): capture the pointer; after 3 screen px of movement it becomes a drag, below that the `pointerup` selects the edge. During the drag the share is local state; `project`, `snap`, `clampShare` each frame. On `pointerup` one `setEdges` writes `at`, one undo step; others see the label move then.
- Not draggable when `clampShare` leaves only 0.5.

### Selection bar

- `barNodes` stays nodes only. A new branch when the selection is only edges: the type row "Arrow" / "N arrows" with a lucide `MoveRight`; Fill (`SHAPE_COLORS`) and Text size when every selected edge has a label; "Add label" (lucide `Type`) when exactly one is selected and it has none; Delete. Fill hover preview and one undo step per pick as for nodes.
- Mixed nodes and edges: unchanged, edges are ignored.

### Search

- `buildIndex` takes edges: an entry per labeled edge, kind `arrow`, text the label, context "Arrow". Opening it selects the edge and fits the label's point at no less than 50% zoom. `hits` keeps a matching edge at full opacity and rings its label.

### Transfer and preview

- Nothing new in `transfer.py`: `board.json` carries `data.label`. `preview.py` keeps drawing straight lines without labels.

### API (slice 1 reads, slice 3 writes)

- `api_view.py` `_arrow`: `label` = text or `""`; added to the `arrow` field tuple. OpenAPI and `api-v1.md` gain it.
- Slice 3: `ArrowIn.label: str | None` (≤ 500) on `POST /elements`; `Change.label` accepted only for an edge: `batch.py` `change()` lets an edge through when `given <= {"id", "label"}` and the edge is editable by the key's person (`not_api_element` otherwise), refusing anything else with today's message. Empty string removes the label. MCP `connect` gains `label?`; `update_elements` passes it.

## Risks

- One plain value per edge: someone editing a label while another reconnects the same arrow, last writer wins on the whole arrow. Rare; the same as two people changing one node's place.
- Stacking, checked in T004: `EdgeLabelRenderer` is one `div` between the edges and the nodes with no z-index, while xyflow lifts an edge between two elements inside a frame to the frame's z-index. A label there would sit under the frame while its arrow sits on top. So the label is a `foreignObject` inside the edge's own `<g>` and stacks with its arrow, dangling arrows (lifted to 1999) included.
- A label is one `foreignObject` and a dash pattern per arrow; nothing is drawn for arrows without one.
- An arrow that curls very tightly can put part of a level label over another stretch of the same arrow; the cut keeps the text readable, and the person can slide it.
