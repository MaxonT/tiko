/**
 * Marked lines after an edit: each mark moves with its line, found by its text nearest to where
 * it was, or in place when only its text changed. A line that is gone loses its mark; marks are
 * counted from 1 and come back in order.
 */
export function followMarks(before: string, after: string, marked: number[]): number[] {
  const old = before.split('\n')
  const next = after.split('\n')
  const shift = next.length - old.length
  const taken = new Set<number>()
  for (const line of marked) {
    const text = old[line - 1]
    if (text === undefined) continue
    // Lines added above push a line down by the same count, so look there first.
    const expected = line - 1 + shift
    let best = -1
    for (let i = 0; i < next.length; i++) {
      if (next[i] !== text || taken.has(i)) continue
      const near = Math.min(Math.abs(i - (line - 1)), Math.abs(i - expected))
      const bestNear =
        best < 0 ? Infinity : Math.min(Math.abs(best - (line - 1)), Math.abs(best - expected))
      if (near < bestNear) best = i
    }
    // A line fixed in place, with no lines added or gone, keeps its mark.
    if (best < 0 && shift === 0) best = line - 1
    if (best >= 0) taken.add(best)
  }
  return [...taken].map((i) => i + 1).sort((a, b) => a - b)
}
