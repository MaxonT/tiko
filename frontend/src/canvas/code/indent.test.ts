import { describe, expect, it } from 'vitest'
import { indent } from './indent'

const apply = (value: string, start: number, end: number, out = false) => {
  const edit = indent(value, start, end, out)
  if (!edit) return null
  const text = value.slice(0, edit.from) + edit.insert + value.slice(edit.to)
  return { text, selected: text.slice(edit.start, edit.end) }
}

describe('indent', () => {
  it('inserts two spaces at the caret', () => {
    expect(apply('ab', 1, 1)).toEqual({ text: 'a  b', selected: '' })
  })

  it('moves every touched line in and keeps them selected', () => {
    expect(apply('a\nb\nc', 0, 3)).toEqual({ text: '  a\n  b\nc', selected: 'a\n  b' })
  })

  it('leaves the line after a selected line break alone', () => {
    expect(apply('a\nb', 0, 2)?.text).toBe('  a\nb')
  })

  it('moves lines out by up to two spaces', () => {
    expect(apply('    a\n b\nc', 6, 6, true)?.text).toBe('    a\nb\nc')
    expect(apply('    a\n b', 0, 8, true)?.text).toBe('  a\nb')
  })

  it('does nothing when nothing can move out', () => {
    expect(apply('a\nb', 0, 3, true)).toBeNull()
  })
})
