import {
  findResumableTestSuiteGenerationJobsByProject,
} from '@/lib/db/repositories/test-suite-generation-jobs'
import { runConfiguredTestSuiteGenerationJob } from '@/lib/test-suite-generation/run-configured-suite-generation'
import type { GenerateConfiguredTestSuiteRequest } from '@/types/api'

declare global {
  var __configuredTestSuiteGenerationActiveJobs: Set<string> | undefined
}

function getActiveJobSet() {
  if (!globalThis.__configuredTestSuiteGenerationActiveJobs) {
    globalThis.__configuredTestSuiteGenerationActiveJobs = new Set<string>()
  }

  return globalThis.__configuredTestSuiteGenerationActiveJobs
}

export function scheduleConfiguredTestSuiteGenerationJob(data: {
  projectId: string
  suiteId: string
  jobId: string
  request: GenerateConfiguredTestSuiteRequest
}): void {
  const activeJobs = getActiveJobSet()
  if (activeJobs.has(data.jobId)) {
    return
  }

  activeJobs.add(data.jobId)
  queueMicrotask(async () => {
    try {
      await runConfiguredTestSuiteGenerationJob(data)
    } finally {
      activeJobs.delete(data.jobId)
    }
  })
}

export function resumeConfiguredTestSuiteGenerationJobs(projectId: string): void {
  const resumableJobs = findResumableTestSuiteGenerationJobsByProject(projectId)
  for (const job of resumableJobs) {
    scheduleConfiguredTestSuiteGenerationJob({
      projectId: job.projectId,
      suiteId: job.suiteId,
      jobId: job.id,
      request: job.request,
    })
  }
}
