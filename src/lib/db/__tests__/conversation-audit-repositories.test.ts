import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

interface AuditRepositories {
  createConversationAuditJob: typeof import('@/lib/db/repositories/conversation-audit-jobs').createConversationAuditJob
  findConversationAuditJobById: typeof import('@/lib/db/repositories/conversation-audit-jobs').findConversationAuditJobById
  findConversationAuditJobsByProject: typeof import('@/lib/db/repositories/conversation-audit-jobs').findConversationAuditJobsByProject
  updateConversationAuditJob: typeof import('@/lib/db/repositories/conversation-audit-jobs').updateConversationAuditJob
  replaceKnowledgeChunks: typeof import('@/lib/db/repositories/conversation-audit-knowledge-chunks').replaceKnowledgeChunks
  findKnowledgeChunksByJob: typeof import('@/lib/db/repositories/conversation-audit-knowledge-chunks').findKnowledgeChunksByJob
  replaceAuditConversations: typeof import('@/lib/db/repositories/conversation-audit-conversations').replaceAuditConversations
  findAuditConversationsByJob: typeof import('@/lib/db/repositories/conversation-audit-conversations').findAuditConversationsByJob
  replaceAuditTurns: typeof import('@/lib/db/repositories/conversation-audit-turns').replaceAuditTurns
  findAuditTurnsByJob: typeof import('@/lib/db/repositories/conversation-audit-turns').findAuditTurnsByJob
  updateAuditTurnResult: typeof import('@/lib/db/repositories/conversation-audit-turns').updateAuditTurnResult
}

