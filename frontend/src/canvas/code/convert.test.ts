import { describe, expect, it } from 'vitest'
import type { AppNode } from '@/canvas/types'
import { conversionOf } from './convert'

const sticky: AppNode = {
  id: 's',
  type: 'sticky',
  position: { x: 10, y: 20 },
  parentId: 'f',
  width: 200,
  height: 200,
  data: { text: 'SELECT 1;', color: 'pink', bold: true },
}

describe('conversionOf', () => {
  it('turns a sticky into a code block in its place, without its look', () => {
    expect(conversionOf(sticky)).toEqual({
      to: 'code',
      node: {
        id: 's',
        type: 'code',
        position: { x: 10, y: 20 },
        parentId: 'f',
        selected: undefined,
        width: 200,
        data: { text: 'SELECT 1;', language: 'plain' },
      },
    })
  })

  it('turns a code block back into a text', () => {
    const code: AppNode = {
      id: 'k',
      type: 'code',
      position: { x: 0, y: 0 },
      width: 480,
      data: { title: 'Setup', text: 'a\n  b', language: 'python', collapsed: true },
    }
    expect(conversionOf(code)?.node).toMatchObject({
      type: 'text',
      width: 480,
      data: { text: 'Setup\na\n  b' },
    })
  })

  it('keeps a code block that a text could not hold', () => {
    const code: AppNode = {
      id: 'k',
      type: 'code',
      position: { x: 0, y: 0 },
      data: { text: 'x'.repeat(5001), language: 'plain' },
    }
    expect(conversionOf(code)).toBeNull()
  })

  it('has nothing for other elements', () => {
    const frame: AppNode = { id: 'f', type: 'frame', position: { x: 0, y: 0 }, data: { title: '' } }
    expect(conversionOf(frame)).toBeNull()
  })
})
