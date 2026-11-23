# Feature Specification: A key with its person's full rights, with a way back

**Status**: Approved at G1 and G2 on 2026-11-23 (the workspace setting is off by default).

**Input**: Issue #399. An agent keeping a board for its owner cannot rename the owner's frames, fix a typo in a note, clear old elements or remove a reminder the owner set: a key changes the text of, and removes, only what was added through the API (spec 046 FR-010). The owner tidies by hand what the agent was asked to tidy.

## Why

- Which fog does this clear: a board the agent keeps drifts from what it should say, because the agent may only add. With full rights it keeps the whole board current.
- Why the limit existed (spec 046 Decision 11): a change by the server is in nobody's undo history and a board has no history, so an agent's mistake on people's work could not be undone. This spec lifts the limit only together with a way back.
- What this spec does not give: Gantt writes (issue #400), history of every change, undo of a single element.

Principles check:

| Principle | How the feature passes it |
|---|---|
| Truth | Nothing changes in how cards read their tracker. |
| Clarity | "A full key does on your boards what you can do yourself; before it changes your work, tiko saves the board." |
| A fresh angle | None new. |
| Room to arrange | The person decides per key; the board can always go back to before the agent touched it. |
| Calm | A saved copy is made only when people's work is about to change, not on every call. |
| Trust | Off unless an admin allows it and the person picks it for a key; votes keep their lock; every restore is itself undoable. |

## Decisions

### The key

1. **A third scope, `full`.** A key is `read`, `write` or `full`, in that order: each does what the one before does. A `full` key, on a board where its person may edit, changes the text and title of any element, removes any element, arrow and reminder, as the person could in the web app. A board the person may only view stays read-only for the key.
2. **Allowed by an admin.** A workspace setting, next to the switch for API keys: "Keys may change and remove everyone's work". Off by default. Off: no new `full` key, and existing `full` keys act as `write` keys until it is on again; a refusal then says the workspace does not allow it, so the agent can tell the person.
3. **Said plainly when made.** The key dialog explains `full` in one line and that tiko saves the board before the key changes people's work.
4. **`editable`** in reads is true for every element on a board a `full` key may edit.

### The way back

5. **A saved copy before people's work changes.** Before a call by a `full` key changes the text of, or removes, an element, arrow or reminder it did not add through the API, tiko saves the board as it was, in the same step as the change: if the copy cannot be saved, the call fails and nothing changes. No new copy is made when the latest one already holds every element the call overwrites exactly as it stands now, so a session of tidying makes one copy, and work people do between two calls is never left out of every copy. A copy holds the board document, elements and arrows, as an export does.
6. **Kept for a while.** A board keeps its last 20 copies, none older than 14 days. Pictures a copy shows are kept as long as the copy.
7. **Listed and restored.** `GET /api/v1/boards/{id}/copies` lists copies (`id`, `saved_at`, who made the change and "via API" or "restore", how many elements). Any key that may write the board may list. `POST /api/v1/boards/{id}/copies/{copy}/restore` puts the board back as the copy has it, for everyone at once, as one ordinary change people with the board open see live; only a `full` key may restore, as it reverts people's work. Restoring first saves the board as it is now, unless that equals the newest copy, so a restore can be undone the same way. Refused while a vote runs (`409 vote_running`). Elements the API added come back as people's: tiko no longer knows they were the API's. MCP: `list_copies(board)`, `restore_copy(board, copy)`.
8. **In the web app too.** The board menu gets "Saved copies": the list, and Restore with a confirmation that says it changes the board for everyone, also on a public link. Only people who may edit the board see it. A person whose agent made a mess needs no agent to undo it. No release ships slice 1 without slice 2.

### Limits that stay

9. Elements in a running vote keep their text and look; removing them is refused (`409 vote_running`), as for people in the web app.
10. Modules (Gantt, planning) are not changed by this spec, except that a `full` key may remove a module the person may remove.

## Requirements

- **FR-001**: Keys MUST take scope `full`; a `full` key MUST change text and remove any element on a board its person may edit, and only while the workspace allows it.
- **FR-002**: A call by a `full` key that changes or removes people's work MUST save the board first, at most once per 10 minutes per board.
- **FR-003**: Copies MUST be listed and restored through REST, MCP and the web app; restoring MUST save the current board first.
- **FR-004**: With the workspace setting off, a `full` key MUST act as a `write` key.

## Testing

- **Domain tests**: a full key changes a person's note text and removes a person's frame; a write key still cannot; a viewer's board refuses both; the setting off makes full act as write and says why; the first destructive call saves a copy; a second on the same elements unchanged saves none; a person's edit between two calls makes the second call save again; a call that only adds or restyles saves none; a failed copy fails the call; 21 copies keep 20, a 15-day-old one goes; restore saves the current board first unless it equals the newest copy, and puts the copy back; restore during a vote refused; vote lock holds; a picture in a copy outlives its removal from the board.
- **API tests**: list on a read key refused; restore by a write key refused, by a full key works on a board its person may edit.
- **MCP tests**: a full key lists `list_copies` and `restore_copy`; a read key does not.
- **Frontend**: the key dialog offers full only when the workspace allows it; Saved copies lists and restores with a confirmation (Vitest); a restore reaches an open tab live.
- **Contract test**: the OpenAPI snapshot grows only by additions (`full` is a new enum value).
- **By hand**: Claude Code against a local stack with a full key: "rename the frames to the quarter's goals, remove the archive frame with what is in it"; then restore from the web app.
- `make check`, `make smoke`.

## Slices

1. `api-full-key`: Decisions 1–7, 9–10: scope, setting, copies and restore in REST and MCP, key dialog line, guide, CHANGELOG.
2. `board-copies`: Decision 8, the web app's Saved copies. Ships in the same release as slice 1.

Next, as its own spec: `dry_run` on writes, so an agent can try a large change first.

## Out of scope

- A history of every change, undo of one element, a diff between copies.
- Marking a person's reminder done; trying a change first (`dry_run`).
- Copies made by people's own edits.
- Gantt rows and fields (issue #400).
