# Feature Specification: Predictable layout for agents

**Status**: Approved at G1 and G2 on 2026-11-23.

**Input**: Issue #398. An agent that keeps a board through MCP reported: a reminder flew off its note when both moved in one call, a free reminder cannot go into a frame, `arrange` lays out four columns whatever the frame's width, cards answer with no size, every new element first lands below the board and needs a second call to move, and a read of a large board does not fit one answer.

## Why

- Which fog does this clear: an agent that lays out a board blindly makes a mess a person then tidies by hand. With sizes, placement and a layout that fits its frame, the agent's board reads well the first time.
- What this spec does not give: changing or removing people's elements, a way back after a change, Gantt writes (issues #399 and #400), or changes chosen by a condition on the server.

Principles check:

| Principle | How the feature passes it |
|---|---|
| Truth | Cards still show the tracker's task; filters read the same refreshed state. |
| Clarity | "Your agent can place things exactly and lay cards out to fit a frame." |
| A fresh angle | None new: the agent arranges as a person would. |
| Room to arrange | A reminder stays on what it is about wherever that goes. |
| Calm | Fewer calls, no stray elements left below the board. |
| Trust | Nothing new is reachable: same keys, same ownership rules as spec 046 FR-010. |

## Decisions

### Reminders

1. **A reminder on an element moves only with it.** A change with `x`/`y` for a reminder sitting on an element is refused (`422`): "a reminder on an element moves with it; give `on` to put it on another one, or `on: null` to free it". Today such a move is computed against where the element was before the same call moved it, so the reminder lands off by the element's move (reproduced: a note moved by (5000, 5000) took its reminder to twice that).
2. **`on` in a change.** A change of a reminder takes `on`: an element id puts it on that element beside its top-left corner, as the web app does; `null` frees it where it stands. Same holders as `add_reminder`. Status reminders stay on a card of their task: `on` to anything else is refused.
3. **A free reminder goes into frames.** A free reminder takes `x`, `y` and `frame`, in `add_reminder` and in changes, as the web app lets a person drop one into a frame. A reminder on an element takes none of them.

### Sizes

4. **Cards answer with the room they take.** A card's `w` and `h` in reads are 320 and 50: the web app's guess before it measures a card (`CARD_GUESS`) and the room `arrange` keeps for one. The tool description says the height grows when a card is opened.

### Placement on add

5. **`add_cards`, `add_notes`, `add_frame` take a place.** Each card and note takes `x` and `y`; notes also `w` and `h` (text a width only); `add_frame` takes `x`, `y`, `w`, `h`. Coordinates are the board's, also inside a frame, as in reads. Left out, the element is laid out as today. The REST add already takes them; MCP only exposes them.

### `arrange`

6. **Columns.** `arrange` takes `columns` (1 to 20). Left out: into an existing frame, as many 320 px columns as fit its width (at least one); otherwise 4, as today. The status layout keeps one column per status and ignores it.
7. **Order.** `order`: `given` (default, as today), `key` (by task key, numbers compared as numbers: DEMO-9 before DEMO-10), `status` (by status category, then status name, then key). In the status layout `order` sorts the cards of each column.
8. **Fit the frame.** `fit: true` sets the frame's size to what it holds plus its margins, smaller or larger. Without it the frame only grows, as today.

### Reads

9. **Filters.** A read of elements (`all` or one frame) takes:
   - `kinds`: element kinds to answer with.
   - `status`: cards whose task is in one of these statuses (names, case ignored).
   - `done`: `true` only cards whose task is done, `false` only those that are not.
   - `outside_frames`: only elements not in a frame.
   Filters combine with AND; a card filter drops elements that are not cards. Paging (`after`) runs over the filtered list. REST takes them as query parameters (`kind` repeated, `status` repeated, `done`, `outside_frames`).
10. **Compact.** `compact: true` answers each card with `title` and `status` next to its key instead of the nested `task`, and leaves out fields that are null. MCP and REST (`compact=true`) alike.

## Requirements

- **FR-001**: A change MUST NOT move a reminder that sits on an element by `x`/`y`; `on` MUST reattach or free it; a free reminder MUST take a place and a frame.
- **FR-002**: Reads MUST give cards `w` 320 and `h` 50.
- **FR-003**: MCP adds MUST take places and sizes as Decision 5 says.
- **FR-004**: `arrange` MUST take `columns`, `order` and `fit` as Decisions 6–8 say.
- **FR-005**: Reads of elements MUST take the filters and compact mode of Decisions 9–10, in MCP and REST.

## Testing

- **Domain tests**: a reminder and its note moved in one call, in both orders: refused for the reminder's place, the reminder still beside the note; `on` to another element, `on: null`, a status reminder to a note refused; a free reminder into a frame and out; columns given, fitted to a 1000 px frame (2 columns), a frame narrower than a card (1); order by key with DEMO-9 and DEMO-10; order by status; fit shrinks a large frame and grows a small one.
- **API tests**: card `w`/`h` in a read; each filter, a combination, paging over a filtered list; compact answer has no `task`; REST query parameters.
- **MCP tests**: `add_cards` and `add_frame` with places land there; `arrange` arguments reach the plan.
- **Contract test**: the OpenAPI snapshot grows only by additions. Card `w`/`h` turning from null to numbers is an addition of values, not of fields.
- **By hand**: Claude Code against a local stack: "put DEMO-1..12 into the narrow frame, sorted by key, and fit the frame", "move the note with the reminder into the Done frame", "show only done cards outside frames". Recorded in the PR.
- `make check`, `make smoke`.

## Slices

1. `api-layout`: all decisions; guide `api.md` and `ai-agents.md`; CHANGELOG.

## Out of scope

- Changes chosen by a condition on the server ("all done cards into frame X"), finding duplicates: an agent filters with Decision 9 and sends ids.
- Removing a reminder a person set, marking it done, people's text and removal, a way back (issue #399).
- Gantt writes (issue #400).
