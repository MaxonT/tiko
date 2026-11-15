# Writing the guide

The guide at docs.tiko.run is [Starlight](https://starlight.astro.build). Pages live in `src/content/docs/`, the sidebar in `astro.config.mjs`. Run it with `npm run dev` in this folder.

These rules hold for every page. A page that breaks one is fixed when it is next touched.

## Who reads it

- **People** come from search or a link with one question, in the middle of a task. They scan headings and the first line under each, and stop reading once they have the answer.
- **AI agents** read a page's Markdown twin (`/<page>.md`, the Copy page button) or several pages in a row. They see every tab, cannot see pictures, and rarely follow links.

So every page, and every section on it, answers its question without the rest of the guide.

## Page types

Each page is one type. The type sets its shape.

| Type | Answers | Pages | Shape |
|---|---|---|---|
| Tutorial | Get me from nothing to working | Install, Quick start | One path, `<Steps>`, the result shown at the end |
| Feature | How do I do X in tiko? | Adding tasks, Home, Working together, Gantt | A heading per task the reader does |
| Setup | How do I connect or run X? | Trackers, Configuration, Updates, Monitoring | Before you start, steps, check, troubleshooting |
| Reference | What exactly is X? | Keyboard shortcuts, What you can add, API | Tables and lists, prose only to introduce them |
| Explanation | Why or how does X work? | Why tiko, Architecture, Security, Privacy | Prose under headings that state the point |

### Feature page

1. **Title** names the thing (`Working together`), **description** says what it lets you do in one sentence.
2. **Lead**: one or two sentences, what it is and when you need it. A clip or picture right after, when the feature is visual.
3. **One `##` per task**, starting with a verb: `Share a board`, `Vote on notes`. Under it, how to do it first, then rules and limits.
4. **Related** at the end: `<CardGrid>` of `<LinkCard>` to the pages that continue the topic, when there are two or more.

### Setup page

1. **Before you start**: what the reader needs, as a list (versions, rights, a token).
2. **Steps**: `<Steps>`, one action per step, the exact button or command in it.
3. **Check it works**: what the reader should see.
4. **Options**: a table, when there are any.
5. **When something goes wrong**: a table of symptom, cause and fix.

## Text

- **Answer first.** The first sentence under a heading says what to do or what is true; the detail follows.
- **A paragraph holds one idea in at most three sentences.** Four related facts are a list, not a paragraph.
- **A heading every 150–250 words.** No stretch longer than about 300 words without a heading, a list or a table.
- **A page of 300–900 words.** Over 1200, split it: a nested group with an Overview, or a second page.
- **Second person, present tense, US spelling.** "You drag the card", not "the user can drag".
- **Exact numbers with units**: "up to 25 MB", "every 30 seconds". No "simply", "just", "easily".
- **"Your tracker"**, not a tracker's name, except on the page of that tracker and in lists of integrations.

## Formatting

| What | How | Example |
|---|---|---|
| A button, menu or setting | Bold, as the UI shows it; a path with `→` | **Settings → API keys** |
| A shortcut | Code, Mac first, the other systems in brackets | `⌘V` (`Ctrl+V`) |
| A tool's key in a list | Bold name, the key after it | **Frames** (`F`) |
| A value the reader types, a file, a variable | Code | `TIKO_PORT`, `.env` |
| A term in a definition list | Bold, then a colon | **Viewers:** see the board, change nothing |

Headings use sentence case. No `#` inside a page: the title is the `h1`. Use `###` only under a `##` that has two or more of them.

## Elements

Use an element when it makes the page quicker to scan, never to decorate it.

| Element | Use it for | How |
|---|---|---|
| List | Three or more parallel items | `-`; a numbered list only when order matters |
| Table | Options, variables, commands, limits: anything read by row | Markdown table, a header row, no empty cells |
| Steps | An ordered procedure of three or more steps | `<Steps>` around a numbered list; `.mdx` only |
| Tabs | The same step done differently per system or method | `<Tabs syncKey="os">` with `<TabItem label="Linux">`; `.mdx` only |
| Callout | One thing the reader must not miss | `:::note[Title]` and the like, see below |
| Cards | Links to the pages that continue a topic | `<CardGrid>` with `<LinkCard>`; `.mdx` only |
| Details | A long edge case most readers skip | `<details><summary>…</summary>…</details>` |

Callouts by meaning, at most one per screen:

| Kind | When |
|---|---|
| `note` | A condition for the whole section: "Needs Planning", "Admins only" |
| `tip` | A shortcut that saves time |
| `caution` | Something that surprises or can go wrong, and can be undone |
| `danger` | Data loss or a security risk that cannot be undone |

- No headings inside tabs: the table of contents and search would point into a hidden panel. Every tab stays in the HTML, so search engines and the page's Markdown twin see all of them.
- Tabs with the same `syncKey` switch together across the page. Use the same labels everywhere: `Linux`, `macOS`, `Windows`.
- A list item longer than three sentences becomes its own `###`.

## Pictures and clips

- Feature pages get a clip or still near the top when the feature is something you see. They are shot at release with the operator skill, never by hand on a work system.
- Every picture has alt text that says what it shows. A fact that matters is also in the text: agents and screen readers do not see the picture.

## Links

- Relative links between guide pages: `../updates/`, `../data-and-upgrades/#pictures`.
- Link the first mention on a page, not every one. The link text names the target, never "here".
- When a section moves to another page, add its old anchor to `MOVED` in `src/components/Head.astro`, so old links still land.

## Structure

- Sidebar sections are fixed headings. A topic gets a nested group once it has three or more pages: `collapsed: true`, an `Overview` page first that ends with cards to the rest.
- `experimental: true` in a page's frontmatter adds an EXP badge in the sidebar and a notice under the title.
- `description` in the frontmatter is one sentence of what the page lets you do. Search and link cards show it.

## For agents

- **Sections stand alone.** Start a section with the thing's name, not "it" or "this". Repeat a condition where it applies: "With Planning on, …".
- **Nothing only in a picture, a tooltip or a tab label.**
- **Names stay the same** across pages: the UI's word for a thing, every time.

## Before a PR

- [ ] The page is one type and has that type's shape.
- [ ] No paragraph over three sentences, no 300 words without a heading, list or table.
- [ ] Callouts match their meaning, at most one per screen.
- [ ] Buttons bold, shortcuts and values in code, as the table above.
- [ ] `description` is one sentence; links are relative and name their target.
- [ ] `npm run build` passes; the page is checked in the light and the dark theme.
