# 自动化测试功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Prompt Manager 新增自动化测试功能，支持通过对话创建测试集、逐条运行测试、LLM 评估并生成报告。

**Architecture:** 复用现有 Agent 对话系统，新增测试专用提示词和事件类型。测试执行引擎独立于 Agent，通过 SSE 实时推送进度。数据层新增 3 张表（test_suites、test_cases、test_runs），遵循现有 Repository 模式。

**Tech Stack:** Next.js App Router, SQLite (better-sqlite3), SSE streaming, nanoid, TypeScript, Tailwind + shadcn/ui

**Design doc:** `docs/plans/2026-03-04-testing-design.md`

---

## Phase 1: 数据层基础

### Task 1: 新增数据库表

**Files:**
- Modify: `src/lib/db/schema.sql`

**Step 1: 在 schema.sql 末尾新增 3 张表**

在文件末尾 `idx_memories_scope_project` 索引之后追加：

```sql
-- 自动化测试系统
CREATE TABLE IF NOT EXISTS test_suites (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prompt_id TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_version_id TEXT REFERENCES prompt_versions(id) ON DELETE SET NULL,
  config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'ready', 'running', 'completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  test_suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  test_suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed')),
  results TEXT NOT NULL DEFAULT '[]',
  report TEXT NOT NULL DEFAULT '{}',
  score REAL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_test_suites_project ON test_suites(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON test_cases(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite ON test_runs(test_suite_id);
```

**Step 2: 验证构建**

Run: `cd /Users/cs001/prompt-studio && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/db/schema.sql
git commit -m "feat: 新增自动化测试数据表 (test_suites, test_cases, test_runs)"
```

---

### Task 2: 新增 TypeScript 类型定义

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/types/api.ts`
- Modify: `src/types/ai.ts`

**Step 1: 在 database.ts 末尾新增测试相关类型**

在 `SessionExtractionProgress` 接口之后追加：

```typescript
// 测试集配置
export interface TestSuiteConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
}

// 测试集
export interface TestSuite {
  id: string
  projectId: string
  sessionId: string | null
  name: string
  description: string
  promptId: string | null
  promptVersionId: string | null
  config: TestSuiteConfig
  status: 'draft' | 'ready' | 'running' | 'completed'
  createdAt: string
  updatedAt: string
}

// 测试用例
export interface TestCase {
  id: string
  testSuiteId: string
  title: string
  context: string
  input: string
  expectedOutput: string
  sortOrder: number
}

// 单条测试结果
export interface TestCaseResult {
  testCaseId: string
  actualOutput: string
  passed: boolean
  score: number
  reason: string
}

// 测试报告
export interface TestReport {
  summary: string
  totalCases: number
  passedCases: number
  score: number
  improvements: string[]
  details: string
}

// 测试运行记录
export interface TestRun {
  id: string
  testSuiteId: string
  status: 'running' | 'completed' | 'failed'
  results: TestCaseResult[]
  report: TestReport | null
  score: number | null
  startedAt: string
  completedAt: string | null
}
```

**Step 2: 在 api.ts 新增测试相关请求类型**

在文件末尾追加：

```typescript
// 测试集请求类型
export interface CreateTestSuiteRequest {
  name: string
  description?: string
  sessionId?: string
}

export interface UpdateTestSuiteRequest {
  name?: string
  description?: string
  promptId?: string
  promptVersionId?: string
  config?: import('./database').TestSuiteConfig
  status?: 'draft' | 'ready' | 'running' | 'completed'
}

export interface CreateTestCaseRequest {
  title: string
  context?: string
  input: string
  expectedOutput: string
  sortOrder?: number
}

export interface UpdateTestCaseRequest {
  title?: string
  context?: string
  input?: string
  expectedOutput?: string
  sortOrder?: number
}

export interface RunTestRequest {
  promptId: string
}
```

**Step 3: 在 ai.ts 扩展 StreamEvent 类型**

在 `StreamEvent` 类型定义中新增 `test-suite` 事件（在 `memory` 之后，`done` 之前）：

```typescript
// 测试运行 SSE 事件
export type TestRunEvent =
  | { type: 'test-start'; data: { totalCases: number } }
  | { type: 'test-case-start'; data: { caseId: string; index: number; title: string } }
  | { type: 'test-case-done'; data: { caseId: string; actualOutput: string } }
  | { type: 'eval-start' }
  | { type: 'eval-case-done'; data: { caseId: string; passed: boolean; score: number; reason: string } }
  | { type: 'eval-report'; data: import('./database').TestReport }
  | { type: 'test-complete'; data: { runId: string; score: number } }
  | { type: 'test-error'; data: { error: string } }

// 测试集生成数据（Agent 对话中生成）
export interface TestSuiteGenerationData {
  name: string
  description: string
  cases: Array<{
    title: string
    context: string
    input: string
    expectedOutput: string
  }>
}
```

同时在 `StreamEvent` 联合类型中追加一项：

```typescript
  | { type: 'test-suite'; data: TestSuiteGenerationData }
```

**Step 4: 验证构建**

Run: `cd /Users/cs001/prompt-studio && npx next build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/types/database.ts src/types/api.ts src/types/ai.ts
git commit -m "feat: 新增测试相关 TypeScript 类型定义"
```

---

### Task 3: 新增 Repository — test-suites

**Files:**
- Create: `src/lib/db/repositories/test-suites.ts`

**Step 1: 创建 test-suites.ts**

```typescript
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
  const row = db
    .prepare('SELECT * FROM test_suites WHERE id = ?')
    .get(id) as TestSuiteRow | undefined
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
  const config: TestSuiteConfig = { provider: '', model: '', apiKey: '', baseUrl: '' }

  db.prepare(`
    INSERT INTO test_suites (id, project_id, session_id, name, description, config, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `).run(id, data.projectId, data.sessionId ?? null, data.name, data.description ?? '', JSON.stringify(config), now, now)

  return findTestSuiteById(id)!
}

