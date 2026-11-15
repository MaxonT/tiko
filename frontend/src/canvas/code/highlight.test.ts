import { describe, expect, it } from 'vitest'
import { LANGUAGES } from './languages'
import { prepare, tokenize } from './highlight'

describe('highlight', () => {
  it('colors code once its language is loaded', async () => {
    expect(tokenize('x = 1', 'python')).toBeNull()
    await prepare('python')
    const lines = tokenize('def f():\n    return 1', 'python')!
    expect(lines.map((line) => line.map((t) => t.content).join(''))).toEqual([
      'def f():',
      '    return 1',
    ])
    const def = lines[0].find((t) => t.content === 'def')
    // Both palettes ride on each token, and the dark one is a different color.
    expect(def?.light).toMatch(/^#[0-9A-Fa-f]{6}/)
    expect(def?.dark).toMatch(/^#[0-9A-Fa-f]{6}/)
    expect(def?.dark).not.toBe(def?.light)
  })

  it('loads every language of the list', async () => {
    const coded = LANGUAGES.filter((language) => language !== 'plain')
    await Promise.all(coded.map(prepare))
    for (const language of coded) {
      expect(tokenize('a', language), language).not.toBeNull()
    }
  }, 30_000)
})
