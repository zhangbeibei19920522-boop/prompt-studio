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

  it('creates a scope mapping version and applies it when building a knowledge version', async () => {
    const testContext = await setupKnowledgeRouteTest()

    try {
      testContext.db.prepare(`
        INSERT INTO documents (
          id,
          project_id,
          name,
          type,
          content,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'doc-model-faq',
        'project-1',
        'Cdmtv Model Spec.xlsx',
        'xlsx',
        [
          'Sheet: model - 85QD7N',
          'Question | answer',
          'How long is the Warranty? | The warranty is 1 year.',
        ].join('\n'),
        '2026-04-21T00:00:00.000Z',
      )

      const projectBaseRoute = await import('@/app/api/projects/[id]/knowledge-base/route')
      const projectTaskRoute = await import('@/app/api/projects/[id]/knowledge-build-tasks/route')
      const projectMappingRoute = await import('@/app/api/projects/[id]/knowledge-mapping-versions/route')
      const taskRoute = await import('@/app/api/knowledge-build-tasks/[id]/route')
      const versionRoute = await import('@/app/api/knowledge-versions/[id]/route')

      await projectBaseRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({ name: 'Customer Support KB' }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )

      const mappingResponse = await projectMappingRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'TV model platform mapping',
            fileName: 'tv-model-platform.xlsx',
            content: [
              'model | platform | product',
              '85QD7N | Google | TV',
            ].join('\n'),
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const mappingPayload = await mappingResponse.json()
      expect(mappingResponse.status).toBe(201)
      expect(mappingPayload.data).toMatchObject({
        name: 'TV model platform mapping',
        rowCount: 1,
        keyField: 'productModel',
      })

      const createTaskResponse = await projectTaskRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Mapped Batch Update',
            taskType: 'batch',
            documentIds: ['doc-model-faq'],
            mappingVersionId: mappingPayload.data.id,
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const createTaskPayload = await createTaskResponse.json()
      expect(createTaskResponse.status).toBe(202)

      const completedTask = await waitForTaskCompletion(taskRoute, createTaskPayload.data.task.id as string)
      expect(completedTask.input).toEqual(
        expect.objectContaining({
          mappingVersionId: mappingPayload.data.id,
          mappingRecords: [
            expect.objectContaining({
              lookupKey: '85QD7N',
            }),
          ],
        }),
      )

      const versionDetailResponse = await versionRoute.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: completedTask.knowledgeVersionId as string }),
      })
      const versionDetailPayload = await versionDetailResponse.json()

      expect(versionDetailPayload.data.parents[0].metadata.scope).toEqual({
        productModel: ['85QD7N'],
        platform: ['Google TV'],
        productCategory: ['TV'],
      })
      expect(versionDetailPayload.data.manifest.sourceSummary).toEqual(
        expect.objectContaining({
          mappingVersionId: mappingPayload.data.id,
          mappingRecordCount: 1,
        }),
      )
    } finally {
      testContext.cleanup()
    }
  })

  it('manages scope mappings through standalone backend APIs and freezes records into build tasks', async () => {
    const testContext = await setupKnowledgeRouteTest()

    try {
      testContext.db.prepare(`
        INSERT INTO documents (
          id,
          project_id,
          name,
          type,
          content,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'doc-managed-model-faq',
        'project-1',
        'Cdmtv Model Spec.xlsx',
        'xlsx',
        [
          'Sheet: model - 85QD7N',
          'Question | answer',
          'How long is the Warranty? | The warranty is 1 year.',
        ].join('\n'),
        '2026-04-21T00:00:00.000Z',
      )

      const projectBaseRoute = await import('@/app/api/projects/[id]/knowledge-base/route')
      const projectTaskRoute = await import('@/app/api/projects/[id]/knowledge-build-tasks/route')
      const projectMappingRoute = await import('@/app/api/projects/[id]/knowledge-scope-mappings/route')
      const mappingDetailRoute = await import('@/app/api/knowledge-scope-mappings/[id]/route')
      const mappingRecordsRoute = await import('@/app/api/knowledge-scope-mappings/[id]/records/route')
      const mappingRecordRoute = await import('@/app/api/knowledge-scope-mapping-records/[id]/route')
      const taskRoute = await import('@/app/api/knowledge-build-tasks/[id]/route')
      const versionRoute = await import('@/app/api/knowledge-versions/[id]/route')

      await projectBaseRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({ name: 'Customer Support KB' }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )

      const createMappingResponse = await projectMappingRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'TV model scope mapping',
            fileName: 'tv-model-platform.xlsx',
            content: [
              'model | platform | product',
              '85QD7N | Google | TV',
            ].join('\n'),
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const createMappingPayload = await createMappingResponse.json()
      expect(createMappingResponse.status).toBe(201)
      expect(createMappingPayload.data).toMatchObject({
        name: 'TV model scope mapping',
        rowCount: 1,
        keyField: 'productModel',
        records: [
          expect.objectContaining({
            lookupKey: '85QD7N',
            scope: expect.objectContaining({
              platform: ['Google TV'],
            }),
          }),
        ],
      })

      const mappingId = createMappingPayload.data.id as string
      const createdRecordId = createMappingPayload.data.records[0].id as string
      const duplicateRecordResponse = await mappingRecordsRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            lookupKey: '85 QD7N',
            scope: {
              productModel: ['85 QD7N'],
              platform: ['Fire TV'],
            },
          }),
        }),
        { params: Promise.resolve({ id: mappingId }) },
      )
      const duplicateRecordPayload = await duplicateRecordResponse.json()
      expect(duplicateRecordResponse.status).toBe(409)
      expect(duplicateRecordPayload.error).toContain('already exists')

      const updateRecordResponse = await mappingRecordRoute.PATCH(
        new Request('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({
            scope: {
              productModel: ['85QD7N'],
              platform: ['Roku TV'],
              productCategory: ['TV'],
            },
          }),
        }),
        { params: Promise.resolve({ id: createdRecordId }) },
      )
      expect(updateRecordResponse.status).toBe(200)

      const addRecordResponse = await mappingRecordsRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            lookupKey: '55R6G',
            scope: {
              productModel: ['55R6G'],
              platform: ['Google TV'],
            },
          }),
        }),
        { params: Promise.resolve({ id: mappingId }) },
      )
      const addRecordPayload = await addRecordResponse.json()
      expect(addRecordResponse.status).toBe(201)

      const duplicateUpdateResponse = await mappingRecordRoute.PATCH(
        new Request('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({
            lookupKey: '85QD7N',
          }),
        }),
        { params: Promise.resolve({ id: addRecordPayload.data.id as string }) },
      )
      const duplicateUpdatePayload = await duplicateUpdateResponse.json()
      expect(duplicateUpdateResponse.status).toBe(409)
      expect(duplicateUpdatePayload.error).toContain('already exists')

      const deleteRecordResponse = await mappingRecordRoute.DELETE(new Request('http://localhost', { method: 'DELETE' }), {
        params: Promise.resolve({ id: addRecordPayload.data.id as string }),
      })
      expect(deleteRecordResponse.status).toBe(200)

      const renameResponse = await mappingDetailRoute.PATCH(
        new Request('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated TV model scope mapping' }),
        }),
        { params: Promise.resolve({ id: mappingId }) },
      )
      expect(renameResponse.status).toBe(200)

      const detailResponse = await mappingDetailRoute.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: mappingId }),
      })
      const detailPayload = await detailResponse.json()
      expect(detailPayload.data).toMatchObject({
        id: mappingId,
        name: 'Updated TV model scope mapping',
        rowCount: 1,
        records: [
          expect.objectContaining({
            lookupKey: '85QD7N',
            scope: {
              productModel: ['85QD7N'],
              platform: ['Roku TV'],
              productCategory: ['TV'],
            },
          }),
        ],
      })

      const createTaskResponse = await projectTaskRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Managed Mapping Build',
            taskType: 'batch',
            documentIds: ['doc-managed-model-faq'],
            mappingId,
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const createTaskPayload = await createTaskResponse.json()
      expect(createTaskResponse.status).toBe(202)

      const completedTask = await waitForTaskCompletion(taskRoute, createTaskPayload.data.task.id as string)
      expect(completedTask.input).toEqual(
        expect.objectContaining({
          mappingId,
          mappingRecords: [
            expect.objectContaining({
              lookupKey: '85QD7N',
              scope: expect.objectContaining({
                platform: ['Roku TV'],
              }),
            }),
          ],
        }),
      )

      const versionDetailResponse = await versionRoute.GET(new Request('http://localhost'), {
        params: Promise.resolve({ id: completedTask.knowledgeVersionId as string }),
      })
      const versionDetailPayload = await versionDetailResponse.json()
      expect(versionDetailPayload.data.parents[0].metadata.scope).toEqual({
        productModel: ['85QD7N'],
        platform: ['Roku TV'],
        productCategory: ['TV'],
      })
    } finally {
      testContext.cleanup()
    }
  })

  it('rejects mapping version content that cannot be parsed into scope records', async () => {
    const testContext = await setupKnowledgeRouteTest()

    try {
      const projectMappingRoute = await import('@/app/api/projects/[id]/knowledge-mapping-versions/route')

      const mappingResponse = await projectMappingRoute.POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Invalid mapping',
            fileName: 'invalid-mapping.xlsx',
            content: [
              'random | notes',
              'only text | no scope fields',
            ].join('\n'),
          }),
        }),
        { params: Promise.resolve({ id: 'project-1' }) },
      )
      const mappingPayload = await mappingResponse.json()

      expect(mappingResponse.status).toBe(400)
      expect(mappingPayload.error).toContain('映射表暂时无法解析')
    } finally {
      testContext.cleanup()
    }
  })
})