export function updateTestSuite(
  id: string,
  data: {
    name?: string
    description?: string
    promptId?: string | null
    promptVersionId?: string | null
    config?: TestSuiteConfig
    status?: TestSuite['status']
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
```

**Step 2: 验证构建**

Run: `cd /Users/cs001/prompt-studio && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/db/repositories/test-suites.ts
git commit -m "feat: 新增 test-suites repository"
```

---

### Task 4: 新增 Repository — test-cases

**Files:**
- Create: `src/lib/db/repositories/test-cases.ts`

**Step 1: 创建 test-cases.ts**

```typescript
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
  const row = db
    .prepare('SELECT * FROM test_cases WHERE id = ?')
    .get(id) as TestCaseRow | undefined
  return row ? mapRowToTestCase(row) : null
}

export function createTestCase(data: {
  testSuiteId: string
  title: string
  context?: string
  input: string
  expectedOutput: string
  sortOrder?: number
}): TestCase {
  const db = getDb()
  const id = nanoid()

  // Auto-assign sortOrder if not provided
  const sortOrder = data.sortOrder ?? (() => {
    const max = db
      .prepare('SELECT MAX(sort_order) as max_order FROM test_cases WHERE test_suite_id = ?')
      .get(data.testSuiteId) as { max_order: number | null } | undefined
    return (max?.max_order ?? -1) + 1
  })()

  db.prepare(`
    INSERT INTO test_cases (id, test_suite_id, title, context, input, expected_output, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.testSuiteId, data.title, data.context ?? '', data.input, data.expectedOutput, sortOrder)

  return findTestCaseById(id)!
}

export function updateTestCase(
  id: string,
  data: {
    title?: string
    context?: string
    input?: string
    expectedOutput?: string
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
  cases: Array<{ title: string; context: string; input: string; expectedOutput: string }>
): TestCase[] {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO test_cases (id, test_suite_id, title, context, input, expected_output, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const results: TestCase[] = []
  const insertAll = db.transaction(() => {
    cases.forEach((c, index) => {
      const id = nanoid()
      stmt.run(id, testSuiteId, c.title, c.context, c.input, c.expectedOutput, index)
      results.push({
        id,
        testSuiteId,
        title: c.title,
        context: c.context,
        input: c.input,
        expectedOutput: c.expectedOutput,
        sortOrder: index,
      })
    })
  })
  insertAll()
  return results
}
```

**Step 2: 验证构建**

Run: `cd /Users/cs001/prompt-studio && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/db/repositories/test-cases.ts
git commit -m "feat: 新增 test-cases repository"
```

---

### Task 5: 新增 Repository — test-runs

**Files:**
- Create: `src/lib/db/repositories/test-runs.ts`

**Step 1: 创建 test-runs.ts**

```typescript
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
    report: row.report ? JSON.parse(row.report) as TestReport : null,
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
  const row = db
    .prepare('SELECT * FROM test_runs WHERE id = ?')
    .get(id) as TestRunRow | undefined
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
    VALUES (?, ?, 'running', '[]', '{}', ?)
  `).run(id, testSuiteId, now)

  return findTestRunById(id)!
}

export function updateTestRun(
  id: string,
  data: {
    status?: TestRun['status']
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
```

**Step 2: 验证构建**

Run: `cd /Users/cs001/prompt-studio && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/db/repositories/test-runs.ts
git commit -m "feat: 新增 test-runs repository"
```

---

## Phase 2: API 路由

### Task 6: 测试集 CRUD API

**Files:**
- Create: `src/app/api/projects/[id]/test-suites/route.ts`
- Create: `src/app/api/test-suites/[id]/route.ts`

**Step 1: 创建项目级测试集路由**

`src/app/api/projects/[id]/test-suites/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { findTestSuitesByProject, createTestSuite } from '@/lib/db/repositories/test-suites'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const suites = findTestSuitesByProject(projectId)
  return NextResponse.json({ success: true, data: suites, error: null })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const body = await request.json()
  const { name, description, sessionId } = body

  if (!name || typeof name !== 'string') {
    return NextResponse.json(
      { success: false, data: null, error: '测试集名称不能为空' },
      { status: 400 }
    )
  }

  const suite = createTestSuite({ projectId, name, description, sessionId })
  return NextResponse.json({ success: true, data: suite, error: null })
}
```

**Step 2: 创建测试集详情路由**

`src/app/api/test-suites/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { findTestSuiteById, updateTestSuite, deleteTestSuite } from '@/lib/db/repositories/test-suites'
import { findTestCasesBySuite } from '@/lib/db/repositories/test-cases'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const suite = findTestSuiteById(id)
  if (!suite) {
    return NextResponse.json(
      { success: false, data: null, error: '测试集不存在' },
      { status: 404 }
    )
  }
  const cases = findTestCasesBySuite(id)
  return NextResponse.json({ success: true, data: { ...suite, cases }, error: null })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const updated = updateTestSuite(id, body)
  if (!updated) {
    return NextResponse.json(
      { success: false, data: null, error: '测试集不存在' },
      { status: 404 }
    )
  }
  return NextResponse.json({ success: true, data: updated, error: null })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const deleted = deleteTestSuite(id)
  if (!deleted) {
    return NextResponse.json(
      { success: false, data: null, error: '测试集不存在' },
      { status: 404 }
    )
  }
  return NextResponse.json({ success: true, data: null, error: null })
}
```

**Step 3: 验证构建**

Run: `cd /Users/cs001/prompt-studio && npx next build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/projects/\[id\]/test-suites/route.ts src/app/api/test-suites/\[id\]/route.ts
git commit -m "feat: 新增测试集 CRUD API 路由"
```

---

### Task 7: 测试用例 CRUD API

**Files:**
- Create: `src/app/api/test-suites/[id]/cases/route.ts`
- Create: `src/app/api/test-cases/[id]/route.ts`

**Step 1: 创建测试用例列表/新增路由**

`src/app/api/test-suites/[id]/cases/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { findTestCasesBySuite, createTestCase, createTestCasesBatch } from '@/lib/db/repositories/test-cases'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testSuiteId } = await params
  const cases = findTestCasesBySuite(testSuiteId)
  return NextResponse.json({ success: true, data: cases, error: null })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testSuiteId } = await params
  const body = await request.json()

  // Support batch creation
  if (Array.isArray(body)) {
    const cases = createTestCasesBatch(testSuiteId, body)
    return NextResponse.json({ success: true, data: cases, error: null })
  }

  const { title, context, input, expectedOutput, sortOrder } = body
  if (!title || !input || !expectedOutput) {
    return NextResponse.json(
      { success: false, data: null, error: '标题、输入和预期输出不能为空' },
      { status: 400 }
    )
  }

  const testCase = createTestCase({ testSuiteId, title, context, input, expectedOutput, sortOrder })
  return NextResponse.json({ success: true, data: testCase, error: null })
}
```

**Step 2: 创建测试用例详情路由**

`src/app/api/test-cases/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { findTestCaseById, updateTestCase, deleteTestCase } from '@/lib/db/repositories/test-cases'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const testCase = findTestCaseById(id)
  if (!testCase) {
    return NextResponse.json(
      { success: false, data: null, error: '测试用例不存在' },
      { status: 404 }
    )
  }
  return NextResponse.json({ success: true, data: testCase, error: null })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const updated = updateTestCase(id, body)
  if (!updated) {
    return NextResponse.json(
      { success: false, data: null, error: '测试用例不存在' },
      { status: 404 }
    )
  }
  return NextResponse.json({ success: true, data: updated, error: null })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const deleted = deleteTestCase(id)
  if (!deleted) {
    return NextResponse.json(
      { success: false, data: null, error: '测试用例不存在' },
      { status: 404 }
    )
  }
  return NextResponse.json({ success: true, data: null, error: null })
}
```

**Step 3: 验证构建并 Commit**

```bash
npx next build
git add src/app/api/test-suites/\[id\]/cases/route.ts src/app/api/test-cases/\[id\]/route.ts
git commit -m "feat: 新增测试用例 CRUD API 路由"
```

---

### Task 8: 测试运行 API（含 SSE）

**Files:**
- Create: `src/app/api/test-suites/[id]/run/route.ts`
- Create: `src/app/api/test-suites/[id]/runs/route.ts`
- Create: `src/app/api/test-runs/[id]/route.ts`

**Step 1: 创建运行测试 SSE 端点**

`src/app/api/test-suites/[id]/run/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { findTestSuiteById, updateTestSuite } from '@/lib/db/repositories/test-suites'
import { findTestCasesBySuite } from '@/lib/db/repositories/test-cases'
import { findPromptById } from '@/lib/db/repositories/prompts'
import { createTestRun, updateTestRun } from '@/lib/db/repositories/test-runs'
import { runTestSuite } from '@/lib/ai/test-runner'
import type { TestRunEvent } from '@/types/ai'

