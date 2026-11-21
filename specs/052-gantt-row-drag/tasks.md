# Tasks: Smooth Gantt row drag and multi-row selection

## Slice 1: `gantt-row-drag` (one row and its branch)

- [x] T001 `tree.ts`: `levels` pulled out of `insertBlock`, max from the visible row above; `moveRows` for one id with `moveSubtree` on top of it; a collapsed new parent opens; unit tests (existing `tree.test.ts` stays green)
- [x] T002 `drag.ts`: `blockOf` and `dropTarget` (slot by half a row, level clamped, `fits`, filters, collapsed rows); unit tests
- [x] T003 `drag-store.ts` and `RowShift`; wrap the label, field and timeline row lists; lifted rows close up, the gap opens; transitions only while dragging and never under reduced motion; component test that rows in all three parts move
- [x] T004 Drag controller: `GanttLabel` reports the press; capture, slop, zoom, ghost (up to 5 labels, "+ N more"), placeholder with level and parent bar, "Too deep" state, links fade; drop through `moveRows` with the settle; component tests: drop lands where shown, one Undo step
- [x] T005 Out of the module: gap closes, "Drop on the board", eject as today; expanded drop outside puts rows back; tests
- [x] T006 Auto-scroll in the expanded view and board pan near the window edge; tests with a mocked scroller and viewport
- [x] T007 Esc, `pointercancel` and window blur cancel with nothing written; Esc in the expanded view does not close it mid-drag; tests
- [x] T008 Remote change during a drag: the gap follows, deleted rows drop out, an empty drag ends; test
- [x] T009 By hand: 200 rows with stages (12, the most the content limit takes), Planning on, frame times at 1x and 4x in plan.md; light theme; bundle size not measured
- [x] T010 Guide `gantt.mdx` (drag rows, levels, Esc), CHANGELOG line

## Slice 2: `gantt-row-select` (select and move many)

- [ ] T011 `select()` for click, Cmd or Ctrl-click and Shift-click; unit tests
- [ ] T012 Selection state in the view, `data-selected` look on the three parts, pruning on filter, collapse and remote delete, clearing on Esc, blank click and module deselect; component tests
- [ ] T013 Lasso from blank space in the task column: box with the board's tokens, rows touched are selected, Shift or Cmd adds, auto-scroll and pan shared with the drag, press does not reach the board; tests
- [ ] T014 `moveRows` for many ids: top-most only, plan order, one level, depth limit for the deepest branch; unit tests
- [ ] T015 Drag of a selection: ghost and gap for the batch, drag from an unselected row selects it alone; component tests with a parent, its selected child, a lone child and gaps; one Undo step
- [ ] T016 Several rows to the board: cards and notes in a column, "N rows to the board", one Undo restores all; test
- [ ] T017 Delete and Backspace remove the selected rows: `claimDelete` in the host and `Canvas` `onBeforeDelete`, own listener in the expanded view; tests that the module stays
- [ ] T018 By hand: two browsers on one board, a selection dragged in one shows in the other; speed check of a lasso over 200 rows
- [ ] T019 Guide `gantt.mdx` (select rows, move several, Delete), CHANGELOG line
