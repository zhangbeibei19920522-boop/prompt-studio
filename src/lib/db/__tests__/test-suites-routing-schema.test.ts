import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

interface RoutingRepositories {
  createTestSuite: typeof import('@/lib/db/repositories/test-suites').createTestSuite
  findTestSuiteById: typeof import('@/lib/db/repositories/test-suites').findTestSuiteById
  updateTestSuite: typeof import('@/lib/db/repositories/test-suites').updateTestSuite
  createTestCase: typeof import('@/lib/db/repositories/test-cases').createTestCase
  createTestCasesBatch: typeof import('@/lib/db/repositories/test-cases').createTestCasesBatch
  findTestCasesBySuite: typeof import('@/lib/db/repositories/test-cases').findTestCasesBySuite
}

async function setupRoutingRepositoryTest() {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-suites-routing-schema-'))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import('@/lib/db')
  const db = getDb()

  const repositories = {
    ...(await import('@/lib/db/repositories/test-suites')),
    ...(await import('@/lib/db/repositories/test-cases')),
  } as RoutingRepositories

  const now = '2026-03-20T00:00:00.000Z'

  db.prepare(`
    INSERT INTO projects (
      id,
      name,
      description,
      business_description,
      business_goal,
      business_background,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('project-1', 'Project 1', '', '', '', '', now, now)

  db.prepare(`
    INSERT INTO prompts (
      id,
      project_id,
      title,
      content,
      description,
      tags,
      variables,
      version,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('prompt-a', 'project-1', 'Intent Router', 'router', '', '[]', '[]', 1, 'active', now, now)

  db.prepare(`
    INSERT INTO prompts (
      id,
      project_id,
      title,
      content,
      description,
      tags,
      variables,
      version,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('prompt-b', 'project-1', 'Refund Reply', 'refund', '', '[]', '[]', 1, 'active', now, now)

  return {
    db,
    now,
    repositories,
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

describe('test suite routing schema', () => {
  it('persists routing suites and case intents while preserving legacy single-prompt defaults', async () => {
    const testContext = await setupRoutingRepositoryTest()

    try {
      const suite = testContext.repositories.createTestSuite({
        projectId: 'project-1',
        name: 'Refund Router',
        description: 'Routes by intent before answering',
      })

      const updated = testContext.repositories.updateTestSuite(suite.id, {
        promptId: 'prompt-a',
        workflowMode: 'routing',
        routingConfig: {
          entryPromptId: 'prompt-a',
          routes: [
            {
              intent: 'refund',
              promptId: 'prompt-b',
            },
          ],
        },
      })

      expect(updated).toMatchObject({
        id: suite.id,
        promptId: 'prompt-a',
        workflowMode: 'routing',
        routingConfig: {
          entryPromptId: 'prompt-a',
          routes: [{ intent: 'refund', promptId: 'prompt-b' }],
        },
      })

      const createdCase = testContext.repositories.createTestCase({
        testSuiteId: suite.id,
        title: 'Refund case',
        input: '我要退款',
        expectedIntent: 'refund',
        expectedOutput: '请提供订单号，我们为您处理退款。',
      })

      expect(createdCase.expectedIntent).toBe('refund')

      const batchCases = testContext.repositories.createTestCasesBatch(suite.id, [
        {
          title: 'Exchange case',
          input: '我要换货',
          expectedIntent: 'exchange',
          expectedOutput: '请提供订单号，我们为您处理换货。',
        },
      ])

      expect(batchCases[0]?.expectedIntent).toBe('exchange')

      const cases = testContext.repositories.findTestCasesBySuite(suite.id)
      expect(cases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Refund case',
            expectedIntent: 'refund',
          }),
          expect.objectContaining({
            title: 'Exchange case',
            expectedIntent: 'exchange',
          }),
        ])
      )

      testContext.db.prepare(`
        INSERT INTO test_suites (
          id,
          project_id,
          session_id,
          name,
          description,
          prompt_id,
          prompt_version_id,
          config,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'legacy-suite',
        'project-1',
        null,
        'Legacy Suite',
        '',
        'prompt-a',
        null,
        JSON.stringify({ provider: '', model: '', apiKey: '', baseUrl: '' }),
        'draft',
        testContext.now,
        testContext.now
      )

      expect(testContext.repositories.findTestSuiteById('legacy-suite')).toMatchObject({
        id: 'legacy-suite',
        promptId: 'prompt-a',
        workflowMode: 'single',
        routingConfig: null,
      })
    } finally {
      testContext.cleanup()
    }
  })
})
