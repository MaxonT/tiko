import { expect, test } from 'vitest'
import { followMarks } from './marks'

const code = 'package main\n\nfunc main() {\n\tfmt.Println("tiko")\n}'

test('a mark moves down with its line when lines come above it', () => {
  expect(followMarks(code, `// top\n${code}`, [4])).toEqual([5])
})

test('a mark moves up when lines above it go', () => {
  expect(followMarks(code, code.replace('package main\n\n', ''), [4])).toEqual([2])
})

test('a mark stays on a line fixed in place, and goes with a line that is gone', () => {
  expect(followMarks(code, code.replace('"tiko"', '"tiko!"'), [4])).toEqual([4])
  expect(followMarks(code, code.replace('\tfmt.Println("tiko")\n', ''), [4])).toEqual([])
  expect(followMarks(code, code, [1, 4])).toEqual([1, 4])
})

test('two equal lines keep their own marks', () => {
  expect(followMarks('a\nx\nb\nx', 'new\na\nx\nb\nx', [2, 4])).toEqual([3, 5])
})

test('a mark past the last line is dropped', () => {
  expect(followMarks('a\nb', 'a\nb', [7])).toEqual([])
})

test('a mark on a repeated line follows its own line when lines come above', () => {
  expect(followMarks('a\nx\nb\nx', 'new\nnew\na\nx\nb\nx', [4])).toEqual([6])
  expect(followMarks('a\nx\nb\nx', 'a\nx\nb\nx\nnew\nnew', [2])).toEqual([2])
})
