import { expect, test } from 'vitest'
import { LANGUAGES, matchLanguages } from './languages'

test('exact names first, then names that start with what was typed', () => {
  expect(matchLanguages('s').slice(0, 3)).toEqual(['bash', 'sql', 'swift'])
  expect(matchLanguages('c').slice(0, 4)).toEqual(['c', 'csharp', 'cpp', 'css'])
  expect(matchLanguages('script')).toEqual(['javascript', 'typescript'])
})

test('short names find their language', () => {
  expect(matchLanguages('ts')).toEqual(['typescript', 'tsx'])
  expect(matchLanguages('py')).toEqual(['python'])
  expect(matchLanguages('TF')).toEqual(['hcl'])
  expect(matchLanguages('c++')).toEqual(['cpp'])
})

test('nothing typed lists every language', () => {
  expect(matchLanguages(' ')).toEqual(LANGUAGES)
  expect(matchLanguages('cobol')).toEqual([])
})
