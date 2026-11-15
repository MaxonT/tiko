import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import dark from 'shiki/themes/github-dark.mjs'
import light from 'shiki/themes/github-light.mjs'
import { grammarOf, type CodeLanguage } from '@/canvas/code/languages'

/** Colors of both themes: the page's `.dark` class picks one, so they never disagree with it. */
export type Token = {
  content: string
  light?: string
  dark?: string
  italic?: boolean
  bold?: boolean
}

const THEMES = { light: 'github-light', dark: 'github-dark' } as const
// Shiki's FontStyle flags.
const ITALIC = 1
const BOLD = 2

let core: Promise<HighlighterCore> | null = null
let shiki: HighlighterCore | null = null
const grammars = new Map<CodeLanguage, Promise<void>>()
const loaded = new Set<CodeLanguage>()

/** Loads the highlighter and the language once; later calls wait for the same load. */
export function prepare(language: CodeLanguage): Promise<void> {
  const grammar = grammarOf(language)
  if (!grammar) return Promise.resolve()
  // The JavaScript engine needs no WebAssembly, so the page's script policy stays as it is.
  core ??= createHighlighterCore({
    themes: [light, dark],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  }).then((made) => (shiki = made))
  let load = grammars.get(language)
  if (!load) {
    load = Promise.all([core, grammar()]).then(async ([made, module]) => {
      await made.loadLanguage(...module.default)
      loaded.add(language)
    })
    // A failed load may be tried again, say after the network comes back.
    load.catch(() => grammars.delete(language))
    grammars.set(language, load)
  }
  return load
}

/** Lines of colored tokens, or null while the language is not loaded. */
export function tokenize(text: string, language: CodeLanguage): Token[][] | null {
  if (!shiki || !loaded.has(language)) return null
  const lines = shiki.codeToTokensWithThemes(text, { lang: language, themes: THEMES })
  return lines.map((line) =>
    line.map(({ content, variants }) => {
      // Both GitHub themes style a token alike; only the colors differ.
      const style = variants.light.fontStyle ?? 0
      return {
        content,
        light: variants.light.color,
        dark: variants.dark.color,
        italic: (style & ITALIC) !== 0 || undefined,
        bold: (style & BOLD) !== 0 || undefined,
      }
    }),
  )
}