async function setupAuditRepositoryTest() {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-audit-repositories-'))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import('@/lib/db')
  const db = getDb()

  const repositories = {
    ...(await import('@/lib/db/repositories/conversation-audit-jobs')),
    ...(await import('@/lib/db/repositories/conversation-audit-knowledge-chunks')),
    ...(await import('@/lib/db/repositories/conversation-audit-conversations')),
    ...(await import('@/lib/db/repositories/conversation-audit-turns')),
  } as AuditRepositories

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

  return {
    db,
    repositories,
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

describe('conversation audit repositories', () => {
  it('creates, fetches, and updates audit jobs by project', async () => {
    const testContext = await setupAuditRepositoryTest()

    try {
      const job = testContext.repositories.createConversationAuditJob({
        projectId: 'project-1',
        name: 'Audit Run A',
        status: 'draft',
        parseSummary: {
          knowledgeFileCount: 2,
          conversationCount: 3,
          turnCount: 4,
          invalidRowCount: 1,
        },
      })

      const fetched = testContext.repositories.findConversationAuditJobById(job.id)
      expect(fetched).toMatchObject({
        id: job.id,
        projectId: 'project-1',
        name: 'Audit Run A',
        status: 'draft',
        issueCount: 0,
        totalTurns: 0,
      })

      const jobs = testContext.repositories.findConversationAuditJobsByProject('project-1')
      expect(jobs).toHaveLength(1)
      expect(jobs[0]?.id).toBe(job.id)

      const updated = testContext.repositories.updateConversationAuditJob(job.id, {
        status: 'running',
        issueCount: 2,
        totalTurns: 7,
      })

      expect(updated).toMatchObject({
        id: job.id,
        status: 'running',
        issueCount: 2,
        totalTurns: 7,
      })
    } finally {
      testContext.cleanup()
    }
  })

  it('replaces knowledge chunks, conversations, and turns for a job', async () => {
    const testContext = await setupAuditRepositoryTest()

    try {
      const job = testContext.repositories.createConversationAuditJob({
        projectId: 'project-1',
        name: 'Audit Run B',
        status: 'draft',
        parseSummary: {
          knowledgeFileCount: 0,
          conversationCount: 0,
          turnCount: 0,
          invalidRowCount: 0,
        },
      })

      testContext.repositories.replaceKnowledgeChunks(job.id, [
        {
          sourceName: 'FAQ.docx',
          sourceType: 'docx',
          chunkIndex: 0,
          content: 'Knowledge chunk A',
          metadata: { section: 'faq' },
        },
        {
          sourceName: 'policy.html',
          sourceType: 'html',
          chunkIndex: 1,
          content: 'Knowledge chunk B',
          metadata: { section: 'policy' },
        },
      ])

      const chunks = testContext.repositories.findKnowledgeChunksByJob(job.id)
      expect(chunks).toHaveLength(2)
      expect(chunks[0]?.metadata).toEqual({ section: 'faq' })

      testContext.repositories.replaceAuditConversations(job.id, [
        {
          externalConversationId: 'conv-1',
          turnCount: 2,
        },
      ])

      const conversations = testContext.repositories.findAuditConversationsByJob(job.id)
      expect(conversations).toHaveLength(1)
      expect(conversations[0]?.externalConversationId).toBe('conv-1')

      testContext.repositories.replaceAuditTurns(job.id, [
        {
          conversationId: conversations[0]!.id,
          turnIndex: 0,
          userMessage: 'How do I reset my password?',
          botReply: 'Use the reset link.',
          hasIssue: null,
          knowledgeAnswer: null,
          retrievedSources: [],
        },
      ])

      const turns = testContext.repositories.findAuditTurnsByJob(job.id)
      expect(turns).toHaveLength(1)
      expect(turns[0]).toMatchObject({
        userMessage: 'How do I reset my password?',
        botReply: 'Use the reset link.',
        hasIssue: null,
      })
    } finally {
      testContext.cleanup()
    }
  })

  it('filters turns by hasIssue and updates turn results', async () => {
    const testContext = await setupAuditRepositoryTest()

    try {
      const job = testContext.repositories.createConversationAuditJob({
        projectId: 'project-1',
        name: 'Audit Run C',
        status: 'draft',
        parseSummary: {
          knowledgeFileCount: 0,
          conversationCount: 1,
          turnCount: 2,
          invalidRowCount: 0,
        },
      })

      testContext.repositories.replaceAuditConversations(job.id, [
        {
          externalConversationId: 'conv-2',
          turnCount: 2,
        },
      ])

      const conversation = testContext.repositories.findAuditConversationsByJob(job.id)[0]!

      testContext.repositories.replaceAuditTurns(job.id, [
        {
          conversationId: conversation.id,
          turnIndex: 0,
          userMessage: 'Question 1',
          botReply: 'Answer 1',
          hasIssue: null,
          knowledgeAnswer: null,
          retrievedSources: [],
        },
        {
          conversationId: conversation.id,
          turnIndex: 1,
          userMessage: 'Question 2',
          botReply: 'Answer 2',
          hasIssue: true,
          knowledgeAnswer: 'Correct answer 2',
          retrievedSources: [{ chunkId: 'chunk-1', sourceName: 'FAQ.docx', score: 0.9 }],
        },
      ])

      const allTurns = testContext.repositories.findAuditTurnsByJob(job.id)
      const pendingTurn = allTurns.find((turn) => turn.turnIndex === 0)
      expect(pendingTurn).toBeDefined()

      const updatedTurn = testContext.repositories.updateAuditTurnResult(pendingTurn!.id, {
        hasIssue: false,
        knowledgeAnswer: 'Correct answer 1',
        retrievedSources: [{ chunkId: 'chunk-2', sourceName: 'policy.html', score: 0.8 }],
      })

      expect(updatedTurn).toMatchObject({
        id: pendingTurn!.id,
        hasIssue: false,
        knowledgeAnswer: 'Correct answer 1',
      })

      const issueTurns = testContext.repositories.findAuditTurnsByJob(job.id, {
        hasIssue: true,
      })
      expect(issueTurns).toHaveLength(1)
      expect(issueTurns[0]?.knowledgeAnswer).toBe('Correct answer 2')
    } finally {
      testContext.cleanup()
    }
  })
})
