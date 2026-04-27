import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

async function waitForTaskCompletion(taskRouteModule: typeof import('@/app/api/knowledge-build-tasks/[id]/route'), taskId: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const taskDetailResponse = await taskRouteModule.GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: taskId }),
    })
    const taskDetailPayload = await taskDetailResponse.json()
    const task = taskDetailPayload.data
    if (task && task.status !== 'running' && task.currentStep !== 'queued' && task.currentStep !== 'building_artifacts') {
      return task
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  throw new Error(`Timed out waiting for knowledge build task ${taskId}`)
}

async function setupKnowledgeRouteTest() {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-routes-'))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import('@/lib/db')
  const db = getDb()
  const now = '2026-04-21T00:00:00.000Z'

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
    INSERT INTO documents (
      id,
      project_id,
      name,
      type,
      content,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'doc-1',
    'project-1',
    'Router Password Reset.txt',
    'txt',
    'Reset the router by holding the Reset button for 10 seconds, then log in again.',
    now,
  )

  db.prepare(`
    INSERT INTO documents (
      id,
      project_id,
      name,
      type,
      content,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'doc-2',
    'project-1',
    'Refund Policy 2026.txt',
    'txt',
    'Refunds are available within 7 days of purchase. This policy is valid through 2026-12-31.',
    now,
  )

  return {
    db,
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

describe('knowledge routes', () => {
  it('hydrates legacy manifests without stage artifacts so task detail pages can still render', async () => {
    const testContext = await setupKnowledgeRouteTest()

    try {
      const projectBaseRoute = await import('@/app/api/projects/[id]/knowledge-base/route')
      const projectTaskRoute = await import('@/app/api/projects/[id]/knowledge-build-tasks/route')
      const taskRoute = await import('@/app/api/knowledge-build-tasks/[id]/route')
      const versionRoute = await import('@/app/api/knowledge-versions/[id]/route')

      await projectBaseRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({ name: 'Customer Support KB' }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )

      const createTaskResponse = await projectTaskRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Legacy Batch Update',
            taskType: 'batch',
            documentIds: ['doc-1', 'doc-2'],
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const createTaskPayload = await createTaskResponse.json()
      expect(createTaskResponse.status).toBe(202)
      expect(createTaskPayload.data.task.status).toBe('running')
      const completedTask = await waitForTaskCompletion(taskRoute, createTaskPayload.data.task.id as string)
      const versionId = completedTask.knowledgeVersionId as string
      expect(versionId).toBeTruthy()
      const versionPathResponse = await versionRoute.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: versionId }),
      })
      const versionPathPayload = await versionPathResponse.json()
      const manifestPath = versionPathPayload.data.manifestFilePath as string

      const legacyManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
      delete legacyManifest.stageArtifacts
      fs.writeFileSync(manifestPath, JSON.stringify(legacyManifest, null, 2))

      const versionDetailResponse = await versionRoute.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: versionId }),
      })
      const versionDetailPayload = await versionDetailResponse.json()

      expect(versionDetailResponse.status).toBe(200)
      expect(versionDetailPayload.data.manifest.stageArtifacts).toMatchObject({
        sourceManifest: [],
        rawRecords: [],
        cleanedRecords: [],
        routedRecords: [],
        structuredRecords: [],
        promotedRecords: [],
        mergedRecords: [],
        conflictRecords: [],
        gatedRecords: [],
        parents: [],
        chunks: [],
      })
    } finally {
      testContext.cleanup()
    }
  })

  it('creates a knowledge base, builds a draft version, and lists versions for the project', async () => {
    const testContext = await setupKnowledgeRouteTest()

    try {
      const projectBaseRoute = await import('@/app/api/projects/[id]/knowledge-base/route')
      const projectTaskRoute = await import('@/app/api/projects/[id]/knowledge-build-tasks/route')
      const projectVersionsRoute = await import('@/app/api/projects/[id]/knowledge-versions/route')
      const versionRoute = await import('@/app/api/knowledge-versions/[id]/route')
      const taskRoute = await import('@/app/api/knowledge-build-tasks/[id]/route')

      const createBaseResponse = await projectBaseRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Customer Support KB',
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const createBasePayload = await createBaseResponse.json()

      expect(createBaseResponse.status).toBe(201)
      expect(createBasePayload.data).toMatchObject({
        projectId: 'project-1',
        name: 'Customer Support KB',
        profileKey: 'generic_customer_service',
      })

      const createTaskResponse = await projectTaskRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Batch Update 1',
            taskType: 'batch',
            documentIds: ['doc-1', 'doc-2'],
            manualDrafts: [
              {
                title: 'How to contact customer support',
                content: 'Email support@example.com for help.',
                source: 'manual',
              },
            ],
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const createTaskPayload = await createTaskResponse.json()

      expect(createTaskResponse.status).toBe(202)
      expect(createTaskPayload.data.task).toMatchObject({
        name: 'Batch Update 1',
        status: 'running',
        currentStep: 'queued',
        taskType: 'batch',
      })
      expect(createTaskPayload.data.version).toBeNull()

      const completedTask = await waitForTaskCompletion(taskRoute, createTaskPayload.data.task.id as string)
      expect(completedTask).toMatchObject({
        id: createTaskPayload.data.task.id,
        knowledgeVersionId: expect.any(String),
      })

      const versionsResponse = await projectVersionsRoute.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: 'project-1' }),
      })
      const versionsPayload = await versionsResponse.json()

      expect(versionsPayload.data).toHaveLength(1)
      expect(versionsPayload.data[0]).toMatchObject({
        id: completedTask.knowledgeVersionId,
        status: 'draft',
      })

      const versionDetailResponse = await versionRoute.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: completedTask.knowledgeVersionId }),
      })
      const versionDetailPayload = await versionDetailResponse.json()

      expect(versionDetailPayload.data).toMatchObject({
        id: completedTask.knowledgeVersionId,
        parents: expect.arrayContaining([
          expect.objectContaining({
            question: expect.any(String),
          }),
        ]),
        chunks: expect.arrayContaining([
          expect.objectContaining({
            chunkText: expect.any(String),
          }),
        ]),
      })

      const taskDetailResponse = await taskRoute.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: createTaskPayload.data.task.id }),
      })
      const taskDetailPayload = await taskDetailResponse.json()

      expect(taskDetailPayload.data).toMatchObject({
        id: createTaskPayload.data.task.id,
        knowledgeVersionId: completedTask.knowledgeVersionId,
      })
    } finally {
      testContext.cleanup()
    }
  })

  it('pushes a version to stg, promotes it to prod, and rolls back to a historical version', async () => {
    const testContext = await setupKnowledgeRouteTest()

    try {
      const projectBaseRoute = await import('@/app/api/projects/[id]/knowledge-base/route')
      const projectTaskRoute = await import('@/app/api/projects/[id]/knowledge-build-tasks/route')
      const taskRoute = await import('@/app/api/knowledge-build-tasks/[id]/route')
      const pushStgRoute = await import('@/app/api/knowledge-versions/[id]/push-stg/route')
      const pushProdRoute = await import('@/app/api/knowledge-versions/[id]/push-prod/route')
      const rollbackRoute = await import('@/app/api/knowledge-versions/[id]/rollback/route')
      const projectVersionsRoute = await import('@/app/api/projects/[id]/knowledge-versions/route')

      const baseResponse = await projectBaseRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({ name: 'Customer Support KB' }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const basePayload = await baseResponse.json()
      const knowledgeBaseId = basePayload.data.id as string

      const firstTaskResponse = await projectTaskRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Batch Update 1',
            taskType: 'batch',
            documentIds: ['doc-1'],
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const firstPayload = await firstTaskResponse.json()
      const firstCompletedTask = await waitForTaskCompletion(taskRoute, firstPayload.data.task.id as string)
      const firstVersionId = firstCompletedTask.knowledgeVersionId as string

      const stgResponse = await pushStgRoute.POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: firstVersionId }),
      })
      const stgPayload = await stgResponse.json()
      expect(stgPayload.data.version).toMatchObject({
        id: firstVersionId,
        status: 'stg',
      })
      expect(stgPayload.data.indexVersion).toMatchObject({
        knowledgeVersionId: firstVersionId,
        status: 'stg',
      })

      const prodResponse = await pushProdRoute.POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: firstVersionId }),
      })
      const prodPayload = await prodResponse.json()
      expect(prodPayload.data.version).toMatchObject({
        id: firstVersionId,
        status: 'prod',
      })

      const secondTaskResponse = await projectTaskRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Batch Update 2',
            taskType: 'manual',
            manualDrafts: [
              {
                title: 'How to contact customer support',
                content: 'Email support@example.com for help.',
                source: 'manual',
              },
            ],
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const secondPayload = await secondTaskResponse.json()
      const secondCompletedTask = await waitForTaskCompletion(taskRoute, secondPayload.data.task.id as string)
      const secondVersionId = secondCompletedTask.knowledgeVersionId as string

      await pushStgRoute.POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: secondVersionId }),
      })
      await pushProdRoute.POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: secondVersionId }),
      })

      const rollbackResponse = await rollbackRoute.POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: firstVersionId }),
      })
      const rollbackPayload = await rollbackResponse.json()
      expect(rollbackPayload.data.version).toMatchObject({
        id: firstVersionId,
        status: 'prod',
      })
      expect(rollbackPayload.data.knowledgeBase).toMatchObject({
        id: knowledgeBaseId,
        currentProdVersionId: firstVersionId,
      })

      const versionsResponse = await projectVersionsRoute.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: 'project-1' }),
      })
      const versionsPayload = await versionsResponse.json()
      expect(versionsPayload.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: firstVersionId, status: 'prod' }),
          expect.objectContaining({ id: secondVersionId, status: 'archived' }),
        ]),
      )
    } finally {
      testContext.cleanup()
    }
  })
})
