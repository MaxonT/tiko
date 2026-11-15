# Tasks: Mark Gantt rows and stages done

## Slice 1: `gantt-done` (rows)

- [ ] T001 `Row.done` in `backend/app/domain/modules/gantt.py` and `frontend/src/modules/gantt/schema.ts`; refused with a `key`; domain tests
- [ ] T002 `frontend/src/modules/gantt/done.ts`: `leafDone`, `progress`, `tickLeaf` for rows; unit tests
- [ ] T003 Label checkbox: hand rows tick, task rows read-only with tooltip, viewers see a static mark; parent `done/total`; component tests with Undo
- [ ] T004 Done bar: hatch utility in `index.css`, `line-through`; test
- [ ] T005 API read: `done` on rows, `progress` on parents; API tests, OpenAPI snapshot, 047 contract
- [ ] T006 Guide `gantt.md`, CHANGELOG line
- [ ] T007 By hand: showcase roadmap with done marks on the local stack, screenshot in the PR

## Slice 2: `gantt-stage-done` (stages)

- [ ] T008 `Stage.done` in both models; domain tests
- [ ] T009 `leafDone` and `tickLeaf` for stages; unit tests
- [ ] T010 Stage menu "Mark done", hover checkbox on the stage bar, hatch per stage; component tests
- [ ] T011 `planned_stages` skips done stages; workload test
- [ ] T012 API read: stage `done`; API test, contract
- [ ] T013 Guide `gantt/stages.md`, CHANGELOG line
