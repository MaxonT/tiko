# Tasks: Arrow labels

## Slice 1: `arrow-labels` (labels in the middle)

- [x] T001 `EdgeLabel`, `EdgeData`, `Edge.data` in `backend/app/domain/boards.py`; `live.py` repair; domain tests: with and without a label, limits, old boards unchanged, transfer round trip
- [x] T002 Frontend model: `AppEdge` data, `StoredEdge`, `toDoc`, `storedEdge`, remote merge and `canon` in `binding.ts`; clipboard, duplicate and Alt-drag copy keep the label; unit tests
- [x] T003 `frontend/src/canvas/edge-label.ts`: `flatten`, `pointAt`, `clampShare`; unit tests on straight, hooked, S-shaped and self-crossing paths, and a label wider than its arrow
- [x] T004 Label in `TurnedEdge.tsx`: level text, wrap at 240, sizes, fill chip, mask cut from the measured box, selected ring, `aria-label`; check stacking below nodes first (plan Risks); component tests
- [x] T005 Editing: double-click, `Enter` on a selected arrow, textarea with `Enter`, `Shift+Enter`, `Esc`, empty removes; Undo; view-only and public link show no editor; component tests
- [x] T006 Selection bar for arrows: type row, Fill, Text size, "Add label", Delete; one undo step per pick; component tests
- [x] T007 Search entry for labels, jump to the label, search ring; far view bar; tests
- [x] T008 API v1 read `label` on arrows; API test, OpenAPI snapshot, 046 contract
- [x] T009 `make smoke` saves and reopens a board with a labeled arrow
- [x] T010 Guide On the board (labels, older tiko drops them on import in Moving boards), CHANGELOG; by hand: arrows of every shape, light and dark, near and far, screenshots in the PR

## Slice 2: `arrow-label-drag` (slide along the arrow)

- [ ] T011 `project` and `snap` in `edge-label.ts`; unit tests: stays on its branch through a crossing, moves to another part only when clearly closer, snap to the middle
- [ ] T012 Drag on the label: 3px threshold, click selects, local share while dragging, one write and one undo step on release; not draggable when only the middle fits; component tests
- [ ] T013 Guide, CHANGELOG; by hand on hooked and self-crossing arrows, screenshots in the PR

## Slice 3: `arrow-label-api` (agents write labels)

- [ ] T014 `POST /elements` arrow `label`; `PATCH` `label` on the key's person's arrows, other arrow changes still refused; MCP `connect` and `update_elements`; API tests, contract `api-v1.md` and `openapi-v1.json`
- [ ] T015 Guide API reference, CHANGELOG
