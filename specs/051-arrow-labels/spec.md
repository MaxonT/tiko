# Feature Specification: Arrow labels

**Feature Branch**: `feat/arrow-labels`

**Created**: 2026-11-21

**Status**: Approved by the owner at G2 on 2026-11-21 with every recommended answer below.

**Input**: Owner's request: double-click an arrow and a text label appears in its middle; it moves with the arrow; its color and size come from the selection bar, as for a text or a sticky note. The label can be dragged along the arrow toward either end, not only kept in the middle. Arrows with strong or unusual bends must still carry a readable label.

## Why

- An arrow between two cards can mean "blocks", "waits for", "sends the order to" or "then". Today the board does not say which. People put a separate text next to the arrow, and it stays behind as soon as one of the elements moves, so the drawing quietly stops saying what it meant.
- Which fog does this clear: "why are these two connected?" A label rides on the arrow, so the reason stays readable however the board is rearranged.
- What this spec does not give: arrow colors, dashes, heads at both ends, bent or freehand arrows, or labels that mean something to tiko (a "blocks" label that changes a task). Those are separate ideas; Decision 3 keeps room for bent arrows.

Principles check:

| Principle | How the feature passes it |
|---|---|
| Truth | A label is the person's own words, like a note; it holds no tracker data, so there is nothing to go stale. It moves with its arrow, so it never ends up next to the wrong one. |
| Clarity | "Double-click an arrow and type what it means." |
| A fresh angle | A list of tasks shows a link as a fixed type at best; on the board the person names the link in their own words, where both tasks are in view. |
| Room to arrange | The person picks where along the arrow the label sits, and every word is theirs. tiko gives no fixed list of link types. |
| Calm | No fill by default: plain text in the line's gap, the size of a shape's text. Color only when the person picks it. |
| Trust | Undo takes any change back; viewers read labels and cannot change them; labels travel in a `.tiko` file and through the API. |

## Decisions

### Adding and editing

1. **Double-click an arrow to label it.** An arrow without a label gets an empty one in its middle, being edited at once. One label per arrow: a double-click on an arrow that has one, or on the label itself, edits it. `Enter` on a selected single arrow does the same, so the keyboard reaches it.
2. **Editing works like a text element.** `Enter` finishes, `Shift+Enter` starts a new line, `Esc` finishes and keeps the text, as everywhere on the board; a click elsewhere finishes too. A label that is empty when editing finishes is removed, so a double-click by mistake leaves nothing behind. Up to 500 characters, like a shape. Undo takes it back.

### Where it sits

3. **The label's place is a share of the arrow's length**, from 0 at the start to 1 at the end, 0.5 by default. When elements move, the arrow is redrawn and the label keeps its share. A share of the length, not a point of the curve's formula, is what a later bent arrow with several segments still understands.
   - Rejected: a distance in pixels from one end. It reads well on long arrows but sends the label off the arrow when the arrow gets shorter.
4. **Drag the label along the arrow.** Pressing on the label and moving slides it along the arrow to the point nearest the pointer; it never leaves the line. It stops short of both ends, so it never covers the arrowhead or the element the arrow is tied to. Near the middle it snaps back to the middle (within 8 screen pixels), so centering again is easy. One drag is one undo step.
   - A click without moving selects the arrow, as a click on the line does.
5. **Strong bends do not make the label jump.** While dragging, the label follows the stretch of the arrow it is on: where the arrow curls back or crosses itself, it passes through the crossing instead of hopping to the other branch. Only when the pointer is clearly closer to another part of the arrow (Plan: Drag) does it move there.
6. **The text stays level.** The label never turns with the line, so it reads the same on a steep, curled or upside-down arrow, and on an arrow tied to a turned element. Its middle sits on the arrow.
   - Rejected: text along the curve. On a tight hook or an S-curve it turns upside down or bends past reading.
