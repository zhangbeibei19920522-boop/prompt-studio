import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type {
  TestGenerationSection,
  TestSuite,
  TestSuiteConfig,
  TestSuiteRoutingConfig,
  TestSuiteWorkflowMode,
} from '@/types/database'

interface TestSuiteRow {
  id: string
  project_id: string
  session_id: string | null
  section: TestGenerationSection | null
  name: string
  description: string
  prompt_id: string | null
  prompt_version_id: string | null
  workflow_mode: TestSuiteWorkflowMode | null
  routing_config: string | null
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
    section: row.section ?? 'full-flow',
    name: row.name,
    description: row.description,
    promptId: row.prompt_id,
    promptVersionId: row.prompt_version_id,
    workflowMode: row.workflow_mode ?? 'single',
    routingConfig: row.routing_config
      ? (JSON.parse(row.routing_config) as TestSuiteRoutingConfig)
      : null,
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
  section?: TestGenerationSection
  name: string
  description?: string
  promptId?: string | null
  promptVersionId?: string | null
  workflowMode?: TestSuiteWorkflowMode
  routingConfig?: TestSuiteRoutingConfig | null
  config?: TestSuiteConfig
  status?: 'draft' | 'ready' | 'running' | 'completed'
}): TestSuite {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()
  const defaultConfig: TestSuiteConfig = data.config ?? { provider: '', model: '', apiKey: '', baseUrl: '' }
  const section = data.section ?? 'full-flow'
  const workflowMode = data.workflowMode ?? 'single'
  const routingConfig = data.routingConfig ?? null
  const status = data.status ?? 'draft'

  db.prepare(`
    INSERT INTO test_suites (
      id,
      project_id,
      session_id,
      section,
      name,
      description,
      prompt_id,
      prompt_version_id,
      workflow_mode,
      routing_config,
      config,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.sessionId ?? null,
    section,
    data.name,
    data.description ?? '',
    data.promptId ?? null,
    data.promptVersionId ?? null,
    workflowMode,
    routingConfig ? JSON.stringify(routingConfig) : null,
    JSON.stringify(defaultConfig),
    status,
    now,
    now
  )

  return {
    id,
    projectId: data.projectId,
    sessionId: data.sessionId ?? null,
    section,
    name: data.name,
    description: data.description ?? '',
    promptId: data.promptId ?? null,
    promptVersionId: data.promptVersionId ?? null,
    workflowMode,
    routingConfig,
    config: defaultConfig,
    status,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateTestSuite(
  id: string,
  data: {
    section?: TestGenerationSection
    name?: string
    description?: string
    promptId?: string | null
    promptVersionId?: string | null
    workflowMode?: TestSuiteWorkflowMode
    routingConfig?: TestSuiteRoutingConfig | null
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
  if (data.section !== undefined) {
    fields.push('section = ?')
    values.push(data.section)
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
  if (data.workflowMode !== undefined) {
    fields.push('workflow_mode = ?')
    values.push(data.workflowMode)
  }
  if (data.routingConfig !== undefined) {
    fields.push('routing_config = ?')
    values.push(data.routingConfig ? JSON.stringify(data.routingConfig) : null)
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
