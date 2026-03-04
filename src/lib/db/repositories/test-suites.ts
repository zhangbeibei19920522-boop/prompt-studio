import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { TestSuite, TestSuiteConfig } from '@/types/database'

interface TestSuiteRow {
  id: string
  project_id: string
  session_id: string | null
  name: string
  description: string
  prompt_id: string | null
  prompt_version_id: string | null
  config: string
  status: 'draft' | 'ready' | 'running' | 'completed'
  created_at: string
  updated_at: string
}

function mapRowToTestSuite(row: TestSuiteRow): TestSuite {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    name: row.name,
    description: row.description,
    promptId: row.prompt_id,
    promptVersionId: row.prompt_version_id,
    config: JSON.parse(row.config) as TestSuiteConfig,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findTestSuitesByProject(projectId: string): TestSuite[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM test_suites WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as TestSuiteRow[]
  return rows.map(mapRowToTestSuite)
}

export function findTestSuiteById(id: string): TestSuite | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM test_suites WHERE id = ?').get(id) as TestSuiteRow | undefined
  return row ? mapRowToTestSuite(row) : null
}

export function createTestSuite(data: {
  projectId: string
  sessionId?: string
  name: string
  description?: string
}): TestSuite {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()
  const defaultConfig: TestSuiteConfig = { provider: '', model: '', apiKey: '', baseUrl: '' }

  db.prepare(`
    INSERT INTO test_suites (id, project_id, session_id, name, description, config, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.sessionId ?? null,
    data.name,
    data.description ?? '',
    JSON.stringify(defaultConfig),
    'draft',
    now,
    now
  )

  return {
    id,
    projectId: data.projectId,
    sessionId: data.sessionId ?? null,
    name: data.name,
    description: data.description ?? '',
    promptId: null,
    promptVersionId: null,
    config: defaultConfig,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
}

export function updateTestSuite(
  id: string,
  data: {
    name?: string
    description?: string
    promptId?: string | null
    promptVersionId?: string | null
    config?: TestSuiteConfig
    status?: 'draft' | 'ready' | 'running' | 'completed'
  }
): TestSuite | null {
  const db = getDb()
  const existing = findTestSuiteById(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
  }
  if (data.promptId !== undefined) {
    fields.push('prompt_id = ?')
    values.push(data.promptId)
  }
  if (data.promptVersionId !== undefined) {
    fields.push('prompt_version_id = ?')
    values.push(data.promptVersionId)
  }
  if (data.config !== undefined) {
    fields.push('config = ?')
    values.push(JSON.stringify(data.config))
  }
  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
  }

  values.push(id)
  db.prepare(`UPDATE test_suites SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findTestSuiteById(id)
}

export function deleteTestSuite(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM test_suites WHERE id = ?').run(id)
  return result.changes > 0
}