function encodeTestSSE(event: TestRunEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: suiteId } = await params
  const body = await request.json()
  const { promptId } = body

  const suite = findTestSuiteById(suiteId)
  if (!suite) {
    return new Response(JSON.stringify({ success: false, error: '测试集不存在' }), { status: 404 })
  }

  const cases = findTestCasesBySuite(suiteId)
  if (cases.length === 0) {
    return new Response(JSON.stringify({ success: false, error: '测试集无测试用例' }), { status: 400 })
  }

  const prompt = findPromptById(promptId)
  if (!prompt) {
    return new Response(JSON.stringify({ success: false, error: 'Prompt 不存在' }), { status: 404 })
  }

  // Update suite status and lock prompt
  updateTestSuite(suiteId, { promptId, status: 'running' })

  // Create test run record
  const testRun = createTestRun(suiteId)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = runTestSuite(testRun.id, suite, cases, prompt)
        for await (const event of generator) {
          controller.enqueue(encoder.encode(encodeTestSSE(event)))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '测试运行失败'
        controller.enqueue(
          encoder.encode(encodeTestSSE({ type: 'test-error', data: { error: message } }))
        )
        updateTestRun(testRun.id, { status: 'failed' })
        updateTestSuite(suiteId, { status: 'ready' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

**Step 2: 创建运行历史路由**

`src/app/api/test-suites/[id]/runs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { findTestRunsBySuite } from '@/lib/db/repositories/test-runs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testSuiteId } = await params
  const runs = findTestRunsBySuite(testSuiteId)
  return NextResponse.json({ success: true, data: runs, error: null })
}
```

**Step 3: 创建运行详情路由**

`src/app/api/test-runs/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { findTestRunById } from '@/lib/db/repositories/test-runs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const run = findTestRunById(id)
  if (!run) {
    return NextResponse.json(
      { success: false, data: null, error: '运行记录不存在' },
      { status: 404 }
    )
  }
  return NextResponse.json({ success: true, data: run, error: null })
}
```

**Step 4: 验证构建并 Commit**

注意：此时构建会因 `test-runner.ts` 不存在而失败，这是预期的。先创建占位文件：

创建 `src/lib/ai/test-runner.ts` 作为占位（下一个 Task 会实现）：

```typescript
import type { TestRunEvent } from '@/types/ai'
import type { TestSuite, TestCase, Prompt } from '@/types/database'

export async function* runTestSuite(
  _runId: string,
  _suite: TestSuite,
  _cases: TestCase[],
  _prompt: Prompt
): AsyncGenerator<TestRunEvent> {
  // Placeholder — implemented in Task 9
  yield { type: 'test-error', data: { error: 'Not implemented' } }
}
```

```bash
npx next build
git add src/app/api/test-suites/ src/app/api/test-cases/ src/app/api/test-runs/ src/lib/ai/test-runner.ts
git commit -m "feat: 新增测试运行 API 路由 (含 SSE 端点)"
```

---

## Phase 3: AI 核心逻辑

### Task 9: 测试执行引擎

**Files:**
- Modify: `src/lib/ai/test-runner.ts` (替换占位)

**Step 1: 实现测试执行引擎**

替换 `src/lib/ai/test-runner.ts` 的全部内容：

```typescript
import type { TestRunEvent } from '@/types/ai'
import type { TestSuite, TestCase, TestCaseResult, Prompt } from '@/types/database'
import { createAiProvider } from './provider'
import { getSettings } from '@/lib/db/repositories/settings'
import { updateTestRun } from '@/lib/db/repositories/test-runs'
import { updateTestSuite } from '@/lib/db/repositories/test-suites'
import { evaluateTestCase, evaluateOverall } from './test-evaluator'

/**
 * Run all test cases in a suite sequentially, then evaluate results.
 * Yields SSE events for real-time progress tracking.
 */
export async function* runTestSuite(
  runId: string,
  suite: TestSuite,
  cases: TestCase[],
  prompt: Prompt
): AsyncGenerator<TestRunEvent> {
  console.log('[TestRunner] Starting test run:', { runId, suiteId: suite.id, caseCount: cases.length })

  yield { type: 'test-start', data: { totalCases: cases.length } }

  // Create provider from suite config
  const suiteConfig = suite.config
  if (!suiteConfig.apiKey || !suiteConfig.model) {
    yield { type: 'test-error', data: { error: '测试集未配置模型或 API Key' } }
    updateTestRun(runId, { status: 'failed' })
    updateTestSuite(suite.id, { status: 'ready' })
    return
  }

  const testProvider = createAiProvider(suiteConfig)

  // Phase 1: Run each test case
  const results: Array<{ testCaseId: string; actualOutput: string }> = []

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i]
    yield { type: 'test-case-start', data: { caseId: tc.id, index: i, title: tc.title } }

    try {
      const systemMessage = prompt.content
      const userMessage = tc.context
        ? `场景上下文：${tc.context}\n\n用户输入：${tc.input}`
        : tc.input

      let actualOutput = ''
      for await (const chunk of testProvider.chatStream([
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ])) {
        actualOutput += chunk
      }

      results.push({ testCaseId: tc.id, actualOutput })
      yield { type: 'test-case-done', data: { caseId: tc.id, actualOutput } }
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      results.push({ testCaseId: tc.id, actualOutput: `[ERROR] ${message}` })
      yield { type: 'test-case-done', data: { caseId: tc.id, actualOutput: `[ERROR] ${message}` } }
    }
  }

  // Phase 2: Evaluate each case
  yield { type: 'eval-start' }

  const settings = getSettings()
  const evalProvider = createAiProvider(settings)

  const evalResults: TestCaseResult[] = []

  for (const result of results) {
    const tc = cases.find((c) => c.id === result.testCaseId)!
    try {
      const evaluation = await evaluateTestCase(evalProvider, {
        title: tc.title,
        context: tc.context,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: result.actualOutput,
      })

      evalResults.push({
        testCaseId: result.testCaseId,
        actualOutput: result.actualOutput,
        passed: evaluation.passed,
        score: evaluation.score,
        reason: evaluation.reason,
      })

      yield {
        type: 'eval-case-done',
        data: {
          caseId: result.testCaseId,
          passed: evaluation.passed,
          score: evaluation.score,
          reason: evaluation.reason,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '评估失败'
      evalResults.push({
        testCaseId: result.testCaseId,
        actualOutput: result.actualOutput,
        passed: false,
        score: 0,
        reason: `[评估失败] ${message}`,
      })

      yield {
        type: 'eval-case-done',
        data: { caseId: result.testCaseId, passed: false, score: 0, reason: `[评估失败] ${message}` },
      }
    }
  }

  // Phase 3: Overall evaluation
  try {
    const report = await evaluateOverall(evalProvider, prompt, cases, evalResults)

    updateTestRun(runId, {
      status: 'completed',
      results: evalResults,
      report,
      score: report.score,
    })
    updateTestSuite(suite.id, { status: 'completed' })

    yield { type: 'eval-report', data: report }
    yield { type: 'test-complete', data: { runId, score: report.score } }
  } catch (error) {
    const message = error instanceof Error ? error.message : '整体评估失败'
    // Still save individual results even if overall eval fails
    const avgScore = evalResults.length > 0
      ? Math.round(evalResults.reduce((sum, r) => sum + r.score, 0) / evalResults.length)
      : 0

    updateTestRun(runId, {
      status: 'completed',
      results: evalResults,
      score: avgScore,
    })
    updateTestSuite(suite.id, { status: 'completed' })

    yield { type: 'test-error', data: { error: `整体评估失败: ${message}，已使用平均分` } }
    yield { type: 'test-complete', data: { runId, score: avgScore } }
  }

  console.log('[TestRunner] Test run completed:', { runId })
}
```

**Step 2: 验证构建**

注意：此时需要 `test-evaluator.ts`，下一个 Task 创建。先创建占位：

创建 `src/lib/ai/test-evaluator.ts` 占位：

```typescript
import type { AiProvider } from '@/types/ai'
import type { TestCase, TestCaseResult, TestReport, Prompt } from '@/types/database'

export async function evaluateTestCase(
  _provider: AiProvider,
  _data: { title: string; context: string; input: string; expectedOutput: string; actualOutput: string }
): Promise<{ passed: boolean; score: number; reason: string }> {
  return { passed: false, score: 0, reason: 'Not implemented' }
}

export async function evaluateOverall(
  _provider: AiProvider,
  _prompt: Prompt,
  _cases: TestCase[],
  _results: TestCaseResult[]
): Promise<TestReport> {
  return { summary: '', totalCases: 0, passedCases: 0, score: 0, improvements: [], details: '' }
}
```

```bash
npx next build
git add src/lib/ai/test-runner.ts src/lib/ai/test-evaluator.ts
git commit -m "feat: 实现测试执行引擎 (test-runner)"
```

---

### Task 10: 测试评估引擎

**Files:**
- Modify: `src/lib/ai/test-evaluator.ts` (替换占位)

**Step 1: 实现评估引擎**

替换 `src/lib/ai/test-evaluator.ts` 的全部内容：

```typescript
import type { AiProvider } from '@/types/ai'
import type { TestCase, TestCaseResult, TestReport, Prompt } from '@/types/database'

const EVAL_CASE_PROMPT = `你是一个 Prompt 质量评估专家。请评估以下测试用例的实际输出是否符合预期。

## 测试用例
- 标题：{title}
- 上下文：{context}
- 用户输入：{input}
- 预期输出：{expectedOutput}

## 实际输出
{actualOutput}

## 评估要求
1. 判断实际输出是否基本满足预期输出的要求（不需要完全一致，语义接近即可）
2. 给出 0-100 的评分
3. 简要说明评估理由

请严格按照以下 JSON 格式返回，不要包含其他内容：
\`\`\`json
{
  "passed": true或false,
  "score": 0到100的数字,
  "reason": "评估理由"
}
\`\`\``

const EVAL_OVERALL_PROMPT = `你是一个 Prompt 质量评估专家。请根据以下测试结果，对这个 Prompt 进行整体评估。

## 被测试的 Prompt
{promptContent}

## 测试结果
{testResults}

## 评估要求
1. 总结整体表现
2. 计算综合评分（0-100）
3. 列出 Prompt 的改进建议（最多 5 条）
4. 给出详细分析

请严格按照以下 JSON 格式返回，不要包含其他内容：
\`\`\`json
{
  "summary": "一句话整体评估",
  "totalCases": 测试总数,
  "passedCases": 通过数,
  "score": 综合评分,
  "improvements": ["改进建议1", "改进建议2"],
  "details": "详细分析..."
}
\`\`\``

function fillTemplate(template: string, data: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(`{${key}}`, value || '（无）')
  }
  return result
}

function extractJson<T>(text: string): T {
  // Try to extract JSON from ```json blocks first
  const jsonBlockMatch = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/)
  if (jsonBlockMatch) {
    return JSON.parse(jsonBlockMatch[1]) as T
  }
  // Try to parse the whole text as JSON
  return JSON.parse(text) as T
}

/**
 * Evaluate a single test case result against its expected output.
 */
export async function evaluateTestCase(
  provider: AiProvider,
  data: {
    title: string
    context: string
    input: string
    expectedOutput: string
    actualOutput: string
  }
): Promise<{ passed: boolean; score: number; reason: string }> {
  const prompt = fillTemplate(EVAL_CASE_PROMPT, {
    title: data.title,
    context: data.context,
    input: data.input,
    expectedOutput: data.expectedOutput,
    actualOutput: data.actualOutput,
  })

  const response = await provider.chat(
    [{ role: 'user', content: prompt }],
    { temperature: 0.1 }
  )

  try {
    const result = extractJson<{ passed: boolean; score: number; reason: string }>(response)
    return {
      passed: !!result.passed,
      score: Math.max(0, Math.min(100, Number(result.score) || 0)),
      reason: result.reason || '无评估理由',
    }
  } catch {
    console.error('[TestEvaluator] Failed to parse case evaluation:', response)
    return { passed: false, score: 0, reason: '评估结果解析失败' }
  }
}

/**
 * Evaluate overall test suite performance and generate improvement suggestions.
 */
export async function evaluateOverall(
  provider: AiProvider,
  promptData: Prompt,
  cases: TestCase[],
  results: TestCaseResult[]
): Promise<TestReport> {
  const testResultsText = results.map((r, i) => {
    const tc = cases.find((c) => c.id === r.testCaseId)
    return [
      `### 用例 ${i + 1}: ${tc?.title ?? '未知'}`,
      `- 通过: ${r.passed ? '是' : '否'}`,
      `- 评分: ${r.score}`,
      `- 输入: ${tc?.input ?? ''}`,
      `- 预期: ${tc?.expectedOutput ?? ''}`,
      `- 实际: ${r.actualOutput.slice(0, 500)}`,
      `- 评估理由: ${r.reason}`,
    ].join('\n')
  }).join('\n\n')

  const prompt = fillTemplate(EVAL_OVERALL_PROMPT, {
    promptContent: promptData.content,
    testResults: testResultsText,
  })

  const response = await provider.chat(
    [{ role: 'user', content: prompt }],
    { temperature: 0.3 }
  )

  try {
    const report = extractJson<TestReport>(response)
    return {
      summary: report.summary || '评估完成',
      totalCases: cases.length,
      passedCases: results.filter((r) => r.passed).length,
      score: Math.max(0, Math.min(100, Number(report.score) || 0)),
      improvements: Array.isArray(report.improvements) ? report.improvements : [],
      details: report.details || '',
    }
  } catch {
    console.error('[TestEvaluator] Failed to parse overall evaluation:', response)
    const passedCount = results.filter((r) => r.passed).length
    const avgScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0
    return {
      summary: '整体评估解析失败，使用自动计算的评分',
      totalCases: cases.length,
      passedCases: passedCount,
      score: avgScore,
      improvements: [],
      details: '',
    }
  }
}
```

**Step 2: 验证构建并 Commit**

```bash
npx next build
git add src/lib/ai/test-evaluator.ts
git commit -m "feat: 实现测试评估引擎 (test-evaluator)"
```

---

### Task 11: 测试专用 Agent 提示词 + Agent 集成

**Files:**
- Create: `src/lib/ai/test-agent-prompt.ts`
- Modify: `src/lib/ai/agent.ts`
- Modify: `src/lib/ai/stream-handler.ts`

**Step 1: 创建测试专用提示词**

`src/lib/ai/test-agent-prompt.ts`:

```typescript
import type { ChatMessage } from '@/types/ai'
import type { Message } from '@/types/database'

const TEST_SYSTEM_PROMPT = `你是一个专业的 Prompt 测试专家。你的任务是帮助用户创建高质量的测试集，用于评估 Prompt 的质量和效果。

## 你的工作流程

### 第一阶段：需求收集
1. 了解用户想要测试的 Prompt 类型和应用场景
2. 了解测试目标（功能覆盖、边界情况、异常处理等）
3. 确认需要生成的测试用例数量

### 第二阶段：规划
收集完需求后，输出规划方案，格式如下：

\`\`\`json
{
  "type": "plan",
  "keyPoints": [
    {
      "index": 1,
      "description": "描述测试类型和数量",
      "action": "create",
      "targetPromptTitle": "测试集名称"
    }
  ]
}
\`\`\`

### 第三阶段：生成测试集
用户确认规划后，生成完整的测试集。必须使用以下 JSON 格式输出：

\`\`\`json
{
  "type": "test-suite",
  "name": "测试集名称",
  "description": "测试集描述",
  "cases": [
    {
      "title": "用例标题",
      "context": "模拟的用户场景上下文",
      "input": "用户输入内容",
      "expectedOutput": "预期输出描述（不需要完全精确，描述要点即可）"
    }
  ]
}
\`\`\`

## 测试用例设计原则
1. **覆盖全面**：包括正常场景、边界场景、异常场景
2. **独立性**：每个用例应该能独立运行
3. **明确性**：预期输出描述要清晰，便于 LLM 评估
4. **多样性**：输入应覆盖不同类型的用户表达方式
5. **实用性**：测试场景应贴近实际使用场景

## 注意事项
- 每个测试用例的上下文（context）用于模拟用户的实际场景
- 预期输出不需要是精确的完整文本，而是描述输出应包含的要点和特征
- 测试用例数量由用户决定，默认建议 10 个
- 始终使用中文交互`

/**
 * Build messages for the test agent conversation.
 * Simpler than the main agent — no business info context, just session history.
 */
export function buildTestAgentMessages(
  sessionHistory: Message[],
  userMessage: string
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: TEST_SYSTEM_PROMPT },
  ]

  for (const msg of sessionHistory) {
    messages.push({ role: msg.role, content: msg.content })
  }

  messages.push({ role: 'user', content: userMessage })

  return messages
}
```

**Step 2: 修改 stream-handler.ts — 扩展 parseAgentOutput**

在 `parseAgentOutput` 函数中，更新 `bareJsonRegex` 以支持 `test-suite` 类型。

修改 `src/lib/ai/stream-handler.ts` 第 71 行的正则表达式：

将：
```typescript
    const bareJsonRegex = /\{[\s\n]*"type"\s*:\s*"(?:plan|preview|diff|memory)"[\s\S]*?\}(?:\s*\})?/g
