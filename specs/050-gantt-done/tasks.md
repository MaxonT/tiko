# Tasks: Mark Gantt rows and stages done

## Slice 1: `gantt-done` (rows)

- [ ] T001 `Row.done` in `backend/app/domain/modules/gantt.py` and `frontend/src/modules/gantt/schema.ts`; refused with a `key`; domain tests
- [ ] T002 `frontend/src/modules/gantt/done.ts`: `leafDone`, `progress`, `tickLeaf` for rows; unit tests
- [ ] T003 Label checkbox: hand rows tick, task rows read-only with tooltip, viewers see a static mark; parent `done/total`; component tests with Undo
- [ ] T004 Done look: hatch utility in `index.css`, `line-through`, on `GanttBar` and on the stage bar of a leaf without stages in Planning; tests
- [ ] T004a Seed a few done rows in the welcome board's Gantt and the demo sample plan
- [ ] T005 API read: `done` on rows, `progress` on parents; API tests, OpenAPI snapshot, 047 contract
- [ ] T006 Guide `gantt.md`, CHANGELOG line
- [ ] T007 By hand: showcase roadmap with done marks on the local stack, screenshot in the PR

## Slice 2: `gantt-stage-done` (stages)

- [ ] T008 `Stage.done` in both models; domain tests
- [ ] T009 `leafDone` and `tickLeaf` for stages; unit tests
- [ ] T009a A hand row with stages keeps `done` equal to every stage done on each change; split and merge of stages keep `done`; unit tests
- [ ] T009b No time off warning on a done stage
- [ ] T010 "Done" in the stage popover, hatch per stage; component tests
- [ ] T011 `planned_stages` skips done stages; workload test
- [ ] T012 API read: stage `done`; API test, contract
- [ ] T013 Guide `gantt/stages.md`, CHANGELOG line
