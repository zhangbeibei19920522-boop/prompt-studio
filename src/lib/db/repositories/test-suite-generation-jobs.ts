import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { TestSuiteGenerationJob, TestSuiteGenerationJobStatus } from '@/types/database'

interface TestSuiteGenerationJobRow {
  id: string
  project_id: string
  suite_id: string
  status: TestSuiteGenerationJobStatus
  generated_count: number
  total_count: number
  error_message: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

function mapRowToGenerationJob(row: TestSuiteGenerationJobRow): TestSuiteGenerationJob {
  return {
    id: row.id,
    projectId: row.project_id,
    suiteId: row.suite_id,
    status: row.status,
    generatedCount: row.generated_count,
    totalCount: row.total_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  }
}

export function findTestSuiteGenerationJobsByProject(projectId: string): TestSuiteGenerationJob[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM test_suite_generation_jobs WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as TestSuiteGenerationJobRow[]

  return rows.map(mapRowToGenerationJob)
}

export function findTestSuiteGenerationJobById(id: string): TestSuiteGenerationJob | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM test_suite_generation_jobs WHERE id = ?')
    .get(id) as TestSuiteGenerationJobRow | undefined

  return row ? mapRowToGenerationJob(row) : null
}

export function createTestSuiteGenerationJob(data: {
  projectId: string
  suiteId: string
  totalCount: number
}): TestSuiteGenerationJob {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO test_suite_generation_jobs (
      id,
      project_id,
      suite_id,
      status,
      generated_count,
      total_count,
      error_message,
      created_at,
      updated_at,
      completed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.suiteId,
    'queued',
    0,
    data.totalCount,
    null,
    now,
    now,
    null
  )

  return {
    id,
    projectId: data.projectId,
    suiteId: data.suiteId,
    status: 'queued',
    generatedCount: 0,
    totalCount: data.totalCount,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

export function updateTestSuiteGenerationJob(
  id: string,
  data: {
    status?: TestSuiteGenerationJobStatus
    generatedCount?: number
    totalCount?: number
    errorMessage?: string | null
    completedAt?: string | null
  }
): TestSuiteGenerationJob | null {
  const db = getDb()
  const existing = findTestSuiteGenerationJobById(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
  }
  if (data.generatedCount !== undefined) {
    fields.push('generated_count = ?')
    values.push(data.generatedCount)
  }
  if (data.totalCount !== undefined) {
    fields.push('total_count = ?')
    values.push(data.totalCount)
  }
  if (data.errorMessage !== undefined) {
    fields.push('error_message = ?')
    values.push(data.errorMessage)
  }
  if (data.completedAt !== undefined) {
    fields.push('completed_at = ?')
    values.push(data.completedAt)
  }

  values.push(id)
  db.prepare(`UPDATE test_suite_generation_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findTestSuiteGenerationJobById(id)
}
