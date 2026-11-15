import type { Task } from '@/api/tasks'
import { updateRow, type Row } from '@/modules/gantt/rows'
import type { GanttContent } from '@/modules/gantt/schema'
import { subtreeEnd } from '@/modules/gantt/tree'

// Mirrors leaf_done and the progress of gantt_view in backend/app/domain/api_gantt.py.

/** A task row is done when its tracker says so; a row tiko owns, when it is ticked. */
export function leafDone(row: Row, task: Task | undefined) {
  if (row.key) return task?.state === 'ok' && task.status_category === 'done'
  // A row with stages is done when every stage is, whatever its stored flag says.
  if (row.stages?.length) return row.stages.every((s) => s.done === true)
  return row.done === true
}

/** Done leaves of the branch under rows[index], filters aside: a filter hides rows, not work. */
export function progress(
  rows: Row[],
  index: number,
  taskOf: (row: Row) => Task | undefined,
): { done: number; total: number } {
  const parents = new Set(rows.map((r) => r.parent))
  const leaves = rows.slice(index + 1, subtreeEnd(rows, index)).filter((r) => !parents.has(r.id))
  return { done: leaves.filter((r) => leafDone(r, taskOf(r))).length, total: leaves.length }
}

// Unticked, the field goes, so the content reads as it did before done marks.
function marked<T extends { done?: boolean }>(item: T, done: boolean): T {
  const { done: _old, ...rest } = item
  return (done ? { ...rest, done: true } : rest) as T
}

/** Ticks a row tiko owns, and every stage it has, so Planning on and off agree. */
export function tickRow(content: GanttContent, id: string, done: boolean): GanttContent {
  return updateRow(content, id, (row) => {
    if (row.key) return row
    const ticked = marked(row, done)
    return row.stages ? { ...ticked, stages: row.stages.map((s) => marked(s, done)) } : ticked
  })
}

/** Ticks one stage; a task row's stages too, as stages are the plan, not the tracker's. */
export function tickStage(row: Row, id: string, done: boolean): Row {
  if (!row.stages) return row
  return { ...row, stages: row.stages.map((s) => (s.id === id ? marked(s, done) : s)) }
}

/** A row tiko owns with stages is done when every stage is; kept so on every change. */
export function syncDone(content: GanttContent): GanttContent {
  const parents = new Set(content.rows.map((r) => r.parent))
  let changed = false
  const rows = content.rows.map((row) => {
    if (row.key || !row.stages?.length || parents.has(row.id)) return row
    const done = row.stages.every((s) => s.done)
    if (done === (row.done === true)) return row
    changed = true
    return marked(row, done)
  })
  return changed ? { ...content, rows } : content
}
