import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import * as XLSX from 'xlsx'

async function setupRunRouteTest(options?: { withSettings?: boolean; withResult?: boolean }) {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-audit-run-route-'))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import('@/lib/db')
  const db = getDb()
  const { updateSettings } = await import('@/lib/db/repositories/settings')
  const { createConversationAuditJob, findConversationAuditJobById } = await import(
    '@/lib/db/repositories/conversation-audit-jobs'
  )
  const { replaceKnowledgeChunks } = await import(
    '@/lib/db/repositories/conversation-audit-knowledge-chunks'
  )
  const { replaceAuditConversations, findAuditConversationsByJob } = await import(
    '@/lib/db/repositories/conversation-audit-conversations'
  )
  const {
    replaceAuditTurns,
    findAuditTurnsByJob,
    updateAuditTurnResult,
  } = await import('@/lib/db/repositories/conversation-audit-turns')

  const now = '2026-03-18T00:00:00.000Z'
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

  if (options?.withSettings) {
    updateSettings({
      provider: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-test',
      baseUrl: 'https://example.com/v1',
    })
  }

  const job = createConversationAuditJob({
    projectId: 'project-1',
    name: 'Audit Job',
    parseSummary: {
      knowledgeFileCount: 1,
      conversationCount: 1,
      turnCount: 1,
      invalidRowCount: 0,
    },
  })

  replaceKnowledgeChunks(job.id, [
    {
      sourceName: 'faq.txt',
      sourceType: 'txt',
      chunkIndex: 0,
      content: 'Reset password | Use the reset link.',
      metadata: { sheetName: null },
    },
  ])

  replaceAuditConversations(job.id, [
    {
      externalConversationId: 'conv-1',
      turnCount: 1,
    },
  ])

  const conversationId = findAuditConversationsByJob(job.id)[0]!.id

  replaceAuditTurns(job.id, [
    {
      conversationId,
      turnIndex: 0,
      userMessage: 'How do I reset my password?',
      botReply: 'Wrong answer',
      hasIssue: null,
      knowledgeAnswer: null,
      retrievedSources: [],
    },
  ])

  if (options?.withResult) {
    const turn = findAuditTurnsByJob(job.id)[0]!
    updateAuditTurnResult(turn.id, {
      hasIssue: true,
      knowledgeAnswer: 'Use the reset link.',
      retrievedSources: [{ chunkId: 'faq.txt:0', sourceName: 'faq.txt', score: 10 }],
    })
  }

  return {
    jobId: job.id,
    findConversationAuditJobById,
    cleanup() {
      vi.doUnmock('@/lib/ai/provider')
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

function parseSseEvents(text: string) {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)))
}

describe('conversation audit run routes', () => {
  it('streams progress events until completion', async () => {
    const testContext = await setupRunRouteTest({ withSettings: true })

    try {
      vi.doMock('@/lib/ai/provider', () => ({
        createAiProvider: () => ({
          async chat() {
            return '```json\n{"hasIssue":true,"knowledgeAnswer":"Use the reset link."}\n```'
          },
          async *chatStream() {},
        }),
      }))

      const { POST } = await import('@/app/api/conversation-audit-jobs/[id]/run/route')
      const response = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: testContext.jobId }),
      })

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')

      const events = parseSseEvents(await response.text())
      expect(events.map((event) => event.type)).toEqual([
        'audit-start',
        'audit-turn-start',
        'audit-turn-done',
        'audit-complete',
      ])
      expect(testContext.findConversationAuditJobById(testContext.jobId)).toMatchObject({
        status: 'completed',
        issueCount: 1,
      })
    } finally {
      testContext.cleanup()
    }
  })

  it('marks the job failed when global settings are incomplete', async () => {
    const testContext = await setupRunRouteTest({ withSettings: false })

    try {
      const { POST } = await import('@/app/api/conversation-audit-jobs/[id]/run/route')
      const response = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: testContext.jobId }),
      })

      const events = parseSseEvents(await response.text())
      expect(events.at(-1)).toMatchObject({
        type: 'audit-error',
      })
      expect(testContext.findConversationAuditJobById(testContext.jobId)).toMatchObject({
        status: 'failed',
      })
    } finally {
      testContext.cleanup()
    }
  })

  it('rejects duplicate runs when the job is already running', async () => {
    const testContext = await setupRunRouteTest({ withSettings: true })

    try {
      const { updateConversationAuditJob } = await import('@/lib/db/repositories/conversation-audit-jobs')
      updateConversationAuditJob(testContext.jobId, { status: 'running' })

      const { POST } = await import('@/app/api/conversation-audit-jobs/[id]/run/route')
      const response = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: testContext.jobId }),
      })

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: 'Conversation audit job is already running',
      })
    } finally {
      testContext.cleanup()
    }
  })

  it('exports audit results as an excel file with headers', async () => {
    const testContext = await setupRunRouteTest({ withSettings: true, withResult: true })

    try {
      const { GET } = await import('@/app/api/conversation-audit-jobs/[id]/export/route')
      const response = await GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: testContext.jobId }),
      })

      expect(response.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )

      const buffer = Buffer.from(await response.arrayBuffer())
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[workbook.SheetNames[0]], {
        header: 1,
        raw: false,
      })

      expect(rows[0]).toEqual([
        'Conversation ID',
        'Turn Index',
        'User Message',
        'Bot Reply',
        'Has Issue',
        'Knowledge Answer',
      ])
      expect(rows[1]?.[2]).toBe('How do I reset my password?')
      expect(rows[1]?.[4]).toBe('YES')
    } finally {
      testContext.cleanup()
    }
  })
})
