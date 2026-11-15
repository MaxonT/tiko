import { useEffect, useRef } from 'react'
import type { Task } from '@/api/tasks'
import { nodeTasks } from '@/canvas/node-tasks'
import { taskRef } from '@/canvas/tasks-context'
import type { AppNode } from '@/canvas/types'

/** Refs of the board's tasks that have no task to show yet. */
export function missingTasks(nodes: AppNode[], tasks: Record<string, Task>): string[] {
  const missing = new Set<string>()
  for (const node of nodes) {
    for (const link of nodeTasks(node)) if (!tasks[taskRef(link)]) missing.add(taskRef(link))
  }
  return [...missing]
}

const SETTLE_MS = 300

/**
 * Cards someone else adds, a teammate or an agent through the API, arrive over the live
 * socket without their tasks: refresh once for them instead of showing Loading until the
 * next poll. What was missing at open comes with the first poll anyway.
 */
export function useArrivedTasks(
  nodes: AppNode[],
  tasks: Record<string, Task>,
  refresh: () => unknown,
) {
  const asked = useRef<Set<string> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(refresh)
  useEffect(() => {
    latest.current = refresh
  }, [refresh])

  useEffect(() => {
    const missing = missingTasks(nodes, tasks)
    if (asked.current === null) {
      asked.current = new Set(missing)
      return
    }
    const fresh = missing.filter((ref) => !asked.current?.has(ref))
    if (!fresh.length) return
    for (const ref of fresh) asked.current.add(ref)
    // An agent adds cards in a burst: one refresh for all of them.
    timer.current ??= setTimeout(() => {
      timer.current = null
      latest.current()
    }, SETTLE_MS)
  }, [nodes, tasks])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
}
