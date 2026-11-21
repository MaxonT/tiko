# Implementation Plan: Smooth Gantt row drag and multi-row selection

**Spec**: [spec.md](spec.md) | **Contract**: none, frontend only; the stored Gantt content does not change.

## Summary

The drag moves from `GanttLabel` (one label with an offset) to a drag controller in the Gantt view that knows every visible row. The place and level are a pure function of the ghost's position over the plan, the same one the drop uses. Rows that stay are shifted with CSS transforms by a small per-row wrapper that reads the drag state from an external store, so the heavy row content (bars, stages, columns) does not re-render while the pointer moves. The drop is one call to a new `moveRows` in `tree.ts`, so it stays one `onChange`, one Undo step and one live write. No backend change, no new dependency.

## Today

- `GanttLabel.tsx`: `down`, `move`, `up` with pointer capture; `DRAG_SLOP = 4`, `INDENT = 16`; `onMove(rows, levels)` and `onEject(screen)`; the label translates itself.
- `GanttModule.tsx` `drop()` (line 323): index of the row among `visible`, its subtree from `subtreeEnd`, `rest = visible - moving`, `slot = at + rowsDown`, then `moveSubtree(content, id, rest[slot], depth + levels)`. `eject()` calls `host.ejectCard` or `host.ejectNote`, then `liftRemove`.
- Rows render in three places, each `visible.map` with fixed `height`: labels (`GanttModule.tsx:387`), field cells (`GanttColumns.tsx:67`), timeline rows (`GanttModule.tsx:497`). Links (`Links.tsx`) are placed from row indexes.
- `tree.ts`: `moveSubtree`, private `insertBlock` (clamps the level between the row below and one under the row above, refuses past `MAX_DEPTH = 5`), `subtreeEnd`, `visibleRows`, `liftRemove`. `filters.ts` `shownRows` filters `visibleRows`.
- `ModuleNode.tsx`: the module body is `nodrag nopan`. `Canvas.tsx`: `deleteKeyCode` Backspace and Delete (off while a module is expanded), `onBeforeDelete`, `multiSelectionKeyCode="Shift"`, `selectionOnDrag` for the Select tool.
- `ModuleExpanded.tsx`: Radix `Dialog`; `onEscapeKeyDown` keeps the view open only while typing; `[data-expanded-scroll]` is the scrolling element.
- `expanded.ts` `useZoom()`: screen to module pixels (board zoom, or 1 when expanded).
- Motion tooling: `lib/useFlip.ts` (150ms glide of rows by `offsetTop`), `lib/motion.ts` `useReducedMotion()`, Web Animations API. `package.json` has no drag library; `@xyflow/react` 12.12 gives `getViewport` and `setViewport` for panning.
- Undo: `Y.UndoManager` over nodes and edges with a 300ms capture (`useLiveBoard.ts`), so synchronous host calls plus one `onChange` land in one step, as the single eject does today.

## Decisions

### Pure logic

- `tree.ts`:
  - `export function levels(rows, beforeId, block)`: the `{ min, max }` level a block can take before `beforeId`, the clamp `insertBlock` applies today, pulled out so the placeholder and the drop share it. `max` is computed from the visible row above, not from a hidden descendant of a collapsed row (Today, 4).
  - `export function moveRows(content, ids, beforeId, depth)`: takes the top-most selected rows (drops ids that have a selected ancestor), cuts each subtree out in plan order, inserts them one after another before `beforeId` at `depth`, and opens the new parent when it is collapsed. Returns the same content when nothing fits. `moveSubtree` becomes `moveRows(content, [id], …)`; `indent` and `outdent` keep working through it.
- New `modules/gantt/drag.ts`:
  - `blockOf(content, visible, ids)`: moving row ids (selection plus subtrees), the visible ones in order, and the rows that stay (`rest`).
  - `dropTarget({ rest, rows, block, ghostTop, dx, startDepth, rowHeight })` → `{ slot, beforeId, depth, parentId, fits }`. Slot is `round(ghostTop / rowHeight)` clamped to `0…rest.length` (rows are all one height, so no DOM is measured); depth is `startDepth + round(dx / INDENT)` clamped by `levels`. Unit tested without React.

### Drag state and rendering

