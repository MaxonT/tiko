# Implementation Plan: Mark Gantt rows and stages done

**Spec**: [spec.md](spec.md) | **Contract**: additions to [047's contract](../047-api-gantt/contracts/api-v1-gantt.md)

## Summary

Two optional booleans in the Gantt content, `Row.done` and `Stage.done`, absent when false. Everything else is derived on read: a task row's done from its status category, a leaf with stages from its stages, a parent's progress from its branch. No migration, no new storage.

## Today

- `backend/app/domain/modules/gantt.py`: `Row` and `Stage` with `extra="ignore"`; `GanttContent._rules` validates the tree, stages and links. Stages of a parent are kept but not drawn.
- `frontend/src/modules/gantt/schema.ts` mirrors it in zod.
- `GanttLabel.tsx:117` `done = task?.status_category === 'done'` strikes a task row's key; `GanttBar.tsx` has `BAR_COLOR.done` and `line-through` for task bars.
- `tree.ts`: `visibleRows`, `subtreeEnd`, `branchSpan` over rows in display order.
- `GanttStages.tsx`: stage bars and their menu with Planning on.
- `backend/app/domain/boards.py` `planned_stages(doc)` feeds `Planning.workload` (`planning.py:487`), which counts stages per week and overlaps.
- `backend/app/domain/api_gantt.py` `RowOut`, `StageOut`; absent fields are dropped by `_without_none`.

## Decisions

### Model

- `Row.done: bool | None = None`, `Stage.done: bool | None = None`, both in the backend model and zod. The frontend writes `true` or deletes the key, never `false`.
- `GanttContent._rules`: a row with `key` and `done` → `ValueError("row {id} takes done from its tracker")`.

### Derived state (`frontend/src/modules/gantt/done.ts`, mirrored in `api_gantt.py`)

- `leafDone(row, task, planning)`: with `key` → `task?.status_category === 'done'`; with Planning on and stages → every stage done (a task row with stages included, stages win over the tracker for the count, as Decision 4 says); else `row.done === true`.
- `progress(rows, index, tasks, planning)`: leaves of the branch from `subtreeEnd`, `{done, total}`.
- `tickLeaf(content, id, done)`: hand row → set or delete `done`; row with stages → set on every stage.

### UI

- `GanttLabel.tsx`: a `Checkbox` from `components/ui` left of the title on leaves; disabled with a tooltip on task rows; hidden for viewers, a static check icon instead. Parents: `done/total` after the title, `text-status-done` when equal.
- `GanttBar.tsx` and `GanttStages.tsx`: a `done` prop adds a hatch (`repeating-linear-gradient` from the bar's colour token, a utility in `index.css`) and `line-through`. Stage menu gains "Mark done" / "Mark not done"; a hover checkbox on the stage bar for editors.
- Changes go through the module's existing `onChange`, so Undo, live sync and transfer need nothing new.

### Workload

- `planned_stages` skips stages with `done`; `workload` then neither counts nor overlaps them.

### API

- `RowOut.done: bool | None` (true or absent), `RowOut.progress: Progress | None` on parents, `StageOut.done: bool | None`. Task status for `leafDone` comes from the snapshots the read already loads.
- OpenAPI snapshot updated; 047's contract gains the three fields.

## Risks

- A bar that is narrow at month scale shows little hatch; the struck title and the checkbox carry the meaning.
- A task row whose task cannot be read (`not_found`, `no_token`) counts as not done.
