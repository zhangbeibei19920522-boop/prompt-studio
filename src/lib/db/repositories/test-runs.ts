import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { TestRun, TestCaseResult, TestReport } from '@/types/database'

interface TestRunRow {
  id: string
  test_suite_id: string
  status: 'running' | 'completed' | 'failed'
  results: string
  report: string
  score: number | null
  started_at: string
  completed_at: string | null
}

function mapRowToTestRun(row: TestRunRow): TestRun {
  return {
    id: row.id,
    testSuiteId: row.test_suite_id,
    status: row.status,
    results: JSON.parse(row.results) as TestCaseResult[],
    report: (() => {
      if (!row.report || row.report === '{}') return null
      try {
        const parsed = JSON.parse(row.report)
        return parsed.summary ? parsed as TestReport : null
      } catch { return null }
    })(),
    score: row.score,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

export function findTestRunsBySuite(testSuiteId: string): TestRun[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM test_runs WHERE test_suite_id = ? ORDER BY started_at DESC')
    .all(testSuiteId) as TestRunRow[]
  return rows.map(mapRowToTestRun)
}

export function findTestRunById(id: string): TestRun | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(id) as TestRunRow | undefined
  return row ? mapRowToTestRun(row) : null
}

export function findLatestTestRun(testSuiteId: string): TestRun | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM test_runs WHERE test_suite_id = ? ORDER BY started_at DESC LIMIT 1')
    .get(testSuiteId) as TestRunRow | undefined
  return row ? mapRowToTestRun(row) : null
}

export function createTestRun(testSuiteId: string): TestRun {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO test_runs (id, test_suite_id, status, results, report, started_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, testSuiteId, 'running', '[]', '{}', now)

  return {
    id,
    testSuiteId,
    status: 'running',
    results: [],
    report: null,
    score: null,
    startedAt: now,
    completedAt: null,
  }
}

export function updateTestRun(
  id: string,
  data: {
    status?: 'running' | 'completed' | 'failed'
    results?: TestCaseResult[]
    report?: TestReport
    score?: number
  }
): TestRun | null {
  const db = getDb()
  const existing = findTestRunById(id)
  if (!existing) return null

  const fields: string[] = []
  const values: unknown[] = []

  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
    if (data.status === 'completed' || data.status === 'failed') {
      fields.push('completed_at = ?')
      values.push(new Date().toISOString())
    }
  }
  if (data.results !== undefined) {
    fields.push('results = ?')
    values.push(JSON.stringify(data.results))
  }
  if (data.report !== undefined) {
    fields.push('report = ?')
    values.push(JSON.stringify(data.report))
  }
  if (data.score !== undefined) {
    fields.push('score = ?')
    values.push(data.score)
  }

  if (fields.length === 0) return existing

  values.push(id)
  db.prepare(`UPDATE test_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findTestRunById(id)
}