- `modules/gantt/drag-store.ts`: a tiny store (`subscribe`, `get`, `set`) per Gantt view, held in a ref and passed by context. State: `{ ids, visibleIds, slot, depth, fits, outside, gap }` or `null`. Pointer moves update the ghost position by writing `transform` to the ghost element directly in `requestAnimationFrame`; the store changes only when slot, depth, `fits` or `outside` change.
- `RowShift` wrapper (`useSyncExternalStore` on the store) around each row in the three `visible.map`s: returns `translateY` (0, `+gap`, or hidden for a lifted row, whose space is taken out by shifting the rows after it up). The wrappers re-render; their children are the same elements, so `GanttBar`, `GanttStages` and cells do not. `transition: transform 150ms ease-out` is set on the wrappers only while a drag or its settle runs, and never under `useReducedMotion()`.
- Lifting rows keeps the module's height: the rows after a lifted row move up by its height, the rows after the slot move down by the gap, with the ghost's height equal to the gap (up to 5 rows).
- Placeholder: one absolutely placed element per part, at `slot * rowHeight` below the rows top; in the label column its left is `4 + depth * INDENT`, with a 100ms `left` transition. The parent's bar is a class on the parent row's label wrapper from the same store.
- Ghost: rendered once in the label column, `pointer-events-none`, up to 5 `GanttLabel`s in a static mode, then "+ N more"; "Drop on the board" or "N rows to the board" when `outside`.
- Links: `Links` gets `dragging` and fades to 0 opacity in 100ms.
- Settle: on drop, `onChange(moveRows(...))` and the store keeps the gap for the next frame, then clears with the transition on, so the ghost meets rows already at their final places. Cancel clears with the transition on and no `onChange`.

### Pointer and keys

- `GanttLabel` loses its own drag: it reports `onPointerDown(row, event)` to the view and keeps its click actions. The view's controller (`useRowDrag` in `drag.ts` or beside it) owns capture, slop (4px), zoom (`useZoom`), the ghost, auto-scroll and the drop. Eject keeps the module bounding box test it has today.
- Auto-scroll: a `requestAnimationFrame` loop while the pointer is within 40px of the edge. Expanded: `scrollTop` of `[data-expanded-scroll]`, measured under the sticky header. Board: `setViewport({ ...getViewport(), y: y ± step })`, the module moves under a still pointer, so the target is recomputed each frame from the pointer and the module's new box. Step grows from 2 to 16px a frame closer to the edge.
- Esc: a `keydown` listener in the capture phase on `window`, added only while a drag or a selection exists, calls `preventDefault` and `stopPropagation`, so neither the expanded `Dialog` nor the board's Escape shortcut sees it. `pointercancel` and `window` `blur` cancel too.
- Remote changes: the target is derived from the store's pointer state and the current `content` on every render, so a remote edit reflows the gap; ids gone from `content` drop out of the drag, an empty drag cancels.

### Selection (slice 2)

