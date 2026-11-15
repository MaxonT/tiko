import type { CodeLanguage } from '@/canvas/code/languages'

const SHEBANG: [RegExp, CodeLanguage][] = [
  [/\b(ba|z|da)?sh\b/, 'bash'],
  [/\bpython/, 'python'],
  [/\b(node|deno|bun)\b/, 'javascript'],
  [/\bpwsh\b/, 'powershell'],
  [/\bruby\b/, 'ruby'],
]

// Signs no other language of the list shares, tried in order; the first that fits wins.
const SIGNS: [CodeLanguage, (code: string) => boolean][] = [
  ['php', (c) => /^\s*<\?php/.test(c)],
  ['xml', (c) => /^\s*<\?xml/.test(c)],
  ['html', (c) => /<!doctype html|<html[\s>]|<(div|body|head|span|p)[\s>]/i.test(c)],
  [
    'dockerfile',
    (c) => /^\s*FROM\s+\S+/m.test(c) && /^\s*(RUN|CMD|COPY|ENTRYPOINT|WORKDIR|ENV)\s/m.test(c),
  ],
  ['hcl', (c) => /^\s*(resource|variable|provider|module|terraform|output|data)\s+"/m.test(c)],
  ['go', (c) => /^\s*package\s+\w+\s*$/m.test(c) && /\bfunc\b/.test(c)],
  ['rust', (c) => /\bfn\s+\w+/.test(c) && /\blet\s+(mut\s+)?\w+|println!|::/.test(c)],
  ['csharp', (c) => /\busing\s+System|Console\.Write(Line)?\(|\bnamespace\s+[\w.]+/.test(c)],
  ['java', (c) => /\bpublic\s+(static\s+)?(class|void)\b|System\.out\.print/.test(c)],
  ['cpp', (c) => /#include\s*</.test(c) && /std::|\bcout\b|template\s*</.test(c)],
  ['c', (c) => /#include\s*</.test(c)],
  ['kotlin', (c) => /\bfun\s+\w+\s*\(/.test(c) && /\b(val|var)\s+\w+/.test(c)],
  [
    'swift',
    (c) => /\bfunc\s+\w+\s*\(/.test(c) && /\b(let|var)\s+\w+/.test(c) && !/\bpackage\b/.test(c),
  ],
  [
    'sql',
    (c) =>
      /^\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|ALTER\s+TABLE|WITH)\b/im.test(
        c,
      ),
  ],
  ['graphql', (c) => /^\s*(query|mutation|subscription|fragment)\b[^{]*\{/m.test(c)],
  [
    'python',
    (c) =>
      /^\s*from\s+[\w.]+\s+import\s/m.test(c) ||
      /^\s*(async\s+)?def\s+\w+\(.*\)\s*(->.*)?:\s*$/m.test(c) ||
      /^\s*class\s+\w+(\(.*\))?:\s*$/m.test(c) ||
      /^\s*print\(/m.test(c),
  ],
  ['ruby', (c) => /^\s*def\s+\w+/m.test(c) && /^\s*end\s*$/m.test(c)],
  ['powershell', (c) => /\b(Get|Set|New|Remove|Write)-[A-Z]\w+/.test(c)],
  ['tsx', (c) => /<[A-Z]\w*[\s/>]/.test(c) && /:\s*\w+(\[\])?\s*[,)=]|\binterface\s/.test(c)],
  [
    'typescript',
    (c) => /\binterface\s+\w+\s*\{|\btype\s+\w+\s*=|:\s*(string|number|boolean|void)\b/.test(c),
  ],
  [
    'javascript',
    (c) => /\b(const|let|function)\s+\w+|=>|console\.log|require\(|\bexport\s+default/.test(c),
  ],
  ['markdown', (c) => /^#{1,6}\s+\S/m.test(c) || /^```/m.test(c)],
  ['toml', (c) => /^\s*\[[\w.-]+\]\s*$/m.test(c) && /^\s*[\w.-]+\s*=\s*\S/m.test(c)],
  ['css', (c) => /^[^{}]+\{\s*[\w-]+\s*:\s*[^;{}]+;/m.test(c)],
  [
    'bash',
    (c) =>
      /^\s*(\$\s+)?(sudo|curl|wget|apt(-get)?|brew|docker|kubectl|git|cd|echo|export|npm|pip|make|ssh|cat|ls)\b/m.test(
        c,
      ),
  ],
  [
    'yaml',
    // Two keys at least: one "Note: call legal" is a sentence, not YAML.
    (c) =>
      /^---\s*$/m.test(c) ||
      ((c.match(/^\s*-?\s*[\w.-]+:(\s|$)/gm)?.length ?? 0) >= 2 && !/[{};]/.test(c)),
  ],
]

/** The language a piece of code is plainly written in, or plain text when nothing is sure. */
export function detectLanguage(code: string): CodeLanguage {
  const text = code.trim()
  if (!text) return 'plain'
  const shebang = /^#!(.*)$/m.exec(text.split('\n', 1)[0])
  if (shebang) {
    const found = SHEBANG.find(([pattern]) => pattern.test(shebang[1]))
    if (found) return found[1]
  }
  if (/^[[{]/.test(text)) {
    try {
      JSON.parse(text)
      return 'json'
    } catch {
      // Not JSON; the signs below decide.
    }
  }
  return SIGNS.find(([, fits]) => fits(text))?.[0] ?? 'plain'
}
