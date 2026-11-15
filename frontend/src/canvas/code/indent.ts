export const INDENT = '  '

export type Edit = {
  /** The range of the old text to replace, and what goes there. */
  from: number
  to: number
  insert: string
  /** The selection after the edit. */
  start: number
  end: number
}

/** Tab with no selection inserts an indent; otherwise every touched line moves in or out. */
export function indent(value: string, start: number, end: number, out: boolean): Edit | null {
  if (!out && start === end) {
    return { from: start, to: end, insert: INDENT, start: start + 2, end: start + 2 }
  }
  // lastIndexOf clamps a negative position to 0 and would find a break at index 0.
  const from = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1
  // A selection that ends right after a line break leaves the next line alone.
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end
  const lineEnd = value.indexOf('\n', last)
  const to = lineEnd === -1 ? value.length : lineEnd
  const lines = value.slice(from, to).split('\n')
  const shifts = lines.map((line) =>
    out ? -Math.min(2, line.length - line.trimStart().length) : 2,
  )
  if (shifts.every((shift) => shift === 0)) return null
  const insert = lines
    .map((line, i) => (shifts[i] > 0 ? INDENT + line : line.slice(-shifts[i])))
    .join('\n')
  const total = shifts.reduce((sum, shift) => sum + shift, 0)
  // An end inside the removed indent of its line stops at that line's new start.
  const lastStart =
    from + lines.slice(0, -1).reduce((sum, line, i) => sum + line.length + 1 + shifts[i], 0)
  const startAt = Math.max(from, start + shifts[0])
  return { from, to, insert, start: startAt, end: Math.max(lastStart, startAt, end + total) }
}
