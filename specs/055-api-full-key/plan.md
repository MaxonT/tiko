# Implementation Plan: A key with its person's full rights, with a way back

**Spec**: [spec.md](spec.md) | **Contract**: additions to [046's contract](../046-api-mcp/contracts/api-v1.md) and its OpenAPI snapshot

## Decisions

- **Scope.** `Scope` gains `full`, ranked `read < write < full` (`api_keys.allows`). The workspace setting `full_keys` (off by default) is read through `ApiKeys.full_allowed`; `deps.full` is "scope full and allowed", `deps.full_budget` guards restore. Migration 014 widens the `api_keys.scope` check.
- **Plan.** `Batch.full` makes `_own` record people's elements, arrows and reminders in `Applied.overwrote` instead of refusing; the vote lock is checked first and still refuses.
- **Copies.** `board_copies` (Postgres, RLS as `api_elements`, cascades as `board_previews`) holds the board document, who, why and a `written` map: people's elements as keys last wrote them since that copy. `copies.holds` skips a copy when every overwritten element stands as the newest copy has it or as a key wrote it; `note_written` records what a call left. Trim to 20 on insert, purge after 14 days in housekeeping; `_USED_FILES` reads copies too.
- **Where.** In the room: plan, and if people's work is overwritten and not held, save the copy (awaiting the database), then read and plan again, at most three times. Without a room the same runs on the stored state. `Batch.restore` takes the same path, so workers forward it with no new message: the room saves the board unless it equals the newest copy, then writes the copy's document forward through `LiveDoc.write`, so tabs get an ordinary update. Never Yjs bytes.
- **Routes and MCP.** `GET /copies` (write), `POST /copies/{copy}/restore` (full). MCP `list_copies` for write keys, `restore_copy` only listed for full keys. Reads mark every element editable for a full key.
- **Web.** Settings → Sharing gets the switch; the key dialog offers Full access when the list says `full`.

## Risks

- A copy is a whole board, up to megabytes at 2000 nodes; only boards a full key touched pay, at most 20 each.
- A restore brings removed content back onto a public link; the web confirmation in slice 2 says so.