```
改为：
```typescript
    const bareJsonRegex = /\{[\s\n]*"type"\s*:\s*"(?:plan|preview|diff|memory|test-suite)"[\s\S]*?\}(?:\s*\})?/g
```

同时更新第 76 行的类型检查：

将：
```typescript
        if (parsed.type === 'plan' || parsed.type === 'preview' || parsed.type === 'diff' || parsed.type === 'memory') {
```
改为：
```typescript
        if (parsed.type === 'plan' || parsed.type === 'preview' || parsed.type === 'diff' || parsed.type === 'memory' || parsed.type === 'test-suite') {
```

**Step 3: 修改 agent.ts — 新增测试模式入口**

在 `src/lib/ai/agent.ts` 中，在 `handleAgentChat` 函数之后新增 `handleTestAgentChat` 函数：

```typescript
import { buildTestAgentMessages } from './test-agent-prompt'
import { findMessagesBySession } from '@/lib/db/repositories/messages'

/**
 * Test Agent entry point — simplified version for test suite creation.
 * Uses test-specific system prompt and doesn't collect business context.
 */
export async function* handleTestAgentChat(
  sessionId: string,
  content: string
): AsyncGenerator<StreamEvent> {
  try {
    console.log('[TestAgent] === Chat started ===', { sessionId })

    // 1. Save user message
    createMessage({
      sessionId,
      role: 'user',
      content,
      references: [],
      metadata: null,
    })

    // 2. Prepare AI provider (use global settings)
    const settings = getSettings()
    const provider = createAiProvider(settings)

    // 3. Build messages with session history
    const history = findMessagesBySession(sessionId)
    const messages = buildTestAgentMessages(history.slice(-20), content)

    // 4. Stream response
    let accumulated = ''
    for await (const chunk of provider.chatStream(messages)) {
      accumulated += chunk
      yield { type: 'text', content: chunk }
    }

    // 5. Parse structured blocks
    const { jsonBlocks, plainText } = parseAgentOutput(accumulated)

    for (const block of jsonBlocks) {
      if (block.type === 'plan') {
        yield {
          type: 'plan',
          data: {
            keyPoints: block.keyPoints as import('@/types/database').PlanData['keyPoints'],
            status: 'pending',
          },
        }
      } else if (block.type === 'test-suite') {
        yield {
          type: 'test-suite' as StreamEvent['type'],
          data: block,
        } as StreamEvent
      }
    }

    // 6. Persist assistant message
    createMessage({
      sessionId,
      role: 'assistant',
      content: plainText || accumulated,
      references: [],
      metadata: null,
    })

    console.log('[TestAgent] === Chat complete ===')
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    console.error('[TestAgent] === Chat FAILED ===', message)
    yield { type: 'error', message }
  }
}
```

注意：需要在文件顶部添加新的 import。在已有 import 中新增：

```typescript
import { buildTestAgentMessages } from './test-agent-prompt'
import { findMessagesBySession } from '@/lib/db/repositories/messages'
```

**Step 4: 新增测试聊天 API 路由**

创建 `src/app/api/ai/test-chat/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { handleTestAgentChat } from '@/lib/ai/agent'
import { createSSEStream } from '@/lib/ai/stream-handler'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sessionId, content } = body

  if (!sessionId || typeof sessionId !== 'string') {
    return new Response(
      JSON.stringify({ success: false, data: null, error: 'sessionId is required' }),
      { status: 400 }
    )
  }

  const generator = handleTestAgentChat(sessionId, content || '')
  const stream = createSSEStream(generator)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

**Step 5: 验证构建并 Commit**

```bash
npx next build
git add src/lib/ai/test-agent-prompt.ts src/lib/ai/agent.ts src/lib/ai/stream-handler.ts src/app/api/ai/test-chat/route.ts
git commit -m "feat: 实现测试 Agent 提示词和对话流程"
```

---

## Phase 4: 客户端工具

### Task 12: API Client 扩展

**Files:**
- Modify: `src/lib/utils/api-client.ts`

**Step 1: 在 api-client.ts 末尾新增测试相关 API**

在 `memoriesApi` 之后追加：

```typescript
import type {
  TestSuite,
  TestCase,
  TestRun,
} from '@/types/database'
import type {
  CreateTestSuiteRequest,
  UpdateTestSuiteRequest,
  CreateTestCaseRequest,
  UpdateTestCaseRequest,
} from '@/types/api'

// Test Suites
export const testSuitesApi = {
  listByProject: (projectId: string) =>
    fetchApi<TestSuite[]>(`/api/projects/${projectId}/test-suites`),
  get: (id: string) =>
    fetchApi<TestSuite & { cases: TestCase[] }>(`/api/test-suites/${id}`),
  create: (projectId: string, data: CreateTestSuiteRequest) =>
    fetchApi<TestSuite>(`/api/projects/${projectId}/test-suites`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateTestSuiteRequest) =>
    fetchApi<TestSuite>(`/api/test-suites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<null>(`/api/test-suites/${id}`, { method: 'DELETE' }),
}

