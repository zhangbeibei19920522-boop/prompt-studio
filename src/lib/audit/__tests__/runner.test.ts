import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { AiProvider, ChatMessage } from '@/types/ai'

async function setupRunnerTest() {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-audit-runner-'))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import('@/lib/db')
  const db = getDb()

  const { createConversationAuditJob, findConversationAuditJobById } = await import(
    '@/lib/db/repositories/conversation-audit-jobs'
  )
  const { replaceKnowledgeChunks } = await import(
    '@/lib/db/repositories/conversation-audit-knowledge-chunks'
  )
  const { replaceAuditConversations } = await import(
    '@/lib/db/repositories/conversation-audit-conversations'
  )
  const { replaceAuditTurns, findAuditTurnsByJob } = await import(
    '@/lib/db/repositories/conversation-audit-turns'
  )
  const { updateSettings } = await import('@/lib/db/repositories/settings')

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

  updateSettings({
    provider: 'openai',
    model: 'gpt-test',
    apiKey: 'sk-test',
    baseUrl: 'https://example.com/v1',
  })

  const job = createConversationAuditJob({
    projectId: 'project-1',
    name: 'Audit Job',
    parseSummary: {
      knowledgeFileCount: 1,
      conversationCount: 1,
      turnCount: 2,
      invalidRowCount: 0,
    },
  })

  replaceKnowledgeChunks(job.id, [
    {
      sourceName: 'faq.docx',
      sourceType: 'docx',
      chunkIndex: 0,
      content: 'Reset password | Use the reset link.',
      metadata: { sheetName: null },
    },
  ])

  replaceAuditConversations(job.id, [
    {
      externalConversationId: 'conv-1',
      turnCount: 2,
    },
  ])

  const conversationId = (await import('@/lib/db/repositories/conversation-audit-conversations'))
    .findAuditConversationsByJob(job.id)[0]!.id

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
    {
      conversationId,
      turnIndex: 1,
      userMessage: 'How do I change my phone number?',
      botReply: 'Open your profile settings.',
      hasIssue: null,
      knowledgeAnswer: null,
      retrievedSources: [],
    },
  ])

  return {
    jobId: job.id,
    findConversationAuditJobById,
    findAuditTurnsByJob,
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

describe('runConversationAudit', () => {
  it('updates job state, persists turn results, and uses global settings to create the provider', async () => {
    const testContext = await setupRunnerTest()

    try {
      const providerConfigs: Array<{ provider: string; model: string; apiKey: string; baseUrl: string }> = []
      const fakeProvider: AiProvider = {
        async chat(_messages: ChatMessage[]) {
          return 'unused'
        },
        async *chatStream() {},
      }

      const { runConversationAudit } = await import('@/lib/audit/runner')

      const events = []
      for await (const event of runConversationAudit(testContext.jobId, {
        createProvider(config) {
          providerConfigs.push(config)
          return fakeProvider
        },
        retrieveKnowledge(chunks, userMessage) {
          return userMessage.includes('reset')
            ? [{ chunk: chunks[0]!, score: 10 }]
            : [{ chunk: chunks[0]!, score: 1 }]
        },
        evaluateTurn(_provider, input) {
          if (input.userMessage.includes('reset')) {
            return Promise.resolve({
              hasIssue: true,
              knowledgeAnswer: 'Use the reset link.',
            })
          }

          return Promise.resolve({
            hasIssue: false,
            knowledgeAnswer: 'Open your profile settings.',
          })
        },
      })) {
        events.push(event)
      }

      const job = testContext.findConversationAuditJobById(testContext.jobId)
      const turns = testContext.findAuditTurnsByJob(testContext.jobId)

      expect(providerConfigs).toEqual([
        {
          provider: 'openai',
          model: 'gpt-test',
          apiKey: 'sk-test',
          baseUrl: 'https://example.com/v1',
        },
      ])
      expect(job).toMatchObject({
        id: testContext.jobId,
        status: 'completed',
        issueCount: 1,
        totalTurns: 2,
      })
      expect(turns).toHaveLength(2)
      expect(turns[0]).toMatchObject({
        hasIssue: true,
        knowledgeAnswer: 'Use the reset link.',
      })
      expect(turns[1]).toMatchObject({
        hasIssue: false,
        knowledgeAnswer: 'Open your profile settings.',
      })
      expect(events.map((event) => event.type)).toEqual([
        'audit-start',
        'audit-turn-start',
        'audit-turn-done',
        'audit-turn-start',
        'audit-turn-done',
        'audit-complete',
      ])
    } finally {
      testContext.cleanup()
    }
  })
})
