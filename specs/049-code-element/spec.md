# Feature Specification: Code on the board

**Feature Branch**: `feat/code-element`

**Created**: 2026-11-15

**Status**: Approved by the owner at G2 on 2026-11-15.

**Input**: A team that draws technical designs on tiko asked for code on the board: paste a piece of code or turn a text into code, with syntax highlighting, a language picker, one-click copy, and code that folds away.

## Why

- A technical design sits next to its code: an API request, a config, a migration, a log line. Today that goes into a text or a sticky note, in a proportional font, with no colors and broken indentation.
- Which fog does this clear: what exactly the arrow between two services sends, or what the config next to a task looks like, without opening another tool.

## Decisions

1. **A built-in element, not a module and not a text format.** A code block is a `code` node with `text`, `language` and `collapsed` in its data. Modules are for whole tools like Gantt; a language, folding and copy are properties of an object, not a style of text. The text element stays plain.
2. **Fixed list of languages**, stored as an id: Plain text, Bash, C, C#, C++, CSS, Dockerfile, Go, GraphQL, HCL, HTML, Java, JavaScript, JSON, Kotlin, Markdown, PHP, PowerShell, Python, Ruby, Rust, SQL, Swift, TOML, TSX, TypeScript, XML, YAML. A new block is Plain text. No guessing of the language.
3. **Highlighting with Shiki**, the fine-grained core with the JavaScript regex engine (no WebAssembly). The highlighter and each language load on first use, never in the main chunk; until then the code shows in plain monospace. Light and dark colors follow the app's theme. Tokens render as React elements, never as raw HTML.
4. **Look.** Card surface, monospace text at 13px, a thin header with the language, a copy button and a fold button. Lines wrap; the height follows the text, the width is the person's. Up to 10,000 characters.
5. **Editing.** Double-click edits the code in place, the colors stay while typing. Tab indents by two spaces, Shift+Tab outdents, Esc leaves. The language is picked from the header while the block is selected.
6. **Folding.** Folded, the block shows only its header with the first line and the line count. Folding is saved for everyone. On a view-only board a person can unfold a block for themselves; it is not saved.
7. **Copy** puts the code as plain text on the clipboard, on view-only boards too, and says so with a toast.
8. **Turn into code and back.** The selection bar of a text or a sticky note offers Turn into code; a code block offers Turn into text. The element keeps its id, place, width, arrows and timers; the text moves over as it is. A sticky's color is dropped.
9. **Added like a text**: a toolbar button, the shortcut `K`, and "Add code" in the command palette. A new block is 480 wide and is being edited at once.
10. **Behaves like a text element** everywhere else: arrows from its four sides, frames, timers, copy and paste, duplicate, undo, search, live editing, the far view as a block, board transfer in `.tiko`. No reactions, no votes.
11. **API v1 and MCP** get the kind `code` with `title`, `text`, `language`, `collapsed`, `numbered`, `marked`, readable and writable like `text`. This is an additive change; clients already ignore unknown kinds.
12. **A title** (owner, 2026-11-15): optional, up to 200 characters, edited in the header. A folded block shows the title instead of its first line; search finds a block by its title and its code; Turn into text puts the title on the first line.
13. **The language list is searchable** (owner, 2026-11-15): a field on top narrows it as you type, by name or short name (`js`, `ts`, `py`, `sh`, `yml`, `tf`), exact names first; arrows move, Enter picks.
14. **Paste as code** (owner, 2026-11-15): `⇧⌘V` (`Ctrl+Shift+V`) and "Paste as code" in the palette put the copied text on the board as a code block, selected, in the language it is plainly written in.
15. **Language guessed by plain signs** (owner, 2026-11-15) on Paste as code and Turn into code: a shebang, JSON that parses, `<?php`, `package main` with `func`, `def …:` and the like. Nothing sure means plain text; no library, a wrong guess costs one pick.
16. **Line numbers and marked lines** (owner, 2026-11-15): numbers come on per block from the header; a click on a number marks or unmarks its line for everyone. Marks are line numbers, counted from 1, up to 500 per block. An edit takes each mark with its line, found by its text nearest to where it was; a line fixed in place keeps its mark, a line that is gone loses it. A wrapped line keeps its number on its first row.
17. **A converted sticky is 320 wide at least**, and a newly picked language keeps the old colors until it loads, with no flash of plain text.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Code next to the design (Priority: P1) 🎯

An engineer draws two services and an arrow between them, adds a code block under the arrow, pastes the JSON body of the request, picks JSON, and folds a long SQL migration next to the database cylinder.

**Independent Test**: on the compose stack press `K`, paste a piece of Python, pick Python: colors appear. Fold it, reload: it stays folded. Copy it and paste into an editor: the text matches byte for byte. Switch the app to dark: colors change. Open the board in a second window: edits arrive live. `make smoke` saves and reopens a board with a code block.

**Acceptance Scenarios**:

1. **Given** the toolbar, **When** Code is clicked or `K` is pressed, **Then** a 480-wide code block appears and is being edited.
2. **Given** a code block being edited, **When** Tab is pressed, **Then** two spaces are inserted and the focus stays in the block.
3. **Given** a selected code block, **When** a language is picked in its header, **Then** the code is colored in that language for everyone on the board.
4. **Given** a code block, **When** the fold button is pressed, **Then** only the header with the first line and "N lines" is shown, for everyone, after a reload too.
5. **Given** a view-only board with a folded block, **When** the viewer unfolds it, **Then** it unfolds for them only, and Copy works.
6. **Given** a text or a sticky with arrows, **When** Turn into code is picked, **Then** it becomes a code block in the same place with the same text and the arrows still attached; Turn into text goes back.
7. **Given** a board with code blocks, **Then** search finds their text, the far view draws them as blocks, and a `.tiko` transfer carries them.
8. **Given** a board that never had a code block, **Then** no highlighter code is downloaded.
9. **Given** a saved doc with an unknown `language` or over 10,000 characters, **Then** the API answers 422.

### User Story 2 - An agent puts code on the board (Priority: P2)

An agent working through the API or MCP adds a code block with the config it changed next to the task card.

**Independent Test**: with a write key, `POST` an element of kind `code` with `text` and `language`: it appears on the open board, colored. `GET` returns it with `kind: "code"`.

## Requirements *(mandatory)*

- **FR-001**: The board MUST have a `code` element with a text, a language from the fixed list and a folded flag.
- **FR-002**: The API MUST accept `code` nodes in a board doc and refuse an unknown language or a text over 10,000 characters.
- **FR-003**: Highlighting MUST load only when a code block is shown and MUST follow the app's light and dark theme.
- **FR-004**: The toolbar MUST offer Code with a shortcut and a palette command; the selection bar MUST convert between text, sticky and code.
- **FR-005**: A code block MUST take part in arrows, frames, timers, copy, undo, search, live editing and board transfer like a text.
- **FR-006**: API v1 and MCP MUST read and write the kind `code`.

## Slices

1. **code-element**: the element, highlighting, folding, copy, conversion, toolbar and palette, everything in decision 10, guide and CHANGELOG. API v1 reads it as `code`.
2. **code-api**: writing `code` through API v1 and MCP, contract and guide.

## Out of scope

- Guessing the language of code typed by hand or pasted with a plain `⌘V`; a guess better than plain signs.
- Diffs, marking a range by dragging.
- Running code, links to a repository, a code block that follows a file.
- Languages outside the list, a theme picker.
- Markdown or code formatting inside texts and stickies.