7. **The line breaks under the label.** The arrow is cut where the label stands, so text never sits on a line, and whatever is behind (a frame's tint, the dot grid) shows through, with no patch of canvas color.
   - Rejected: a label on a canvas-colored patch. Over a tinted frame or a filled shape the patch would show as a box.
8. **Long labels wrap** at 240 board pixels wide and grow in height. A label wider than a short arrow stays in the middle and cannot be dragged; the arrow is just shorter than its words.

### Look

9. **Color and size come from the selection bar.** A selected arrow with a label gets the bar: "Arrow" (or "3 arrows"), then Fill and Text size, then Delete. Fill is the shape's palette: no fill (default), the card surface, and the six sticky colors; a filled label is a small chip with `--sticky-foreground` text, radius 4px. Text size is Small, Medium and Large at 12, 14 and 20px, Medium by default, as in a shape. One pick is one undo step for every selected arrow.
   - An arrow without a label shows the bar with "Add label", which does what a double-click does.
   - A selection that mixes arrows with other elements works as today: the bar acts on the elements and leaves the arrows out.
   - Rejected: a text color. tiko has none for any element; colors on the board are fills, and DESIGN.md keeps it that way.
10. **Labels scale with the board**, like any text on it, and draw above their arrow and below elements.

### Everywhere else

11. **Live and undo.** A label is part of its arrow: others get its text when editing finishes, as with a text element, and a new place when the drag ends. Undo, redo, copy and paste, duplicate and Alt-drag copy carry the label with its arrow. Deleting an arrow deletes its label.
12. **Search finds label text.** `⌘K` lists a matching label with an arrow icon and "Arrow" as its context; opening it selects the arrow and centers it. While a query matches, a matching arrow and its label stay bright and the label gets the search ring.
13. **The far view draws a label as a bar.** At 20% zoom and below it is one 12px bar, as wide as its text would be up to 240px, at its place on the arrow, in the label's fill when it has one, with the line still cut under it. A double-click there zooms in, as on any element.
14. **View-only boards and public links show labels** and nothing else: no editing, no dragging, no bar.
15. **Accessibility.** A labeled arrow is announced by its label ("Arrow: waits for API"); the editor is a field named "Arrow label"; the keyboard path is Decision 1's `Enter`. Labels follow the theme tokens and meet text contrast in both themes.
16. **Board transfer carries labels** in `.tiko` with no new format version: an older tiko imports the arrows and drops their labels. The guide says so.
   - Rejected: a new format version. An older tiko would then refuse the whole board for the sake of its labels.

### API and MCP

17. **API v1 and MCP read and write the label's text.** A read gives every arrow `label` (empty for none). `POST /elements` with kind `arrow` and MCP `connect` take an optional `label`; `PATCH /elements` and MCP `update_elements` take `label` on an arrow the key's person added through the API, the same rule as text and colour of other elements. Changing an arrow's ends is still refused. An addition to v1.
   - Its place, fill and size stay in the web app: v1 already gives arrows no geometry (no `x`, `y`), and a label's look is the person's layout, closed by design.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Name the link (Priority: P1) 🎯

A lead draws arrows between a backend task, a frontend task and a release note, double-clicks the first arrow and types "waits for API", the second "ships in". Later they move the cards into another frame: the labels ride along.

**Independent Test**: on the compose stack double-click an arrow between two cards, type a word, press `Enter`. Move one card: the label stays in the middle of the redrawn arrow. Reload: it is there. A second window sees it once editing finishes. Undo removes it. `make smoke` saves and reopens a board with a labeled arrow.

**Acceptance Scenarios**:

1. **Given** an arrow without a label, **When** it is double-clicked, **Then** an empty label being edited appears in its middle.
2. **Given** a label being edited, **When** `Enter` is pressed, **Then** editing finishes; **When** the text was empty, **Then** no label is left.
3. **Given** a labeled arrow, **When** either element moves or turns, **Then** the label stays at the same share of the arrow's length, level.
4. **Given** a labeled arrow over a tinted frame, **Then** the line is cut under the text and the frame's tint shows through.
5. **Given** a selected labeled arrow, **When** a fill and Large are picked in the bar, **Then** the label is a colored chip at 20px for everyone, and one Undo takes each back.
6. **Given** a board with labels, **Then** `⌘K` finds their text, the far view draws them as bars, a view-only board and a public link show them, and a `.tiko` export and import keeps them.

### User Story 2 - Slide the label out of the way (Priority: P1)

Two arrows leave the same card and their labels collide in the middle. The person drags one label toward its end.

**Independent Test**: drag a label along a straight arrow, then along an arrow tied to two sides facing away from each other (a hook), then along one that crosses itself: the label stays on the line, does not jump branches at the crossing, stops short of the arrowhead, snaps back to the middle. Reload: it keeps its place.

**Acceptance Scenarios**:

1. **Given** a label, **When** it is dragged, **Then** it slides along the arrow under the pointer and never leaves the line.
2. **Given** a label dragged toward an end, **Then** it stops before covering the arrowhead or the element.
3. **Given** an arrow that crosses itself, **When** the label is dragged through the crossing, **Then** it stays on the branch it was on.
4. **Given** a label dragged near the middle, **Then** it snaps to the middle.
5. **Given** a moved label, **When** the elements move, **Then** it keeps its share of the arrow's length.

### User Story 3 - An agent names its arrows (Priority: P2)

An agent that lays out a dependency map through MCP connects two cards with the label "blocks".

**Independent Test**: with a write key, `POST` an arrow with `label`: it appears labeled on the open board. `GET` returns `label`. `PATCH` changes it; `PATCH` on a person's arrow is refused.

## Requirements *(mandatory)*

- **FR-001**: An editor MUST add a label to an arrow by double-click, by `Enter` on a selected arrow and by "Add label" in the selection bar; one label per arrow.
- **FR-002**: A label MUST be removed when its text is empty after editing; text MUST be at most 500 characters.
- **FR-003**: A label's place MUST be stored as a share of the arrow's length (0 to 1, absent for the middle) and kept when the arrow is redrawn.
- **FR-004**: Dragging a label MUST keep it on the arrow, MUST NOT jump to another branch where the arrow curls or crosses itself, MUST keep it off both ends and MUST snap to the middle.
- **FR-005**: Label text MUST stay level, MUST wrap at 240 board pixels, and the line MUST be cut under it.
- **FR-006**: The selection bar MUST set a label's fill and text size for every selected arrow in one undo step.
- **FR-007**: Labels MUST take part in live editing, undo, copy, duplicate, search, the far view, view-only boards, public links and board transfer.
- **FR-008**: Boards saved before this spec MUST read unchanged; an arrow without a label MUST store nothing new.
- **FR-009**: API v1 and MCP MUST read every arrow's label and MUST write it on arrows the key's person added through the API.

## Testing

- **Domain tests**: an arrow with and without a label validates; text over 500 characters and a share outside 0..1 are refused; boards saved before validate unchanged; transfer keeps labels; the API view gives `label`.
- **Frontend unit tests**: the path flattened to points; the point at a share on straight, hooked and self-crossing arrows; the drag projection stays on its branch through a crossing and moves to another part only when clearly closer; the clamp keeps the label box off both ends; snap to the middle; a label wider than its arrow stays in the middle.
- **Frontend component tests**: double-click adds an empty label being edited; `Enter`, `Shift+Enter`, `Esc`; empty text removes it; Undo; the bar's Fill and Text size; view-only shows the label and no editor; search lists a label.
- **API tests**: `POST` an arrow with `label`, `PATCH` its label, refusal on a person's arrow and on a change of ends; OpenAPI snapshot grows only by additions.
- **By hand**: straight, hooked, S-shaped and self-crossing arrows, arrows on turned elements and dangling arrows, light and dark, near and far zoom; screenshots in the PR.
- `make check`, `make smoke`.

## Slices

1. `arrow-labels`: Decisions 1–3 and 6–16, labels in the middle; API v1 reads `label`; guide page On the board; CHANGELOG.
2. `arrow-label-drag`: Decisions 4 and 5; guide; CHANGELOG.
3. `arrow-label-api`: Decision 17's writes through API v1 and MCP; contract; guide API reference; CHANGELOG.

## Out of scope

- More than one label per arrow, labels at the ends ("1", "many").
- Arrow color, width, dashes, heads, bent or freehand arrows.
- Text color, bold, alignment, rich text in labels.
- Placing a label off the line (above or beside it).
- Labels in the board preview on Home and in the minimap.
- Labels that mean something to tiko, such as a link type that changes a task or the tracker.
- The place, fill and size of a label through the API.

## Owner's answers (G2, 2026-11-21)

1. **Color is a fill**, a chip in a sticky color, not a text color (Decision 9).
2. **A new label appears in the middle**; the drag moves it (Decision 1).
3. **`Esc` keeps the text**, as every text on the board does; Undo takes it back (Decision 2).
4. **Medium is 14px**, so Small, Medium and Large match shapes (Decision 9).
5. **Agents label only the arrows they added**, the rule v1 has for text and colour (Decision 17).
6. **An older tiko drops labels on import** instead of refusing the file; the guide says so (Decision 16).
