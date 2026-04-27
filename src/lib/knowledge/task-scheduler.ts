import { findKnowledgeBuildTasksByProject } from '@/lib/db/repositories/knowledge-build-tasks'

import { runKnowledgeBuildTask } from './service'

declare global {
  var __knowledgeBuildActiveTasks: Set<string> | undefined
}

function getActiveTaskSet() {
  if (!globalThis.__knowledgeBuildActiveTasks) {
    globalThis.__knowledgeBuildActiveTasks = new Set<string>()
  }

  return globalThis.__knowledgeBuildActiveTasks
}

export function scheduleKnowledgeBuildTask(taskId: string): void {
  const activeTasks = getActiveTaskSet()
  if (activeTasks.has(taskId)) {
    return
  }

  activeTasks.add(taskId)
  queueMicrotask(async () => {
    try {
      await runKnowledgeBuildTask(taskId)
    } finally {
      activeTasks.delete(taskId)
    }
  })
}

export function resumeKnowledgeBuildTasks(projectId: string): void {
  const resumableTasks = findKnowledgeBuildTasksByProject(projectId).filter((task) => {
    if (task.status === 'running') return true
    return task.status === 'pending' && (task.currentStep === 'queued' || task.currentStep === 'building_artifacts')
  })

  for (const task of resumableTasks) {
    scheduleKnowledgeBuildTask(task.id)
  }
}
