import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import * as XLSX from 'xlsx'

function buildHistoryWorkbookBuffer(): Buffer {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Conversation ID', 'Message Sender', 'Message'],
    ['conv-1', 'user', 'How do I reset my password?'],
    ['conv-1', 'bot', 'Use the reset link.'],
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, 'History')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

async function setupJobParserTest() {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-audit-job-parser-'))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import('@/lib/db')
  const db = getDb()
  const { createConversationAuditJob, findConversationAuditJobById } = await import(
    '@/lib/db/repositories/conversation-audit-jobs'
  )
  const { findKnowledgeChunksByJob } = await import('@/lib/db/repositories/conversation-audit-knowledge-chunks')
  const { findAuditTurnsByJob } = await import('@/lib/db/repositories/conversation-audit-turns')

  const now = '2026-03-19T00:00:00.000Z'
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

  const job = createConversationAuditJob({
    projectId: 'project-1',
    name: 'Audit Job',
    status: 'parsing',
    parseSummary: {
      knowledgeFileCount: 0,
      conversationCount: 0,
      turnCount: 0,
      invalidRowCount: 0,
    },
  })

  return {
    db,
    jobId: job.id,
    findConversationAuditJobById,
    findKnowledgeChunksByJob,
    findAuditTurnsByJob,
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

describe('parseConversationAuditJob', () => {
  it('logs parsing summary for persisted uploads', async () => {
    const testContext = await setupJobParserTest()
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { persistConversationAuditUploads } = await import('@/lib/audit/job-upload-storage')
      const { parseConversationAuditJob } = await import('@/lib/audit/job-parser')

      await persistConversationAuditUploads(testContext.jobId, {
        historyFile: new File([buildHistoryWorkbookBuffer()], 'history.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        knowledgeFiles: [new File(['Reset password from the login page.'], 'faq.txt')],
      })

      await parseConversationAuditJob(testContext.jobId)

      expect(testContext.findConversationAuditJobById(testContext.jobId)).toMatchObject({
        status: 'draft',
      })
      expect(testContext.findKnowledgeChunksByJob(testContext.jobId)).toHaveLength(1)
      expect(testContext.findAuditTurnsByJob(testContext.jobId)).toHaveLength(1)
      expect(consoleLog).toHaveBeenCalledWith(
        '[ConversationAudit] Parsed history workbook',
        expect.objectContaining({
          jobId: testContext.jobId,
          conversationCount: 1,
          turnCount: 1,
        })
      )
      expect(consoleLog).toHaveBeenCalledWith(
        '[ConversationAudit] Job parsing completed',
        expect.objectContaining({
          jobId: testContext.jobId,
          knowledgeFileCount: 1,
          knowledgeChunkCount: 1,
          conversationCount: 1,
          turnCount: 1,
        })
      )
    } finally {
      testContext.cleanup()
    }
  })

  it('logs parsing failures with job context', async () => {
    const testContext = await setupJobParserTest()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const { persistConversationAuditUploads } = await import('@/lib/audit/job-upload-storage')
      const { parseConversationAuditJob } = await import('@/lib/audit/job-parser')

      await persistConversationAuditUploads(testContext.jobId, {
        historyFile: new File([Buffer.from('not-a-workbook')], 'history.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        knowledgeFiles: [],
      })

      await parseConversationAuditJob(testContext.jobId)

      expect(testContext.findConversationAuditJobById(testContext.jobId)).toMatchObject({
        status: 'failed',
      })
      expect(consoleError).toHaveBeenCalledWith(
        '[ConversationAudit] Job parsing failed',
        expect.objectContaining({
          jobId: testContext.jobId,
          error: expect.any(String),
        })
      )
    } finally {
      testContext.cleanup()
    }
  })
})
