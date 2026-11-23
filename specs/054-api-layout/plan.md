# Implementation Plan: Predictable layout for agents

**Spec**: [spec.md](spec.md) | **Contract**: additions to [046's contract](../046-api-mcp/contracts/api-v1.md) and its OpenAPI snapshot

## Summary

Everything already lives in the stored board; the API learns to read and write more of it. Nothing new is stored; no migration.

## Decisions

- **Reminders.** `batch.py`: `Change.on`; `_reattach` runs before `_move` and hangs a reminder beside its new holder (`_BESIDE`) or frees it at its absolute place. `_move` refuses `x`/`y`/`frame` for a reminder whose parent is a holder (`_holder`), and no longer refuses a free one in a frame. `NewElement` lets a free reminder take `x`, `y`, `frame`.
- **Card size.** `api_view._element` answers `layout.SIZES["task_card"]` for cards.
- **Arrange.** `Arrange` gains `columns`, `order`, `fit`. `layout.grid` takes `per_row`; `layout.fitting` counts the columns a frame's width holds; `layout.fit` sizes a frame to its children. `_natural` sorts keys with numbers as numbers. The route asks for statuses when `layout` or `order` is `status`. The arranged frame is in the answer, so its new size is seen.
- **Reads.** `BoardShape.chosen` filters by kind, task status, done (status category) and frame; `Element.compacted` swaps `task` for `title` and `status` and drops nulls, with an excluded `compact` flag the serializer reads. Any filter makes the read a page of elements.
- **MCP.** `CardIn`, `NoteIn`, `add_frame`, `add_reminder`, `arrange`, `read_board` expose the new fields; descriptions name them.

## Risks

- `fit` sizes the frame from the stored or guessed sizes; an opened card is taller than its guess and may overhang until someone resizes the frame.
