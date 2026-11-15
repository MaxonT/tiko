import { expect, test } from 'vitest'
import type { Task } from '@/api/tasks'
import { leafDone, progress, tickRow } from '@/modules/gantt/done'
import type { Row } from '@/modules/gantt/rows'
import type { GanttContent } from '@/modules/gantt/schema'

const task = (key: string, change: Partial<Task> = {}): Task => ({
  source: 'demo',
  key,
  state: 'ok',
  summary: 'Rotate the staging certificates',
  status_name: 'Done',
  status_category: 'done',
  type_name: 'Task',
  assignee_name: null,
  priority_name: null,
  updated: null,
  url: '',
  fetched_at: '',
  ...change,
})

const row = (id: string, change: Partial<Row> = {}): Row => ({
  id,
  title: id,
  start: '2026-10-05',
  end: '2026-10-09',
  ...change,
})

const gantt = (rows: Row[]): GanttContent => ({
  start: '2026-10-01',
  end: '2026-12-31',
  scale: 'week',
  labelWidth: 160,
  rows,
  milestones: [],
  links: [],
})

test('a task row is done by its tracker, a plain row by its tick', () => {
  expect(leafDone(row('a', { done: true }), undefined)).toBe(true)
  expect(leafDone(row('a'), undefined)).toBe(false)
  expect(leafDone(row('t', { key: 'DEMO-1' }), task('DEMO-1'))).toBe(true)
  expect(leafDone(row('t', { key: 'DEMO-1' }), task('DEMO-1', { status_category: 'new' }))).toBe(
    false,
  )
  expect(leafDone(row('t', { key: 'DEMO-1' }), task('DEMO-1', { state: 'no_token' }))).toBe(false)
  expect(leafDone(row('t', { key: 'DEMO-1' }), undefined)).toBe(false)
})

test('progress counts the leaves of the whole branch, task rows included', () => {
  const rows = [
    row('p'),
    row('a', { parent: 'p', done: true }),
    row('b', { parent: 'p', key: 'DEMO-1' }),
    row('q', { parent: 'p', done: true }),
    row('c', { parent: 'q' }),
    row('x', { done: true }),
  ]
  const taskOf = (r: Row) => (r.key ? task(r.key) : undefined)
  // q has a child, so its own tick is kept but not counted.
  expect(progress(rows, 0, taskOf)).toEqual({ done: 2, total: 3 })
  expect(progress(rows, 3, taskOf)).toEqual({ done: 0, total: 1 })
})

test('ticking stores done, unticking removes it, a task row is left alone', () => {
  const content = gantt([row('a'), row('t', { key: 'DEMO-1' })])
  const ticked = tickRow(content, 'a', true)
  expect(ticked.rows[0].done).toBe(true)
  expect('done' in tickRow(ticked, 'a', false).rows[0]).toBe(false)
  expect(tickRow(content, 't', true).rows[1]).toBe(content.rows[1])
})
