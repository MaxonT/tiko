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

// A refresh reads the saved board, and the room saves a teammate's edit 2 s after they pause
// and at most 10 s after it began: ask once the burst settles, then after each of those.
const TRIES_MS = [300, 2_500, 10_500]

/**
 * Cards someone else adds, a teammate or an agent through the API, arrive over the live
 * socket without their tasks: refresh for them instead of showing Loading until the next
 * poll. What was missing at open comes with the first poll anyway.
 */
export function useArrivedTasks(
  nodes: AppNode[],
  tasks: Record<string, Task>,
  refresh: () => unknown,
) {
  const asked = useRef<Set<string> | null>(null)
  const pending = useRef(new Set<string>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ nodes, tasks, refresh })
  useEffect(() => {
    latest.current = { nodes, tasks, refresh }
  }, [nodes, tasks, refresh])

  useEffect(() => {
    const missing = missingTasks(nodes, tasks)
    if (asked.current === null) {
      asked.current = new Set(missing)
      return
    }
    const fresh = missing.filter((ref) => !asked.current?.has(ref))
    if (!fresh.length) return
    for (const ref of fresh) {
      asked.current.add(ref)
      pending.current.add(ref)
    }
    if (timer.current) return
    const attempt = (i: number) => {
      timer.current = setTimeout(
        () => {
          timer.current = null
          const now = latest.current
          const still = missingTasks(now.nodes, now.tasks).filter((ref) => pending.current.has(ref))
          pending.current = new Set(still)
          if (!still.length) return
          now.refresh()
          if (i + 1 < TRIES_MS.length) attempt(i + 1)
          else pending.current.clear()
        },
        TRIES_MS[i] - (TRIES_MS[i - 1] ?? 0),
      )
    }
    attempt(0)
  }, [nodes, tasks])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
}
