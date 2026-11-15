import type { Task } from '@/api/tasks'
import { updateRow, type Row } from '@/modules/gantt/rows'
import type { GanttContent } from '@/modules/gantt/schema'
import { subtreeEnd } from '@/modules/gantt/tree'

// Mirrors leaf_done and the progress of gantt_view in backend/app/domain/api_gantt.py.

/** A task row is done when its tracker says so; a row tiko owns, when it is ticked. */
export function leafDone(row: Row, task: Task | undefined) {
  if (row.key) return task?.state === 'ok' && task.status_category === 'done'
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

/** Ticks a row tiko owns; unticked, the field goes, so the content reads as before. */
export function tickRow(content: GanttContent, id: string, done: boolean): GanttContent {
  return updateRow(content, id, (row) => {
    if (row.key) return row
    const { done: _old, ...rest } = row
    return done ? { ...rest, done: true } : rest
  })
}
