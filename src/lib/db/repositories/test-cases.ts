import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { TestCase } from '@/types/database'

interface TestCaseRow {
  id: string
  test_suite_id: string
  title: string
  context: string
  input: string
  expected_output: string
  expected_output_diagnostics: string | null
  expected_intent: string | null
  sort_order: number
}

function mapRowToTestCase(row: TestCaseRow): TestCase {
  return {
    id: row.id,
    testSuiteId: row.test_suite_id,
    title: row.title,
    context: row.context,
    input: row.input,
    expectedOutput: row.expected_output,
    expectedOutputDiagnostics: (() => {
      if (!row.expected_output_diagnostics) return null
      try {
        return JSON.parse(row.expected_output_diagnostics) as TestCase['expectedOutputDiagnostics']
      } catch {
        return null
      }
    })(),
    expectedIntent: row.expected_intent,
    sortOrder: row.sort_order,
  }
}

export function findTestCasesBySuite(testSuiteId: string): TestCase[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM test_cases WHERE test_suite_id = ? ORDER BY sort_order ASC')
    .all(testSuiteId) as TestCaseRow[]
  return rows.map(mapRowToTestCase)
}

export function findTestCaseById(id: string): TestCase | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id) as TestCaseRow | undefined
  return row ? mapRowToTestCase(row) : null
}

export function createTestCase(data: {
  testSuiteId: string
  title: string
  context?: string
  input: string
  expectedOutput: string
  expectedOutputDiagnostics?: TestCase['expectedOutputDiagnostics']
  expectedIntent?: string | null
  sortOrder?: number
}): TestCase {
  const db = getDb()
  const id = nanoid()

  let sortOrder = data.sortOrder
  if (sortOrder === undefined) {
    const result = db
      .prepare('SELECT MAX(sort_order) as max_order FROM test_cases WHERE test_suite_id = ?')
      .get(data.testSuiteId) as { max_order: number | null }
    sortOrder = (result.max_order ?? -1) + 1
  }

  db.prepare(`
    INSERT INTO test_cases (
      id,
      test_suite_id,
      title,
      context,
      input,
      expected_output,
      expected_output_diagnostics,
      expected_intent,
      sort_order
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.testSuiteId,
    data.title,
    data.context ?? '',
    data.input,
    data.expectedOutput,
    data.expectedOutputDiagnostics ? JSON.stringify(data.expectedOutputDiagnostics) : null,
    data.expectedIntent ?? null,
    sortOrder
  )

  return {
    id,
    testSuiteId: data.testSuiteId,
    title: data.title,
    context: data.context ?? '',
    input: data.input,
    expectedOutput: data.expectedOutput,
    expectedOutputDiagnostics: data.expectedOutputDiagnostics ?? null,
    expectedIntent: data.expectedIntent ?? null,
    sortOrder,
  }
}

export function updateTestCase(
  id: string,
  data: {
    title?: string
    context?: string
    input?: string
    expectedOutput?: string
    expectedOutputDiagnostics?: TestCase['expectedOutputDiagnostics']
    expectedIntent?: string | null
    sortOrder?: number
  }
): TestCase | null {
  const db = getDb()
  const existing = findTestCaseById(id)
  if (!existing) return null

  const fields: string[] = []
  const values: unknown[] = []

  if (data.title !== undefined) {
    fields.push('title = ?')
    values.push(data.title)
  }
  if (data.context !== undefined) {
    fields.push('context = ?')
    values.push(data.context)
  }
  if (data.input !== undefined) {
    fields.push('input = ?')
    values.push(data.input)
  }
  if (data.expectedOutput !== undefined) {
    fields.push('expected_output = ?')
    values.push(data.expectedOutput)
  }
  if (data.expectedOutputDiagnostics !== undefined) {
    fields.push('expected_output_diagnostics = ?')
    values.push(
      data.expectedOutputDiagnostics ? JSON.stringify(data.expectedOutputDiagnostics) : null
    )
  }
  if (data.expectedIntent !== undefined) {
    fields.push('expected_intent = ?')
    values.push(data.expectedIntent)
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?')
    values.push(data.sortOrder)
  }

  if (fields.length === 0) return existing

  values.push(id)
  db.prepare(`UPDATE test_cases SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findTestCaseById(id)
}

export function deleteTestCase(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM test_cases WHERE id = ?').run(id)
  return result.changes > 0
}

export function createTestCasesBatch(
  testSuiteId: string,
  cases: {
    title: string
    context?: string
    input: string
    expectedOutput: string
    expectedOutputDiagnostics?: TestCase['expectedOutputDiagnostics']
    expectedIntent?: string | null
    sortOrder?: number
  }[]
): TestCase[] {
  const db = getDb()

  const result = db
    .prepare('SELECT MAX(sort_order) as max_order FROM test_cases WHERE test_suite_id = ?')
    .get(testSuiteId) as { max_order: number | null }
  let nextOrder = (result.max_order ?? -1) + 1

  const insert = db.prepare(`
    INSERT INTO test_cases (
      id,
      test_suite_id,
      title,
      context,
      input,
      expected_output,
      expected_output_diagnostics,
      expected_intent,
      sort_order
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const created: TestCase[] = []

  const insertAll = db.transaction(() => {
    for (const c of cases) {
      const id = nanoid()
      const sortOrder = c.sortOrder ?? nextOrder++
      insert.run(
        id,
        testSuiteId,
        c.title ?? '',
        c.context ?? '',
        c.input ?? '',
        c.expectedOutput ?? '',
        c.expectedOutputDiagnostics ? JSON.stringify(c.expectedOutputDiagnostics) : null,
        c.expectedIntent ?? null,
        sortOrder
      )
      created.push({
        id,
        testSuiteId,
        title: c.title,
        context: c.context ?? '',
        input: c.input,
        expectedOutput: c.expectedOutput,
        expectedOutputDiagnostics: c.expectedOutputDiagnostics ?? null,
        expectedIntent: c.expectedIntent ?? null,
        sortOrder,
      })
    }
  })

  insertAll()

  return created
}
