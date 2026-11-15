# Tasks: Mark Gantt rows and stages done

## Slice 1: `gantt-done` (rows)

- [x] T001 `Row.done` in `backend/app/domain/modules/gantt.py` and `frontend/src/modules/gantt/schema.ts`; refused with a `key`; domain tests
- [x] T002 `frontend/src/modules/gantt/done.ts`: `leafDone`, `progress`, `tickLeaf` for rows; unit tests
- [x] T003 Label checkbox: hand rows tick, task rows read-only with tooltip, viewers see a static mark; parent `done/total`; component tests with Undo
- [x] T004 Done look: hatch utility in `index.css`, `line-through`, on `GanttBar` and on the stage bar of a leaf without stages in Planning; tests
- [x] T004a Seed a few done rows in the welcome board's Gantt and the demo sample plan
- [x] T005 API read: `done` on rows, `progress` on parents; API tests, OpenAPI snapshot, 047 contract
- [x] T006 Guide `gantt.md`, CHANGELOG line
- [x] T007 By hand: showcase roadmap with done marks on the local stack, screenshot in the PR

## Slice 2: `gantt-stage-done` (stages)

- [x] T008 `Stage.done` in both models; domain tests
- [x] T009 `leafDone` and `tickLeaf` for stages; unit tests
- [x] T009a A hand row with stages keeps `done` equal to every stage done on each change; split and merge of stages keep `done`; unit tests
- [x] T009b No time off warning on a done stage
- [x] T010 "Done" in the stage popover, hatch per stage; component tests
- [x] T011 `planned_stages` skips done stages; workload test
- [x] T012 API read: stage `done`; API test, contract
- [x] T013 Guide `gantt/stages.md`, CHANGELOG line