// Test Cases
export const testCasesApi = {
  listBySuite: (suiteId: string) =>
    fetchApi<TestCase[]>(`/api/test-suites/${suiteId}/cases`),
  create: (suiteId: string, data: CreateTestCaseRequest) =>
    fetchApi<TestCase>(`/api/test-suites/${suiteId}/cases`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createBatch: (suiteId: string, cases: CreateTestCaseRequest[]) =>
    fetchApi<TestCase[]>(`/api/test-suites/${suiteId}/cases`, {
      method: 'POST',
      body: JSON.stringify(cases),
    }),
  update: (id: string, data: UpdateTestCaseRequest) =>
    fetchApi<TestCase>(`/api/test-cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<null>(`/api/test-cases/${id}`, { method: 'DELETE' }),
}

// Test Runs
export const testRunsApi = {
  listBySuite: (suiteId: string) =>
    fetchApi<TestRun[]>(`/api/test-suites/${suiteId}/runs`),
  get: (id: string) =>
    fetchApi<TestRun>(`/api/test-runs/${id}`),
}
```

注意：需要在文件顶部的 import 中补充新类型。将：

```typescript
import type {
  GlobalSettings,
  Project,
  Prompt,
  Document,
  Session,
  Message,
  Memory,
  PromptVersion,
} from '@/types/database'
```

改为：

```typescript
import type {
  GlobalSettings,
  Project,
  Prompt,
  Document,
  Session,
  Message,
  Memory,
  PromptVersion,
  TestSuite,
  TestCase,
  TestRun,
} from '@/types/database'
```

同样将：

```typescript
import type { ApiResponse, CreateMemoryRequest, UpdateMemoryRequest } from '@/types/api'
```

改为：

```typescript
import type {
  ApiResponse,
  CreateMemoryRequest,
  UpdateMemoryRequest,
  CreateTestSuiteRequest,
  UpdateTestSuiteRequest,
  CreateTestCaseRequest,
  UpdateTestCaseRequest,
} from '@/types/api'
```

**Step 2: 验证构建并 Commit**

```bash
npx next build
git add src/lib/utils/api-client.ts
git commit -m "feat: 新增测试相关 API 客户端"
```

---

### Task 13: SSE Client — 测试对话和测试运行

**Files:**
- Modify: `src/lib/utils/sse-client.ts`

**Step 1: 读取现有 sse-client.ts 了解模式**

先阅读 `src/lib/utils/sse-client.ts` 了解已有的 `streamChat` 和 `applyPrompt` 函数模式。

**Step 2: 在 sse-client.ts 末尾新增两个函数**

```typescript
import type { TestRunEvent, TestSuiteGenerationData } from '@/types/ai'

/**
 * Stream a test agent chat conversation.
 * Similar to streamChat but uses the test-chat endpoint.
 */
export async function* streamTestChat(
  sessionId: string,
  content: string
): AsyncGenerator<StreamEvent> {
  const response = await fetch('/api/ai/test-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, content }),
  })

  if (!response.ok || !response.body) {
    throw new Error('测试对话请求失败')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6)) as StreamEvent
          yield event
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

/**
 * Stream a test run execution with real-time progress.
 */
export async function* streamTestRun(
  suiteId: string,
  promptId: string
): AsyncGenerator<TestRunEvent> {
  const response = await fetch(`/api/test-suites/${suiteId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptId }),
  })

  if (!response.ok || !response.body) {
    throw new Error('测试运行请求失败')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6)) as TestRunEvent
          yield event
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}
```

注意：需要在文件顶部添加 import（如果 `StreamEvent` 已有则只需添加 `TestRunEvent`）。

**Step 3: 验证构建并 Commit**

```bash
npx next build
git add src/lib/utils/sse-client.ts
git commit -m "feat: 新增测试对话和测试运行 SSE 客户端"
```

---

## Phase 5: UI 组件

### Task 14: 测试集列表组件（侧边栏）

**Files:**
- Create: `src/components/test/test-suite-list.tsx`

**Step 1: 创建测试集列表组件**

```typescript
"use client"

import { Plus, FlaskConical, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface TestSuiteListProps {
  suites: Array<{ id: string; name: string; status: string }>
  currentSuiteId: string | null
  onSuiteClick: (id: string) => void
  onNewSuite: () => void
  onDeleteSuite?: (id: string) => void
}

function getTestStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed":
      return "default"
    case "ready":
      return "secondary"
    case "running":
      return "default"
    default:
      return "outline"
  }
}

function getTestStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "草稿"
    case "ready":
      return "就绪"
    case "running":
      return "运行中"
    case "completed":
      return "已完成"
    default:
      return status
  }
}

