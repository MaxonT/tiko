# Feature Specification: Mark Gantt rows and stages done

**Status**: Approved at G2 on 2026-11-15 (Decision 9: done stages leave the workload; Decision 4: a task row's stages are ticked by hand).

**Input**: A Gantt row that is not a tracker task cannot be marked done. Finished work either stays on the plan looking unfinished or gets moved to a "Shipped" group at the top, which breaks the plan's structure. Planning stages have the same gap: a row with discovery, build and review shows no way to say build is over. Teams that plan in their own Gantt tools tick rows off, see a done bar hatched and struck through, and read progress on a group as "2/8".

## Why

- Which fog does this clear: "how far along are we?" With done marks a plan answers it at a glance: each group shows how many of its rows are done, and finished work stays where it was planned, so the plan also shows what was done early or late.
- What this spec does not give: a filter by done or not done, risk and blocker marks, or a "needs attention" list. Those are separate ideas.

Principles check:

| Principle | How the feature passes it |
|---|---|
| Truth | A task row stays as the tracker says: tiko never shows a tracker task as done while the tracker has it open. Only rows that tiko owns are ticked by hand. |
| Clarity | "Tick a row done; a group shows 3/5." |
| A fresh angle | Done tracker tasks and hand-ticked rows count together in one progress number, on the plan's own groups. |
| Room to arrange | A done row stays in place; nothing moves or hides by itself. |
| Calm | Done looks quieter (hatched, struck, muted), not louder. No notifications. |
| Trust | Undo takes a tick back; viewers see marks but cannot change them. |

## Decisions

### What can be done

1. **A row without a tracker task is ticked by hand.** Such a leaf row gets a checkbox in the label column, left of its title. Ticking stores `done: true` on the row; unticking removes the field, so content saved before this spec stays the same.
2. **A task row takes done from its tracker.** A row with a `key` shows the same checkbox, ticked when the task's status category is `done`, and it cannot be clicked; the tooltip says "Done in <tracker>" or "Open in <tracker>". The backend refuses `done` on a row with a `key`.
3. **A parent is not ticked.** Its label shows `done/total` over the leaves of its branch, task rows included, as "2/8" in the group's row. All done → the number turns green. A parent stores no `done`; a row that gets children keeps a stored `done`, which is not drawn while it has children, as parents' stages are today.
   - The number counts the whole branch, filters aside: a filter hides rows, not progress.
   - A collapsed parent shows its number too.
4. **Stages, with Planning on.** A stage gets its own `done`, ticked from the stage's menu and from a checkbox that shows on the bar on hover. A leaf with stages counts as done in its parent's number when every stage is done; its own checkbox ticks or unticks all its stages at once. A task row's stages are ticked by hand too: stages are tiko's plan, not the tracker's.
   - A hand row with stages keeps `done` equal to "every stage done" on every change, so switching Planning off shows the same mark. A new stage that is not done unticks the row.
   - With Planning off a task row shows the tracker's status, as stages are not drawn.
   - A done stage gives no time off warning: the work is over.

### How done looks

5. **A done bar is hatched and its title struck through**, in the bar's own colour, as task rows look today when the tracker says done (`line-through`, muted text). A done stage is hatched on its own; the other stages of the row stay as they are.
6. **Nothing moves.** A done row keeps its place, dates and links. Dates are not changed when a row is ticked. A row dragged out of the Gantt onto the board becomes a note or a card as today; the mark stays behind, as notes have none.
   - With Planning on, a leaf without stages is drawn by the stage bar, not the plain bar; both get the done look.

### Who and where

7. **Editors tick, viewers see.** A view-only board, a public link and the board preview show marks and numbers but no clickable checkbox.
8. **Undo, live and transfer.** A tick is a change of the module's content: it goes through Undo, reaches everyone with the board open, and travels in a `.tiko` file and in a copied module. No new storage.
   - The Gantt on the welcome board and the demo's sample plan get a few done rows, so the feature shows on first open.
   - The board thumbnail stays as it is.

### Workload

9. **A done stage stops counting in workload.** It is left out of the workload and of overlap warnings entirely, so a stage finished early no longer marks the person busy on its remaining days. tiko does not store when a stage was ticked, so its past days drop out too.
   - Rejected: keep counting done stages. The workload would then warn about a person whose work is over.

### API

10. **Reads show done.** In `GET /api/v1/boards/{id}/modules/{module_id}` (spec 047) and MCP `read_gantt` a leaf row gains `done: true` when it is done by Decision 1, 2 or 4, absent otherwise; a parent gains `progress: {done, total}`, counted before `read_gantt` narrows or folds the answer; a stage gains `done: true`. An addition to v1. Writing done through the API is not in this spec, as writing the Gantt is not.

## Requirements

- **FR-001**: An editor MUST tick and untick a leaf row without a `key`; the mark MUST be stored as `done: true` and removed when unticked.
- **FR-002**: A task row MUST show done from the task's status category and MUST NOT be ticked by hand; the backend MUST refuse `done` on a row with a `key`.
- **FR-003**: A parent MUST show `done/total` over the leaves of its branch, task rows included.
- **FR-004**: With Planning on, an editor MUST tick a stage; a leaf with stages MUST count as done when all its stages are; its checkbox MUST tick all of them.
- **FR-005**: Done bars and stages MUST be hatched with the title struck through; rows MUST NOT move or change dates.
- **FR-006**: Viewers MUST see marks and numbers and MUST NOT change them.
- **FR-007**: Done stages MUST NOT count in workload and overlap warnings.
- **FR-008**: The Gantt read in API v1 MUST return `done` on rows and stages and `progress` on parents.

## Testing

- **Domain tests**: `done` stored and absent; refused with a `key`; kept but not counted on a row with children; stage `done`; old content without the fields validates unchanged; workload without done stages.
- **Frontend unit tests**: progress of a branch with mixed hand rows, task rows (done and open) and rows with stages; a leaf with all stages done counts, with one open does not; ticking a leaf with stages ticks them all.
- **Frontend component tests**: checkbox ticks and stores, Undo takes it back; task row checkbox is read-only and follows the task; view-only shows no clickable checkbox; done bar has the hatch and `line-through`.
- **API tests**: `done`, `progress` and stage `done` in the read; the OpenAPI snapshot grows only by additions.
- **By hand**: the showcase roadmap rebuilt with done marks instead of "Shipped" groups, on the local stack; screenshot in the PR.
- `make check`, `make smoke`.

## Slices

1. `gantt-done`: Decisions 1–3, 5–8 and 10 for rows; guide page `gantt.md`; CHANGELOG.
2. `gantt-stage-done`: Decisions 4 and 9, stage `done` in the read; guide `gantt/stages.md`; CHANGELOG.

## Out of scope

- Filter by done, risk and blocker marks, "needs attention".
- Writing done through the API or MCP.
- Writing done back to the tracker.
- A date when a row was done.
