import githubMarkDark from '@/sources/marks/github-dark.svg'
import githubMark from '@/sources/marks/github.svg'
import jiraMark from '@/sources/marks/jira.svg'

/** What a person connects in My tracker when the tracker is read with one token of their own. */
type TokenForm = {
  /** The field's label: "GitHub token". */
  label: string
  /** What the token gives, said above the field. */
  intro: string
  /** The hint while no token is stored. */
  none: string
  /** A page that says which token to create. */
  guide: string
}

type Source = {
  /** The tracker's name inside a sentence: "Open in Jira". */
  name: string
  /** The tracker's own logo file, shown as it is and never recolored; the demo has none. */
  mark?: string
  /** The owner's own file for dark backgrounds, when one file does not suit both themes. */
  markDark?: string
  /** The key as a card shows it, when it is not the key itself. */
  shortKey?: (key: string, listName?: string) => string
  /** A key only this tracker uses, as a regular expression without anchors; typed or pasted
   *  on any instance it is this tracker's. Its last part is the number, for ranges. */
  keyPattern?: { prefix: string; number: string }
  /** A link to one of its tasks, as a regular expression without anchors. */
  linkPattern?: string
  /** What a person connects to read it: an account, or a token of their own. */
  credential?: 'account' | 'token'
  token?: TokenForm
}

const GITHUB_REPO = '[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9._-]+'

/** The trackers tiko reads tasks from, as the web app names and marks them. */
const SOURCES: Record<string, Source> = {
  jira: { name: 'Jira', mark: jiraMark },
  github: {
    name: 'GitHub',
    mark: githubMark,
    markDark: githubMarkDark,
    // Without its owner: `repo#12`.
    shortKey: (key) => key.slice(key.indexOf('/') + 1),
    keyPattern: { prefix: `${GITHUB_REPO}#`, number: '[1-9]\\d*' },
    linkPattern: `https?://(www\\.)?github\\.com/${GITHUB_REPO}/(issues|pull)/[1-9]\\d*([/?#]\\S*)?`,
    token: {
      label: 'GitHub token',
      intro:
        'With your own token you see issues and pull requests of private repositories it can read, ' +
        'and your GitHub cards refresh on your own request limit. Other people on a board see a ' +
        'private task only with a token of their own. A fine-grained token needs the repositories ' +
        'picked and read-only access to Issues and Pull requests.',
      none: 'No token yet. Public issues and pull requests work without one.',
      guide: 'https://docs.tiko.run/github-issues/#your-own-token',
    },
  },
  caldav: {
    name: 'CalDAV',
    // By its list: a CalDAV id is long and means nothing to people.
    shortKey: (_key, listName) => listName || 'Task',
    credential: 'account',
  },
  demo: { name: 'the demo tracker' },
}

export function sourceName(id: string) {
  return SOURCES[id]?.name ?? 'the tracker'
}

export function sourceMark(id: string) {
  return Object.hasOwn(SOURCES, id) ? SOURCES[id] : undefined
}

/** The key as a card shows it. */
export function shortKey(source: string | undefined, key: string, listName?: string) {
  const found = source && Object.hasOwn(SOURCES, source) ? SOURCES[source] : undefined
  return found?.shortKey ? found.shortKey(key, listName) : key
}

/** What a person connects to read the tracker: an account for CalDAV, a token elsewhere. */
export function credentialName(id: string) {
  return SOURCES[id]?.credential === 'account' ? 'account' : 'token'
}

/** Whether this version knows the tracker; a board from a newer tiko may name one it does not. */
export function isKnownSource(id: string) {
  return Object.hasOwn(SOURCES, id)
}

/** The keys of trackers read on any instance, as a regular expression without anchors. */
export const OWN_KEY_PATTERNS = Object.values(SOURCES).flatMap((s) =>
  s.keyPattern ? [`${s.keyPattern.prefix}${s.keyPattern.number}`] : [],
)

/** Their key prefixes, for ranges like `owner/repo#3 – #9`. */
export const OWN_KEY_PREFIXES = Object.values(SOURCES).flatMap((s) =>
  s.keyPattern ? [s.keyPattern.prefix] : [],
)

/** Links to their tasks. */
export const OWN_LINK_PATTERNS = Object.values(SOURCES).flatMap((s) =>
  s.linkPattern ? [s.linkPattern] : [],
)

/** The trackers a person connects with one token of their own, in the order My tracker lists them. */
export const TOKEN_SOURCES = Object.entries(SOURCES).flatMap(([id, s]) =>
  s.token ? [{ id, name: s.name, ...s.token }] : [],
)
