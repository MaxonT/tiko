# Tasks: Code on the board

## Slice 1: code-element

- [ ] T001 Domain: `code` node with `text` (≤ 10,000), `language` from the fixed list, `collapsed`; batch, layout, preview, transfer and search take it like a text; API v1 reads it as kind `code`
- [ ] T002 Shiki core with the JavaScript engine behind `import()`, one chunk per language, light and dark themes on the app's tokens; tokens rendered as React elements
- [ ] T003 Code node: header with language, copy and fold; in-place editing with Tab and Shift+Tab; wrap and height from the text; far view block; view-only unfold for the viewer only
- [ ] T004 Toolbar button, `K`, palette "Add code"; selection bar Turn into code on text and sticky, Turn into text on code, id and arrows kept
- [ ] T005 Smoke saves and reopens a board with a code block; main chunk size checked
- [ ] T006 Guide page On the board, CHANGELOG, THIRD_PARTY for Shiki; media wait for the release

## Slice 2: code-api

- [ ] T007 API v1 and MCP write kind `code`: create, change text, language and folding, remove; contract `api-v1.md` and `openapi-v1.json`
- [ ] T008 Guide API reference, CHANGELOG