- `selected: Set<string>` and `anchor` in the Gantt view's state (React state; changes are rare). Click rules in a pure `select(selection, anchor, id, visibleIds, { shift, toggle })`, unit tested. `toggle` is `metaKey` on macOS and `ctrlKey` elsewhere.
- Lasso: the label column gets a pointer handler for presses whose target is not inside a label's content (`[data-row-content]` on the grip, icon, key and title). It calls `stopPropagation`, draws a box with the board's selection tokens (`--xy-selection-background-color`, `--xy-selection-border`), clipped to the column, and selects rows whose strip the box touches, by arithmetic on `rowHeight` as in `dropTarget`. Shared auto-scroll with the drag.
- Pruning: an effect drops ids no longer in `visible`; the selection clears when `selected` (the module's board selection) turns false.
- Look: `data-selected` on the three row wrappers, `bg-primary/10`.
- Drag of a selection: the controller starts with `ids = selected` when the pressed row is in it, else selects the row alone.
- Eject of many: for each top-level selected row in plan order, `host.ejectCard` or `host.ejectNote` at `screen + (0, i * (step + 16px))`, step from the card or note height on the board at the current zoom; then one `onChange` with `liftRemove` applied for each id. Test that one Undo restores all.
- Delete: `ModuleHost` gains `claimDelete(id, handler | null)`. While rows are selected the Gantt registers a handler; `Canvas` `onBeforeDelete` calls it when the asked deletion is exactly that module node, then returns `false` so the node stays. The handler applies `liftRemove` for each selected row in one `onChange`. In the expanded view, where `deleteKeyCode` is off, the Gantt listens for Delete and Backspace itself while rows are selected and focus is not in a field.

### Files

| File | Change |
|---|---|
| `frontend/src/modules/gantt/tree.ts` | `levels`, `moveRows`; `moveSubtree` on top of it; open a collapsed new parent |
| `frontend/src/modules/gantt/drag.ts` (new) | `blockOf`, `dropTarget`, `select`, the drag controller hook |
| `frontend/src/modules/gantt/drag-store.ts` (new) | drag store and `RowShift` |
| `frontend/src/modules/gantt/GanttLabel.tsx` | press reported up, static ghost mode, `data-row-content`, selected look |
| `frontend/src/modules/gantt/GanttModule.tsx` | controller, wrappers around the three row lists, placeholder, ghost, lasso, selection, eject of many, Delete claim |
| `frontend/src/modules/gantt/GanttColumns.tsx` | rows wrapped in `RowShift`, selected look |
| `frontend/src/modules/gantt/Links.tsx` | `dragging` fade |
| `frontend/src/modules/types.ts`, `host-context.ts`, `canvas/Canvas.tsx` | `claimDelete` |
| `docs/guide/src/content/docs/gantt.mdx` | how to drag, select and move rows |
| `CHANGELOG.md` | one line per slice |

## Risks

- **Speed with 200 rows.** Three wrappers per row means up to 600 subscribers. They are cheap (a number compare and a style), and the store changes only when the slot or level changes, not per pointer move. If profiling disagrees, one CSS variable per part (`--gap-at`, `--gap`) with `calc` on `data-index` replaces the subscriptions.
- **Board pan and pointer capture.** Panning moves the module under a captured pointer; the target is recomputed from the module's live box each frame, not from the press position.
- **Links drawn from indexes** would detach during the shift; hiding them while dragging is the simple answer, kept until someone misses them.
- **Delete claim** touches `Canvas` for one module kind; the hook is generic (`claimDelete`) so another module can use it, and nothing else changes when no handler is set.
- **Expanded Esc** relies on the capture-phase listener running before Radix's `DismissableLayer`, which listens on `document`; a component test covers it.

## Deviations found while building

- `moveRows` places rows **after** a visible row (`aboveId`) instead of before one: the parent is then always the row above or one of its ancestors, never a row hidden in a collapsed branch or by a filter. `moveSubtree` stays as it was for the indent and outdent buttons.
- The store and its parts live in `drag-store.tsx` (`DragStore`, `Shift`, `Placeholder`, `DragGhost`, `FadeWhileDragging`); the controller is `useRowDrag.ts`. The placeholder is drawn in the task column only; in the field and timeline parts the gap is empty space.
- The gap is as tall as every lifted row, not capped at the 5 the ghost shows, so a drop never pushes rows after it lands.
- The controller binds its window listeners by hand, not through React state: a press no longer renders the whole Gantt again (a 200-row plan spent up to 125ms there).
- Speed, slice 1, on the local stack in headless Chromium with the GPU (Apple M3 Max), 200 rows with 12 stages each, a scripted 90-step drag in the expanded view: 60 fps at 1x, auto-scroll included (p95 17ms, one 50ms frame); with the CPU slowed four times 38 fps against 39 for the pointer moving over the plan without a drag. The long frames at 4x (up to 280ms) are the list scrolling at the edge: an existing scroll handler and a full repaint, the same as scrolling by hand.
- Slice 2, lasso: blank space is the label's own background (right of the title, the indent, the gaps of the hover buttons) and the column's band under the rows, not a `[data-row-content]` mark. The box uses `--primary` (dotted border, 10% fill): the board's `--xy-selection-*` variables do not reach the expanded view, which renders outside the board.
- Slice 2, Shift on the board: React Flow treats Shift (its selection key) as the start of its own box and swallows the press in the capture phase, so Shift-click and Shift-lasso never reached the Gantt. The task column carries `nokey`, which React Flow leaves alone, and stops Shift or Cmd clicks from toggling the module out of the board's selection. Both have regression tests.
- Slice 2, Delete: no `claimDelete` and no change to `Canvas.tsx`. While rows are selected the Gantt listens for Delete, Backspace and Esc on `window` in the capture phase and stops them there, before React Flow's delete key and the expanded view's Esc. The same listener serves the board and the expanded view.
- Slice 2, after a drop the moved rows are the selection; a drag from an unselected row selects it then, not at the start of the drag, so the Gantt does not render again when a drag begins.
- Checked by hand on the local stack (headless Chromium driving the board, welcome Gantt): click, Shift-click selects three, a lasso from blank space selects two with no board box, the selection drags as one, Backspace removes the rows and keeps the Gantt, one Undo brings them back.
- Slice 2, two browsers on one board: a selection of two rows dragged to the top in one shows in the same order in the other. A lasso over 46 rows of the 200-row plan, auto-scrolling, runs at 58 fps (p95 17ms); the one long frame (100ms) is the release, when the Gantt renders once with the new selection.
- After QA review: the Gantt acts on Delete, Backspace and Esc only when focus is on nothing or inside its own node or expanded view, never in a field, a menu, a popover or a dialog, and never from the board's copy while an expanded view is open. Picking rows tells every other Gantt in the tab to drop its selection, and a Shift or Cmd click in a Gantt the board has not selected selects it on the board, so one selection is live at a time. `nokey` sits on the whole task column, so a Shift-lasso from the band under the rows stays the Gantt's, and a clicked button or link in the column gives focus back so the board hears Shift and Delete again. The drop lands on the plan as it is once the ghost has glided, not as it was at release, and nothing lands after the Gantt is gone. Rows ejected together stand a card's or a note's height plus 16px apart. The list of rows is a `listbox` of options with `aria-selected`.
- Open finding for the owner: at the default column width (160px) the hover buttons of a row fill the room right of its title, so on the hovered row there is little blank space to start a lasso; the indent of a nested row and the band under the rows still work, and a wider column gives room. Shift and Cmd-click cover the rest. A follow-up could start the lasso some other way (for example Shift + drag from a row); not built, as it changes the approved Decision 13.
- After the bot review: rows that leave the view (a fold, a filter) leave the selection for good, with the anchor; a row someone else adds or removes mid-drag redraws the gap and keeps the pressed row under the pointer, and the drag ends if the pressed row goes; a drop place folded or removed while the ghost glides keeps the rows where they were.
