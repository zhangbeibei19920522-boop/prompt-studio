import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import * as XLSX from 'xlsx'

async function setupRouteTest() {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-audit-routes-'))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import('@/lib/db')
  const db = getDb()
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
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

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

async function waitForJobParsingToFinish(
  getDetail: typeof import('@/app/api/conversation-audit-jobs/[id]/route').GET,
  jobId: string
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await getDetail(new Request('http://localhost'), {
      params: Promise.resolve({ id: jobId }),
    })
    const payload = await response.json()

    if (payload.data.job.status !== 'parsing') {
      return payload
    }

    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error(`Timed out waiting for conversation audit job ${jobId} to finish parsing`)
}

describe('conversation audit job routes', () => {
  it('requires a history file when creating a job', async () => {
    const testContext = await setupRouteTest()

    try {
      const { POST } = await import('@/app/api/projects/[id]/conversation-audit-jobs/route')
      const formData = new FormData()
      formData.set('name', 'Audit Job')

      const response = await POST(new Request('http://localhost', { method: 'POST', body: formData }), {
        params: Promise.resolve({ id: 'project-1' }),
      })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({
        success: false,
        error: 'Field "historyFile" is required',
      })
    } finally {
      testContext.cleanup()
    }
  })

  it('creates a job in parsing state before background parsing finishes', async () => {
    const testContext = await setupRouteTest()
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { POST } = await import('@/app/api/projects/[id]/conversation-audit-jobs/route')
      const formData = new FormData()
      formData.set('name', 'Audit Job')
      formData.set(
        'historyFile',
        new File([buildHistoryWorkbookBuffer()], 'history.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      )
      formData.append('knowledgeFiles', new File(['Reset password from the login page.'], 'faq.txt'))

      const response = await POST(new Request('http://localhost', { method: 'POST', body: formData }), {
        params: Promise.resolve({ id: 'project-1' }),
      })

      const payload = await response.json()

      expect(response.status).toBe(201)
      expect(payload.success).toBe(true)
      expect(payload.data.job).toMatchObject({
        name: 'Audit Job',
        projectId: 'project-1',
        status: 'parsing',
      })
      expect(payload.data.parseSummary).toMatchObject({
        knowledgeFileCount: 0,
        conversationCount: 0,
        turnCount: 0,
      })
      expect(payload.data.conversations).toHaveLength(0)
      expect(payload.data.turns).toHaveLength(0)
      expect(consoleLog).toHaveBeenCalledWith(
        '[ConversationAudit] Creating job request',
        expect.objectContaining({
          projectId: 'project-1',
          name: 'Audit Job',
          historyFileName: 'history.xlsx',
          knowledgeFileCount: 1,
        })
      )
    } finally {
      testContext.cleanup()
    }
  })

  it('returns job detail with conversations and turns', async () => {
    const testContext = await setupRouteTest()

    try {
      const projectRoute = await import('@/app/api/projects/[id]/conversation-audit-jobs/route')
      const detailRoute = await import('@/app/api/conversation-audit-jobs/[id]/route')
      const formData = new FormData()
      formData.set('name', 'Audit Job')
      formData.set(
        'historyFile',
        new File([buildHistoryWorkbookBuffer()], 'history.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      )

      const createResponse = await projectRoute.POST(
        new Request('http://localhost', { method: 'POST', body: formData }),
        { params: Promise.resolve({ id: 'project-1' }) }
      )
      const created = await createResponse.json()

      const payload = await waitForJobParsingToFinish(detailRoute.GET, created.data.job.id)

      expect(payload.success).toBe(true)
      expect(payload.data.job.id).toBe(created.data.job.id)
      expect(payload.data.job.status).toBe('draft')
      expect(payload.data.conversations).toHaveLength(1)
      expect(payload.data.turns).toHaveLength(1)
      expect(payload.data.parseSummary.turnCount).toBe(1)
    } finally {
      testContext.cleanup()
    }
  })

  it('lists project jobs from newest to oldest', async () => {
    const testContext = await setupRouteTest()

    try {
      const routeModule = await import('@/app/api/projects/[id]/conversation-audit-jobs/route')
      const formDataA = new FormData()
      formDataA.set('name', 'Audit Job A')
      formDataA.set(
        'historyFile',
        new File([buildHistoryWorkbookBuffer()], 'history-a.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      )

      const formDataB = new FormData()
      formDataB.set('name', 'Audit Job B')
      formDataB.set(
        'historyFile',
        new File([buildHistoryWorkbookBuffer()], 'history-b.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      )

      await routeModule.POST(new Request('http://localhost', { method: 'POST', body: formDataA }), {
        params: Promise.resolve({ id: 'project-1' }),
      })
      await routeModule.POST(new Request('http://localhost', { method: 'POST', body: formDataB }), {
        params: Promise.resolve({ id: 'project-1' }),
      })

      const response = await routeModule.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: 'project-1' }),
      })
      const payload = await response.json()

      expect(payload.success).toBe(true)
      expect(payload.data).toHaveLength(2)
      expect(payload.data[0].name).toBe('Audit Job B')
      expect(payload.data[1].name).toBe('Audit Job A')
    } finally {
      testContext.cleanup()
    }
  })

  it('deletes a job and cascades related audit data', async () => {
    const testContext = await setupRouteTest()

    try {
      const projectRoute = await import('@/app/api/projects/[id]/conversation-audit-jobs/route')
      const detailRoute = await import('@/app/api/conversation-audit-jobs/[id]/route')
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      const formData = new FormData()
      formData.set('name', 'Audit Job')
      formData.set(
        'historyFile',
        new File([buildHistoryWorkbookBuffer()], 'history.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      )

      const createResponse = await projectRoute.POST(
        new Request('http://localhost', { method: 'POST', body: formData }),
        { params: Promise.resolve({ id: 'project-1' }) }
      )
      const created = await createResponse.json()
      const jobId = created.data.job.id as string
      await waitForJobParsingToFinish(detailRoute.GET, jobId)

      const deleteResponse = await detailRoute.DELETE(new Request('http://localhost', { method: 'DELETE' }), {
        params: Promise.resolve({ id: jobId }),
      })

      expect(deleteResponse.status).toBe(200)
      expect(await deleteResponse.json()).toMatchObject({
        success: true,
        data: null,
      })

      const jobCount = db.prepare('SELECT COUNT(*) AS count FROM conversation_audit_jobs WHERE id = ?').get(jobId) as { count: number }
      const conversationCount = db.prepare('SELECT COUNT(*) AS count FROM conversation_audit_conversations WHERE job_id = ?').get(jobId) as { count: number }
      const turnCount = db.prepare('SELECT COUNT(*) AS count FROM conversation_audit_turns WHERE job_id = ?').get(jobId) as { count: number }
      const chunkCount = db.prepare('SELECT COUNT(*) AS count FROM conversation_audit_knowledge_chunks WHERE job_id = ?').get(jobId) as { count: number }

      expect(jobCount.count).toBe(0)
      expect(conversationCount.count).toBe(0)
      expect(turnCount.count).toBe(0)
      expect(chunkCount.count).toBe(0)
    } finally {
      testContext.cleanup()
    }
  })
})
