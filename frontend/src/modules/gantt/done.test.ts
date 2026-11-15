import { expect, test } from 'vitest'
import type { Task } from '@/api/tasks'
import { leafDone, progress, syncDone, tickRow, tickStage } from '@/modules/gantt/done'
import { shownStages } from '@/modules/gantt/stages'
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

const staged = (done?: boolean): Row =>
  row('a', {
    start: '2026-10-05',
    end: '2026-10-16',
    stages: [
      { id: 's1', type: 't1', start: '2026-10-05', end: '2026-10-07', people: [] },
      {
        id: 's2',
        type: 't1',
        start: '2026-10-12',
        end: '2026-10-16',
        people: [],
        ...(done && { done }),
      },
    ],
  })

test('ticking a row with stages ticks them all, so Planning on and off agree', () => {
  const ticked = tickRow(gantt([staged()]), 'a', true).rows[0]
  expect(ticked.done).toBe(true)
  expect(ticked.stages!.every((s) => s.done)).toBe(true)
  const back = tickRow(gantt([ticked]), 'a', false).rows[0]
  expect(back.stages!.some((s) => 'done' in s)).toBe(false)
})

test('a row tiko owns is done exactly when every stage is', () => {
  const one = tickStage(staged(), 's1', true)
  expect(syncDone(gantt([one])).rows[0].done).toBeUndefined()
  const both = tickStage(one, 's2', true)
  expect(syncDone(gantt([both])).rows[0].done).toBe(true)
  // A new stage that is not done unticks the row.
  const more = {
    ...both,
    done: true,
    stages: [
      ...both.stages!,
      { id: 's3', type: 't1', start: '2026-10-19', end: '2026-10-20', people: [] },
    ],
  }
  expect('done' in syncDone(gantt([more])).rows[0]).toBe(false)
  // A task row's stages never tick the row: the tracker does.
  const task = { ...both, key: 'DEMO-1' }
  expect(syncDone(gantt([task])).rows[0].done).toBeUndefined()
})

test('a ticked row keeps its tick when its bar becomes its first stage', () => {
  expect(shownStages(row('a', { done: true }))[0].done).toBe(true)
  expect(shownStages(row('a', { key: 'DEMO-1' }))[0].done).toBeUndefined()
})