export function TestSuiteList({
  suites,
  currentSuiteId,
  onSuiteClick,
  onNewSuite,
  onDeleteSuite,
}: TestSuiteListProps) {
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FlaskConical className="size-3.5" />
          <span>测试 ({suites.length})</span>
        </div>
        <button
          onClick={onNewSuite}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          title="新建测试集"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-px px-2 pb-1">
        {suites.length === 0 && (
          <p className="px-4 py-1 text-xs text-muted-foreground">暂无测试集</p>
        )}
        {suites.map((suite) => (
          <div
            key={suite.id}
            className={cn(
              "group flex w-full items-center gap-1 px-4 py-1 text-left hover:bg-accent transition-colors rounded-sm",
              currentSuiteId === suite.id && "bg-accent"
            )}
          >
            <button
              onClick={() => onSuiteClick(suite.id)}
              className="flex flex-1 items-center gap-2 min-w-0"
            >
              <span className="flex-1 truncate text-xs text-left" title={suite.name}>
                {suite.name.length > 10 ? suite.name.slice(0, 10) + '...' : suite.name}
              </span>
              <Badge
                variant={getTestStatusVariant(suite.status)}
                className="shrink-0 text-[10px] px-1 py-0"
              >
                {getTestStatusLabel(suite.status)}
              </Badge>
            </button>
            {onDeleteSuite && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSuite(suite.id) }}
                className="hidden group-hover:block shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                title="删除测试集"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: 验证构建并 Commit**

```bash
npx next build
git add src/components/test/test-suite-list.tsx
git commit -m "feat: 新增测试集列表侧边栏组件"
```

---

### Task 15: 测试集详情页

**Files:**
- Create: `src/components/test/test-suite-detail.tsx`

**Step 1: 创建测试集详情组件**

此组件是最核心的 UI——显示测试集信息、用例列表、运行按钮、报告。

```typescript
"use client"

import { useState, useCallback } from "react"
import { Play, Plus, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { TestSuite, TestCase, TestRun, TestCaseResult, TestReport, TestSuiteConfig, Prompt } from "@/types/database"
import type { TestRunEvent } from "@/types/ai"
import { TestCaseEditor } from "./test-case-editor"
import { TestRunConfig } from "./test-run-config"
import { TestReportView } from "./test-report"
import { testSuitesApi, testCasesApi } from "@/lib/utils/api-client"
import { streamTestRun } from "@/lib/utils/sse-client"

interface TestSuiteDetailProps {
  suite: TestSuite
  cases: TestCase[]
  latestRun: TestRun | null
  prompts: Array<{ id: string; title: string }>
  onSuiteUpdate: () => void
  onCaseUpdate: () => void
}

export function TestSuiteDetail({
  suite,
  cases,
  latestRun,
  prompts,
  onSuiteUpdate,
  onCaseUpdate,
}: TestSuiteDetailProps) {
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null)
  const [addingCase, setAddingCase] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runProgress, setRunProgress] = useState<{
    phase: 'running' | 'evaluating' | 'done'
    current: number
    total: number
    results: TestCaseResult[]
    report: TestReport | null
  } | null>(null)

  const handleRun = useCallback(async (promptId: string) => {
    setIsRunning(true)
    setRunProgress({ phase: 'running', current: 0, total: cases.length, results: [], report: null })

    try {
      for await (const event of streamTestRun(suite.id, promptId)) {
        switch (event.type) {
          case 'test-start':
            setRunProgress((prev) => prev ? { ...prev, total: event.data.totalCases } : prev)
            break
          case 'test-case-start':
            setRunProgress((prev) => prev ? { ...prev, current: event.data.index + 1 } : prev)
            break
          case 'eval-start':
            setRunProgress((prev) => prev ? { ...prev, phase: 'evaluating', current: 0 } : prev)
            break
          case 'eval-case-done':
            setRunProgress((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                current: prev.current + 1,
                results: [...prev.results, {
                  testCaseId: event.data.caseId,
                  actualOutput: '',
                  passed: event.data.passed,
                  score: event.data.score,
                  reason: event.data.reason,
                }],
              }
            })
            break
          case 'eval-report':
            setRunProgress((prev) => prev ? { ...prev, report: event.data } : prev)
            break
          case 'test-complete':
            setRunProgress((prev) => prev ? { ...prev, phase: 'done' } : prev)
            break
          case 'test-error':
            console.error('[TestRun] Error:', event.data.error)
            break
        }
      }
    } catch (error) {
      console.error('Test run failed:', error)
    } finally {
      setIsRunning(false)
      onSuiteUpdate()
    }
  }, [suite.id, cases.length, onSuiteUpdate])

  const handleAddCase = async (data: { title: string; context: string; input: string; expectedOutput: string }) => {
    await testCasesApi.create(suite.id, data)
    setAddingCase(false)
    onCaseUpdate()
  }

  const handleUpdateCase = async (id: string, data: { title?: string; context?: string; input?: string; expectedOutput?: string }) => {
    await testCasesApi.update(id, data)
    setEditingCaseId(null)
    onCaseUpdate()
  }

  const handleDeleteCase = async (id: string) => {
    await testCasesApi.delete(id)
    onCaseUpdate()
  }

  const handleConfirmSuite = async () => {
    await testSuitesApi.update(suite.id, { status: 'ready' })
    onSuiteUpdate()
  }

  const handleConfigSave = async (config: TestSuiteConfig) => {
    await testSuitesApi.update(suite.id, { config })
    setConfigOpen(false)
    onSuiteUpdate()
  }

  // Find matching result for a test case from latest run
  const getResultForCase = (caseId: string): TestCaseResult | undefined => {
    if (runProgress?.results.length) {
      return runProgress.results.find((r) => r.testCaseId === caseId)
    }
    return latestRun?.results.find((r) => r.testCaseId === caseId)
  }

  const canRun = (suite.status === 'ready' || suite.status === 'completed') && cases.length > 0 && !isRunning
  const report = runProgress?.report ?? latestRun?.report

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{suite.name}</h2>
          {suite.description && (
            <p className="text-sm text-muted-foreground mt-1">{suite.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={suite.status === 'ready' || suite.status === 'completed' ? 'default' : 'secondary'}>
            {suite.status === 'draft' ? '草稿' : suite.status === 'ready' ? '就绪' : suite.status === 'running' ? '运行中' : '已完成'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings2 className="size-4 mr-1" />
            配置
          </Button>
          {suite.status === 'draft' && cases.length > 0 && (
            <Button size="sm" onClick={handleConfirmSuite}>
              确认测试集
            </Button>
          )}
          {canRun && (
            <Button size="sm" onClick={() => {
              if (suite.promptId) {
                handleRun(suite.promptId)
              } else {
                setConfigOpen(true)
              }
            }}>
              <Play className="size-4 mr-1" />
              运行测试
            </Button>
          )}
        </div>
      </div>

      {/* Run Progress */}
      {isRunning && runProgress && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">
                {runProgress.phase === 'running'
                  ? `执行中 ${runProgress.current}/${runProgress.total}`
                  : runProgress.phase === 'evaluating'
                    ? `评估中 ${runProgress.current}/${runProgress.total}`
                    : '完成'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Summary */}
      {report && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold">{report.score}分</div>
              <div className="text-sm text-muted-foreground">
                {report.passedCases}/{report.totalCases} 通过
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Test Cases */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">测试用例 ({cases.length})</h3>
          <Button variant="outline" size="sm" onClick={() => setAddingCase(true)}>
            <Plus className="size-3 mr-1" />
            添加用例
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          {cases.map((tc, index) => {
            const result = getResultForCase(tc.id)
            const isExpanded = expandedCaseId === tc.id
            const isEditing = editingCaseId === tc.id

            if (isEditing) {
              return (
                <TestCaseEditor
                  key={tc.id}
                  initialData={tc}
                  onSave={(data) => handleUpdateCase(tc.id, data)}
                  onCancel={() => setEditingCaseId(null)}
                />
              )
            }

            return (
              <Card key={tc.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedCaseId(isExpanded ? null : tc.id)}
                  className="flex w-full items-center gap-2 p-3 text-left hover:bg-accent/50 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                  {result ? (
                    result.passed
                      ? <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                      : <XCircle className="size-4 shrink-0 text-red-500" />
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}
                  <span className="flex-1 text-sm font-medium">#{index + 1} {tc.title}</span>
                  {result && (
                    <Badge variant={result.passed ? "default" : "destructive"} className="text-xs">
                      {result.score}分
                    </Badge>
                  )}
                </button>
                {isExpanded && (
                  <CardContent className="pt-0 pb-3">
                    <div className="flex flex-col gap-2 text-sm">
                      {tc.context && (
                        <div>
                          <span className="font-medium text-muted-foreground">上下文：</span>
                          <p className="mt-0.5 whitespace-pre-wrap">{tc.context}</p>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-muted-foreground">输入：</span>
                        <p className="mt-0.5 whitespace-pre-wrap">{tc.input}</p>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">预期输出：</span>
                        <p className="mt-0.5 whitespace-pre-wrap">{tc.expectedOutput}</p>
                      </div>
                      {result && (
                        <>
                          <Separator />
                          <div>
                            <span className="font-medium text-muted-foreground">实际输出：</span>
                            <p className="mt-0.5 whitespace-pre-wrap">{result.actualOutput || '（无）'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">评估：</span>
                            <p className="mt-0.5">{result.reason}</p>
                          </div>
                        </>
                      )}
                      <div className="flex gap-2 mt-1">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingCaseId(tc.id) }}>
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteCase(tc.id) }}>
                          删除
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}

          {addingCase && (
            <TestCaseEditor
              onSave={handleAddCase}
              onCancel={() => setAddingCase(false)}
            />
          )}
        </div>
      </div>

      {/* Report */}
      {report && (
        <>
          <Separator />
          <TestReportView report={report} />
        </>
      )}

      {/* Config Dialog */}
      <TestRunConfig
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={suite.config}
        promptId={suite.promptId}
        prompts={prompts}
        onSave={handleConfigSave}
        onRunWithPrompt={(promptId) => {
          setConfigOpen(false)
          handleRun(promptId)
        }}
      />
    </div>
  )
}
```

**Step 2: 验证构建**

注意：此组件依赖 3 个子组件（TestCaseEditor, TestRunConfig, TestReportView），需先创建占位。下面的 Task 会实现它们。

**Step 3: Commit（和后续子组件一起）**

---

### Task 16: 测试用例编辑器

**Files:**
- Create: `src/components/test/test-case-editor.tsx`

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"

interface TestCaseEditorProps {
  initialData?: {
    title: string
    context: string
    input: string
    expectedOutput: string
  }
  onSave: (data: { title: string; context: string; input: string; expectedOutput: string }) => void
  onCancel: () => void
}

export function TestCaseEditor({ initialData, onSave, onCancel }: TestCaseEditorProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [context, setContext] = useState(initialData?.context ?? '')
  const [input, setInput] = useState(initialData?.input ?? '')
  const [expectedOutput, setExpectedOutput] = useState(initialData?.expectedOutput ?? '')

  const handleSave = () => {
    if (!title.trim() || !input.trim() || !expectedOutput.trim()) return
    onSave({ title: title.trim(), context: context.trim(), input: input.trim(), expectedOutput: expectedOutput.trim() })
  }

  return (
    <Card>
      <CardContent className="py-3 flex flex-col gap-2">
        <Input
          placeholder="用例标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          placeholder="上下文（可选，模拟用户场景）"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
        />
        <Textarea
          placeholder="用户输入"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
        />
        <Textarea
          placeholder="预期输出描述"
          value={expectedOutput}
          onChange={(e) => setExpectedOutput(e.target.value)}
          rows={2}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>取消</Button>
          <Button size="sm" onClick={handleSave} disabled={!title.trim() || !input.trim() || !expectedOutput.trim()}>
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

### Task 17: 测试运行配置弹窗

**Files:**
- Create: `src/components/test/test-run-config.tsx`

```typescript
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TestSuiteConfig } from "@/types/database"

interface TestRunConfigProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: TestSuiteConfig
  promptId: string | null
  prompts: Array<{ id: string; title: string }>
  onSave: (config: TestSuiteConfig) => void
  onRunWithPrompt: (promptId: string) => void
}

export function TestRunConfig({
  open,
  onOpenChange,
  config,
  promptId,
  prompts,
  onSave,
  onRunWithPrompt,
}: TestRunConfigProps) {
  const [provider, setProvider] = useState(config.provider)
  const [model, setModel] = useState(config.model)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [selectedPromptId, setSelectedPromptId] = useState(promptId ?? '')

  useEffect(() => {
    setProvider(config.provider)
    setModel(config.model)
    setApiKey(config.apiKey)
    setBaseUrl(config.baseUrl)
    setSelectedPromptId(promptId ?? '')
  }, [config, promptId])

  const handleSave = () => {
    onSave({ provider, model, apiKey, baseUrl })
  }

  const handleRun = () => {
    if (!selectedPromptId) return
    onSave({ provider, model, apiKey, baseUrl })
    onRunWithPrompt(selectedPromptId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>测试配置</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium">被测 Prompt</label>
            <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="选择 Prompt" />
              </SelectTrigger>
              <SelectContent>
                {prompts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Provider</label>
            <Input className="mt-1" placeholder="openai / claude / deepseek / ..." value={provider} onChange={(e) => setProvider(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Model</label>
            <Input className="mt-1" placeholder="gpt-4o / claude-3-opus ..." value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input className="mt-1" type="password" placeholder="sk-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Base URL（可选）</label>
            <Input className="mt-1" placeholder="https://api.openai.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={handleSave}>保存配置</Button>
            <Button onClick={handleRun} disabled={!selectedPromptId || !model || !apiKey}>
              保存并运行
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Task 18: 测试报告组件

**Files:**
- Create: `src/components/test/test-report.tsx`

```typescript
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TestReport } from "@/types/database"

interface TestReportViewProps {
  report: TestReport
}

export function TestReportView({ report }: TestReportViewProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">测试报告</h3>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{report.score}</div>
              <div className="text-xs text-muted-foreground">总分</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{report.passedCases}/{report.totalCases}</div>
              <div className="text-xs text-muted-foreground">通过率</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {report.totalCases > 0 ? Math.round((report.passedCases / report.totalCases) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">通过百分比</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {report.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">总结</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{report.summary}</p>
          </CardContent>
        </Card>
      )}

      {report.improvements.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">改进建议</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-sm space-y-1">
              {report.improvements.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {report.details && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">详细分析</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{report.details}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

**Step（合并 commit）: 验证构建并 Commit**

```bash
npx next build
git add src/components/test/
git commit -m "feat: 新增测试 UI 组件 (详情页、用例编辑器、运行配置、报告)"
```

---

### Task 19: 测试集对话卡片

**Files:**
- Create: `src/components/test/test-suite-card.tsx`

用于对话中展示 Agent 生成的测试集预览。

```typescript
"use client"

import { FlaskConical, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TestSuiteGenerationData } from "@/types/ai"

interface TestSuiteCardProps {
  data: TestSuiteGenerationData
  onConfirm: (data: TestSuiteGenerationData) => void
}

export function TestSuiteCard({ data, onConfirm }: TestSuiteCardProps) {
  return (
    <Card className="my-2 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FlaskConical className="size-4 text-blue-500" />
          测试集：{data.name}
        </CardTitle>
        {data.description && (
          <p className="text-xs text-muted-foreground">{data.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1 mb-3">
          {data.cases.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-0.5">
              <span className="text-muted-foreground w-6">#{i + 1}</span>
              <span className="flex-1 truncate">{c.title}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          共 {data.cases.length} 个测试用例
        </p>
        <Button size="sm" onClick={() => onConfirm(data)}>
          <CheckCircle2 className="size-3 mr-1" />
          确认创建
        </Button>
      </CardContent>
    </Card>
  )
}
```

**Step: 验证构建并 Commit**

```bash
npx next build
git add src/components/test/test-suite-card.tsx
git commit -m "feat: 新增测试集对话卡片组件"
```

---

## Phase 6: 集成

### Task 20: 侧边栏集成

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: 在 Sidebar 组件中新增测试集区域**

在 `SidebarProps` 中添加测试相关 props：

```typescript
  testSuites?: Array<{ id: string; name: string; status: string }>
  currentTestSuiteId?: string | null
  onTestSuiteClick?: (id: string) => void
  onNewTestSuite?: () => void
  onDeleteTestSuite?: (id: string) => void
```

在 `Sidebar` 函数参数中添加对应的解构。

在 `{/* Settings Link */}` 之前，`</CollapsibleGroup>` (Documents group 结束) 之后添加：

```tsx
            {/* Test Suites Group */}
            {testSuites && (
              <CollapsibleGroup
                label={
                  <span className="flex items-center gap-1">
                    <span>🧪</span>
                    <span>测试</span>
                  </span>
                }
                count={testSuites.length}
                actions={onNewTestSuite ? [{ icon: <Plus className="size-3" />, title: "新建测试集", onClick: onNewTestSuite }] : []}
              >
                {testSuites.length === 0 && (
                  <p className="px-6 py-1 text-xs text-muted-foreground">暂无测试集</p>
                )}
                {testSuites.map((suite) => (
                  <div
                    key={suite.id}
                    className={cn(
                      "group flex w-full items-center gap-1 px-6 py-1 text-left hover:bg-accent transition-colors rounded-sm",
                      currentTestSuiteId === suite.id && "bg-accent"
                    )}
                  >
                    <button
                      onClick={() => onTestSuiteClick?.(suite.id)}
                      className="flex flex-1 items-center gap-2 min-w-0"
                    >
                      <span className="flex-1 truncate text-xs text-left" title={suite.name}>
                        {truncateText(suite.name)}
                      </span>
                      <Badge
                        variant={suite.status === 'completed' || suite.status === 'ready' ? 'default' : 'secondary'}
                        className="shrink-0 text-[10px] px-1 py-0"
                      >
                        {suite.status === 'draft' ? '草稿' : suite.status === 'ready' ? '就绪' : suite.status === 'running' ? '运行中' : '已完成'}
                      </Badge>
                    </button>
                    {onDeleteTestSuite && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteTestSuite(suite.id) }}
                        className="hidden group-hover:block shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="删除测试集"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
              </CollapsibleGroup>
            )}
```

**Step 2: 验证构建并 Commit**

```bash
npx next build
git add src/components/layout/sidebar.tsx
git commit -m "feat: 侧边栏集成测试集分组"
```

---

### Task 21: 主页面集成

**Files:**
- Modify: `src/app/(main)/page.tsx`

这是最大的集成步骤。需要做以下修改：

**Step 1: 添加 imports**

在文件顶部的 import 中添加：

```typescript
import { TestSuiteDetail } from "@/components/test/test-suite-detail"
import { TestSuiteCard } from "@/components/test/test-suite-card"
import { testSuitesApi, testCasesApi, testRunsApi } from "@/lib/utils/api-client"
import { streamTestChat } from "@/lib/utils/sse-client"
import type { TestSuite, TestCase, TestRun, TestSuiteConfig } from "@/types/database"
import type { TestSuiteGenerationData } from "@/types/ai"
```

**Step 2: 新增 state 变量**

在 `const [projectMemories, setProjectMemories] = useState<Memory[]>([])` 之后添加：

```typescript
  // Test state
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [currentTestSuiteId, setCurrentTestSuiteId] = useState<string | null>(null)
  const [currentTestCases, setCurrentTestCases] = useState<TestCase[]>([])
  const [currentTestRun, setCurrentTestRun] = useState<TestRun | null>(null)
  const [testMode, setTestMode] = useState(false) // true when in test creation conversation
```

**Step 3: 在项目数据加载 useEffect 中加载测试集**

在 `useEffect` 中 `sessionsApi.listByProject(...)` 之后添加：

```typescript
    testSuitesApi.listByProject(currentProjectId).then(setTestSuites).catch(console.error)
```

**Step 4: 新增 RightPanelView 类型**

在 `RightPanelView` 联合类型中添加：

```typescript
  | { type: "test-suite-detail"; id: string }
```

**Step 5: 新增测试集相关 handler**

在 `handleEditInPanel` 之后添加：

```typescript
  // Test suite handlers
  const refreshTestSuites = useCallback(() => {
    if (!currentProjectId) return
    testSuitesApi.listByProject(currentProjectId).then(setTestSuites).catch(console.error)
  }, [currentProjectId])

  const handleNewTestSuite = async () => {
    if (!currentProjectId) return
    // Create a test session and switch to test mode
    const session = await sessionsApi.create(currentProjectId, '新建测试集')
    setSessions((prev) => [session, ...prev])
    setCurrentSessionId(session.id)
    setTestMode(true)
  }

  const handleTestSuiteClick = async (id: string) => {
    try {
      const data = await testSuitesApi.get(id)
      setCurrentTestSuiteId(id)
      setCurrentTestCases(data.cases)
      setTestMode(false)
      // Load latest run
      const runs = await testRunsApi.listBySuite(id)
      setCurrentTestRun(runs.length > 0 ? runs[0] : null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteTestSuite = async (id: string) => {
    try {
      await testSuitesApi.delete(id)
      refreshTestSuites()
      if (currentTestSuiteId === id) {
        setCurrentTestSuiteId(null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleConfirmTestSuite = async (data: TestSuiteGenerationData) => {
    if (!currentProjectId || !currentSessionId) return
    try {
      // Create test suite
      const suite = await testSuitesApi.create(currentProjectId, {
        name: data.name,
        description: data.description,
        sessionId: currentSessionId,
      })
      // Create test cases in batch
      await testCasesApi.createBatch(suite.id, data.cases)
      refreshTestSuites()
      // Switch to test suite detail view
      handleTestSuiteClick(suite.id)
    } catch (e) {
      console.error('Create test suite failed:', e)
    }
  }
```

**Step 6: 更新主内容区渲染**

在 `<main>` 内的 `<ChatArea>` 之前添加条件判断，当查看测试集详情时显示 `TestSuiteDetail` 而不是 `ChatArea`：

将：
```tsx
        <main className="flex flex-1 overflow-hidden">
          <ChatArea
            ...
          />
        </main>
```

改为：
```tsx
        <main className="flex flex-1 overflow-hidden">
          {currentTestSuiteId && !testMode ? (
            <div className="flex-1 overflow-hidden">
              <TestSuiteDetail
                suite={testSuites.find((s) => s.id === currentTestSuiteId)!}
                cases={currentTestCases}
                latestRun={currentTestRun}
                prompts={prompts.map((p) => ({ id: p.id, title: p.title }))}
                onSuiteUpdate={() => {
                  refreshTestSuites()
                  if (currentTestSuiteId) {
                    testSuitesApi.get(currentTestSuiteId).then((data) => {
                      setCurrentTestCases(data.cases)
                    }).catch(console.error)
                    testRunsApi.listBySuite(currentTestSuiteId).then((runs) => {
                      setCurrentTestRun(runs.length > 0 ? runs[0] : null)
                    }).catch(console.error)
                  }
                }}
                onCaseUpdate={() => {
                  if (currentTestSuiteId) {
                    testCasesApi.listBySuite(currentTestSuiteId).then(setCurrentTestCases).catch(console.error)
                  }
                }}
              />
            </div>
          ) : (
            <ChatArea
              messages={messages}
              sessionId={currentSessionId}
              prompts={prompts.map((p) => ({ id: p.id, title: p.title }))}
              documents={documents.map((d) => ({ id: d.id, name: d.name }))}
              onMessagesChange={refreshMessages}
              onApplyPreview={handleApplyPreview}
              onApplyDiff={handleApplyDiff}
              onEditInPanel={handleEditInPanel}
              onViewHistory={(promptId) => {
                const byId = prompts.find((p) => p.id === promptId)
                const resolved = byId ?? prompts.find((p) => p.title === promptId)
                if (resolved) handleViewHistory(resolved.id)
              }}
              onNewSession={handleNewSession}
              onMemoryCommand={(data) => {
                if (data.command === 'create' || data.command === 'delete') {
                  refreshProjectMemories()
                }
              }}
            />
          )}
        </main>
```

**Step 7: 更新 Sidebar 调用，传入测试相关 props**

在 `<Sidebar>` 组件调用中添加：

```tsx
          testSuites={testSuites.map((s) => ({ id: s.id, name: s.name, status: s.status }))}
          currentTestSuiteId={currentTestSuiteId}
          onTestSuiteClick={(id) => {
            setCurrentTestSuiteId(id)
            handleTestSuiteClick(id)
          }}
          onNewTestSuite={handleNewTestSuite}
          onDeleteTestSuite={handleDeleteTestSuite}
```

**Step 8: 切换会话时清除测试集选中状态**

在 `onSessionSelect` 的处理中，也需要清除测试集选中：

```typescript
          onSessionSelect={(id) => {
            setCurrentSessionId(id)
            setCurrentTestSuiteId(null)
            setTestMode(false)
          }}
```

**Step 9: 验证构建并 Commit**

```bash
npx next build
git add src/app/\(main\)/page.tsx
git commit -m "feat: 主页面集成测试功能"
```

---

### Task 22: ChatArea 集成测试集卡片

**Files:**
- Modify: `src/components/chat/chat-area.tsx` (或 `message-bubble.tsx`)

需要在聊天消息中渲染 `test-suite` 类型的事件。具体修改取决于现有 chat 组件如何处理 plan/preview/diff 卡片。

**Step 1: 阅读 chat-area.tsx 和 message-bubble.tsx**

了解现有的事件卡片渲染模式。

**Step 2: 在聊天区的 SSE 事件处理中新增 test-suite 事件**

在处理 SSE 事件的 switch 或 if-else 链中，添加：

```typescript
case 'test-suite':
  // Store test suite generation data for rendering
  setTestSuiteData(event.data)
  break
```

**Step 3: 在消息渲染中添加 TestSuiteCard**

在 assistant 消息下方，当有 testSuiteData 时渲染：

```tsx
{testSuiteData && (
  <TestSuiteCard
    data={testSuiteData}
    onConfirm={onConfirmTestSuite}
  />
)}
```

具体修改位置取决于现有代码结构。需要阅读文件后确定。

**Step 4: 验证构建并 Commit**

```bash
npx next build
git add src/components/chat/
git commit -m "feat: 对话区集成测试集卡片渲染"
```

---

### Task 23: 最终验证和清理

**Step 1: 完整构建验证**

```bash
cd /Users/cs001/prompt-studio && npx next build
```

**Step 2: 启动开发服务器手动验证**

```bash
npm run dev
```

验证清单：
- [ ] 侧边栏显示测试分组
- [ ] 点击「新建测试集」进入对话模式
- [ ] Agent 能对话并生成测试集
- [ ] 确认创建后测试集出现在侧边栏
- [ ] 点击测试集展示详情页
- [ ] 能编辑/新增/删除测试用例
- [ ] 确认测试集后状态变为 ready
- [ ] 配置 model/key 后能运行测试
- [ ] 运行中显示实时进度
- [ ] 完成后显示评分和报告

**Step 3: Final Commit**

```bash
git add -A
git commit -m "feat: 自动化测试功能完整实现"
```

---

## 任务依赖关系

```
Task 1 (Schema) → Task 2 (Types) → Task 3-5 (Repositories) → Task 6-8 (API Routes)
                                                                      ↓
Task 11 (Agent Prompt + Integration) ← Task 9 (Runner) ← Task 10 (Evaluator)
                     ↓
Task 12 (API Client) → Task 13 (SSE Client) → Task 14-19 (UI Components)
                                                        ↓
                                              Task 20 (Sidebar) → Task 21 (Main Page) → Task 22 (ChatArea) → Task 23 (Verify)
```

## 注意事项

1. **Next.js 16 路由参数**：`params` 是 `Promise`，需要 `await params`
2. **数据库初始化**：`getDb()` 在首次调用时自动执行 `schema.sql`，新增的表会自动创建
3. **Stream 类型**：`TestRunEvent` 是独立于 `StreamEvent` 的类型，用于测试运行 SSE
4. **文件大小**：`test-suite-detail.tsx` 约 250 行，如果过长可后续拆分
5. **shadcn/ui 组件**：确保 `Select`, `Dialog` 等组件已安装。如未安装，需先运行 `npx shadcn@latest add select dialog`
