import type { LanguageRegistration } from 'shiki/core'

export const CODE_MAX_CHARS = 10_000

type Grammar = () => Promise<{ default: LanguageRegistration[] }>

// Literal imports, so the bundler makes one chunk per language and loads it on first use.
const GRAMMARS = {
  plain: null,
  bash: () => import('shiki/langs/bash.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  hcl: () => import('shiki/langs/hcl.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
} satisfies Record<string, Grammar | null>

export type CodeLanguage = keyof typeof GRAMMARS

export const LANGUAGE_NAMES: Record<CodeLanguage, string> = {
  plain: 'Plain text',
  bash: 'Bash',
  c: 'C',
  csharp: 'C#',
  cpp: 'C++',
  css: 'CSS',
  dockerfile: 'Dockerfile',
  go: 'Go',
  graphql: 'GraphQL',
  hcl: 'HCL',
  html: 'HTML',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  kotlin: 'Kotlin',
  markdown: 'Markdown',
  php: 'PHP',
  powershell: 'PowerShell',
  python: 'Python',
  ruby: 'Ruby',
  rust: 'Rust',
  sql: 'SQL',
  swift: 'Swift',
  toml: 'TOML',
  tsx: 'TSX',
  typescript: 'TypeScript',
  xml: 'XML',
  yaml: 'YAML',
}

export const LANGUAGES = Object.keys(LANGUAGE_NAMES) as CodeLanguage[]

export const grammarOf = (language: CodeLanguage): Grammar | null => GRAMMARS[language]

// Short names people type for a language; the picker finds the language by them too.
const ALIASES: Partial<Record<CodeLanguage, string[]>> = {
  bash: ['sh', 'shell', 'zsh'],
  csharp: ['cs'],
  cpp: ['c++'],
  dockerfile: ['docker'],
  go: ['golang'],
  hcl: ['terraform', 'tf'],
  javascript: ['js', 'jsx'],
  markdown: ['md'],
  plain: ['text', 'txt'],
  powershell: ['ps', 'pwsh'],
  python: ['py'],
  ruby: ['rb'],
  rust: ['rs'],
  typescript: ['ts'],
  yaml: ['yml'],
}

/** Languages for what was typed: exact names first, then names that start with it, then the rest that hold it. */
export function matchLanguages(query: string): CodeLanguage[] {
  const typed = query.trim().toLowerCase()
  if (!typed) return LANGUAGES
  const words = (language: CodeLanguage) => [
    LANGUAGE_NAMES[language].toLowerCase(),
    ...(ALIASES[language] ?? []),
  ]
  const rank = (language: CodeLanguage) => {
    const all = words(language)
    if (all.includes(typed)) return 0
    if (all.some((word) => word.startsWith(typed))) return 1
    return all.some((word) => word.includes(typed)) ? 2 : 3
  }
  // A stable sort keeps the list's own order inside each rank.
  return LANGUAGES.filter((language) => rank(language) < 3).sort((a, b) => rank(a) - rank(b))
}
