import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Task } from '@/api/tasks'
import type { AppNode } from '@/canvas/types'
import { missingTasks, useArrivedTasks } from './useArrivedTasks'

const card = (key: string): AppNode =>
  ({
    id: key,
    type: 'task_card',
    position: { x: 0, y: 0 },
    data: { key, source: 'demo' },
  }) as AppNode
const task = (key: string) => ({ key, source: 'demo' }) as Task
const known = (...keys: string[]) => Object.fromEntries(keys.map((k) => [`demo:${k}`, task(k)]))

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(nodes: AppNode[], tasks: Record<string, Task>) {
  const refresh = vi.fn()
  const hook = renderHook(({ nodes, tasks }) => useArrivedTasks(nodes, tasks, refresh), {
    initialProps: { nodes, tasks },
  })
  return { refresh, rerender: hook.rerender }
}

test('lists the cards whose task is not there', () => {
  expect(missingTasks([card('A-1'), card('A-2')], known('A-1'))).toEqual(['demo:A-2'])
})

test('cards that arrive without their tasks refresh once for the whole burst', () => {
  const { refresh, rerender } = setup([card('A-1')], known('A-1'))
  rerender({ nodes: [card('A-1'), card('A-2')], tasks: known('A-1') })
  rerender({ nodes: [card('A-1'), card('A-2'), card('A-3')], tasks: known('A-1') })
  vi.advanceTimersByTime(300)
  expect(refresh).toHaveBeenCalledTimes(1)
})

test('what was missing at open waits for the first poll', () => {
  const { refresh, rerender } = setup([card('A-1')], {})
  rerender({ nodes: [card('A-1')], tasks: {} })
  vi.runAllTimers()
  expect(refresh).not.toHaveBeenCalled()
})

test('a card the board had not saved yet is asked for again after the save', () => {
  const { refresh, rerender } = setup([], {})
  rerender({ nodes: [card('A-2')], tasks: {} })
  vi.advanceTimersByTime(300)
  vi.advanceTimersByTime(2_200)
  expect(refresh).toHaveBeenCalledTimes(2)
  rerender({ nodes: [card('A-2')], tasks: known('A-2') })
  vi.runAllTimers()
  expect(refresh).toHaveBeenCalledTimes(2)
})

test('a task that never comes is asked for three times, not more', () => {
  const { refresh, rerender } = setup([], {})
  rerender({ nodes: [card('A-2')], tasks: {} })
  vi.runAllTimers()
  rerender({ nodes: [card('A-2')], tasks: known('A-9') })
  vi.runAllTimers()
  expect(refresh).toHaveBeenCalledTimes(3)
})

test('a card that comes with its task asks for nothing', () => {
  const { refresh, rerender } = setup([], {})
  rerender({ nodes: [card('A-1')], tasks: known('A-1') })
  vi.runAllTimers()
  expect(refresh).not.toHaveBeenCalled()
})
