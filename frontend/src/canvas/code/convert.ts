import { CODE_MAX_CHARS } from '@/canvas/code/languages'
import type { AppNode } from '@/canvas/types'

const TEXT_MAX = 5000
const MIN_CODE_WIDTH = 200

export type Conversion = { to: 'code' | 'text'; node: AppNode }

/**
 * A text or sticky as a code block, or a code block as a text: same id, place and frame, so
 * arrows and timers stay on it. Null when the element has no such twin or its text would not fit.
 */
export function conversionOf(node: AppNode): Conversion | null {
  const { id, position, parentId, selected } = node
  const base = { id, position, parentId, selected }
  if (node.type === 'text' || node.type === 'sticky') {
    if (node.data.text.length > CODE_MAX_CHARS) return null
    const width = Math.max(node.width ?? node.measured?.width ?? 480, MIN_CODE_WIDTH)
    return {
      to: 'code',
      node: { ...base, type: 'code', width, data: { text: node.data.text, language: 'plain' } },
    }
  }
  if (node.type === 'code') {
    // The title becomes the first line, so turning into text loses nothing.
    const text = node.data.title ? `${node.data.title}\n${node.data.text}` : node.data.text
    if (text.length > TEXT_MAX) return null
    return { to: 'text', node: { ...base, type: 'text', width: node.width, data: { text } } }
  }
  return null
}
