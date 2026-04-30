import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

interface KnowledgeRepositories {
  createKnowledgeBase: typeof import('@/lib/db/repositories/knowledge-bases').createKnowledgeBase
  findKnowledgeBaseByProjectId: typeof import('@/lib/db/repositories/knowledge-bases').findKnowledgeBaseByProjectId
  updateKnowledgeBase: typeof import('@/lib/db/repositories/knowledge-bases').updateKnowledgeBase
  createKnowledgeBuildTask: typeof import('@/lib/db/repositories/knowledge-build-tasks').createKnowledgeBuildTask
  updateKnowledgeBuildTask: typeof import('@/lib/db/repositories/knowledge-build-tasks').updateKnowledgeBuildTask
  createKnowledgeScopeMappingVersion: typeof import('@/lib/db/repositories/knowledge-mapping-versions').createKnowledgeScopeMappingVersion
  findKnowledgeScopeMappingVersionById: typeof import('@/lib/db/repositories/knowledge-mapping-versions').findKnowledgeScopeMappingVersionById
  findKnowledgeScopeMappingVersionsByProject: typeof import('@/lib/db/repositories/knowledge-mapping-versions').findKnowledgeScopeMappingVersionsByProject
  createKnowledgeScopeMapping: typeof import('@/lib/db/repositories/knowledge-scope-mappings').createKnowledgeScopeMapping
  findKnowledgeScopeMappingById: typeof import('@/lib/db/repositories/knowledge-scope-mappings').findKnowledgeScopeMappingById
  findKnowledgeScopeMappingsByProject: typeof import('@/lib/db/repositories/knowledge-scope-mappings').findKnowledgeScopeMappingsByProject
  updateKnowledgeScopeMapping: typeof import('@/lib/db/repositories/knowledge-scope-mappings').updateKnowledgeScopeMapping
  deleteKnowledgeScopeMapping: typeof import('@/lib/db/repositories/knowledge-scope-mappings').deleteKnowledgeScopeMapping
  createKnowledgeScopeMappingRecord: typeof import('@/lib/db/repositories/knowledge-scope-mappings').createKnowledgeScopeMappingRecord
  findKnowledgeScopeMappingRecords: typeof import('@/lib/db/repositories/knowledge-scope-mappings').findKnowledgeScopeMappingRecords
  updateKnowledgeScopeMappingRecord: typeof import('@/lib/db/repositories/knowledge-scope-mappings').updateKnowledgeScopeMappingRecord
  deleteKnowledgeScopeMappingRecord: typeof import('@/lib/db/repositories/knowledge-scope-mappings').deleteKnowledgeScopeMappingRecord
  refreshKnowledgeScopeMappingSummary: typeof import('@/lib/db/repositories/knowledge-scope-mappings').refreshKnowledgeScopeMappingSummary
  createKnowledgeVersion: typeof import('@/lib/db/repositories/knowledge-versions').createKnowledgeVersion
  replaceKnowledgeParents: typeof import('@/lib/db/repositories/knowledge-versions').replaceKnowledgeParents
  replaceKnowledgeChunks: typeof import('@/lib/db/repositories/knowledge-versions').replaceKnowledgeChunks
  findKnowledgeVersionById: typeof import('@/lib/db/repositories/knowledge-versions').findKnowledgeVersionById
  createKnowledgeIndexVersion: typeof import('@/lib/db/repositories/knowledge-index-versions').createKnowledgeIndexVersion
  buildKnowledgeArtifactPaths: typeof import('@/lib/knowledge/storage').buildKnowledgeArtifactPaths
}

async function setupKnowledgeRepositoryTest() {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-repositories-'))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import('@/lib/db')
  const db = getDb()

  const repositories = {
    ...(await import('@/lib/db/repositories/knowledge-bases')),
    ...(await import('@/lib/db/repositories/knowledge-build-tasks')),
    ...(await import('@/lib/db/repositories/knowledge-mapping-versions')),
    ...(await import('@/lib/db/repositories/knowledge-scope-mappings')),
    ...(await import('@/lib/db/repositories/knowledge-versions')),
    ...(await import('@/lib/db/repositories/knowledge-index-versions')),
    ...(await import('@/lib/knowledge/storage')),
  } as KnowledgeRepositories

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

describe('knowledge repositories', () => {
  it('creates and lists scope mapping versions with parsed mapping records', async () => {
    const testContext = await setupKnowledgeRepositoryTest()

    try {
      const mappingVersion = testContext.repositories.createKnowledgeScopeMappingVersion({
        projectId: 'project-1',
        name: 'TV model platform mapping',
        fileName: 'tv-model-platform.xlsx',
        fileHash: 'hash-1',
        rowCount: 2,
        keyField: 'productModel',
        scopeFields: ['productModel', 'platform', 'productCategory'],
        recordsFilePath: '/tmp/mapping-records.jsonl',
        records: [
          {
            lookupKey: '85QD7N',
            scope: {
              productModel: ['85QD7N'],
              platform: ['Google TV'],
              productCategory: ['TV'],
            },
          },
        ],
      })

      expect(testContext.repositories.findKnowledgeScopeMappingVersionById(mappingVersion.id)).toMatchObject({
        id: mappingVersion.id,
        projectId: 'project-1',
        rowCount: 2,
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
      expect(testContext.repositories.findKnowledgeScopeMappingVersionsByProject('project-1')).toEqual([
        expect.objectContaining({
          id: mappingVersion.id,
          fileName: 'tv-model-platform.xlsx',
        }),
      ])
    } finally {
      testContext.cleanup()
    }
  })

  it('creates, edits, and deletes managed scope mappings and records', async () => {
    const testContext = await setupKnowledgeRepositoryTest()

    try {
      const mapping = testContext.repositories.createKnowledgeScopeMapping({
        projectId: 'project-1',
        name: 'TV model platform mapping',
        sourceFileName: 'tv-model-platform.xlsx',
        sourceFileHash: 'hash-1',
        keyField: 'productModel',
        scopeFields: ['productModel', 'platform'],
        rowCount: 0,
      })
      const record = testContext.repositories.createKnowledgeScopeMappingRecord({
        mappingId: mapping.id,
        lookupKey: '85QD7N',
        scope: {
          productModel: ['85QD7N'],
          platform: ['Google TV'],
        },
        raw: {
          rowIndex: 2,
        },
      })

      testContext.repositories.refreshKnowledgeScopeMappingSummary(mapping.id)

      expect(testContext.repositories.findKnowledgeScopeMappingsByProject('project-1')).toEqual([
        expect.objectContaining({
          id: mapping.id,
          name: 'TV model platform mapping',
          rowCount: 1,
          scopeFields: ['productModel', 'platform'],
        }),
      ])
      expect(testContext.repositories.findKnowledgeScopeMappingRecords(mapping.id)).toEqual([
        expect.objectContaining({
          id: record.id,
          lookupKey: '85QD7N',
          scope: expect.objectContaining({
            platform: ['Google TV'],
          }),
          raw: {
            rowIndex: 2,
          },
        }),
      ])

      const updatedRecord = testContext.repositories.updateKnowledgeScopeMappingRecord(record.id, {
        lookupKey: '85QD7N',
        scope: {
          productModel: ['85QD7N'],
          platform: ['Roku TV'],
          productCategory: ['TV'],
        },
        raw: {
          editedBy: 'operator',
        },
      })
      testContext.repositories.refreshKnowledgeScopeMappingSummary(mapping.id)

      expect(updatedRecord).toMatchObject({
        id: record.id,
        lookupKey: '85QD7N',
        scope: {
          productModel: ['85QD7N'],
          platform: ['Roku TV'],
          productCategory: ['TV'],
        },
      })
      expect(testContext.repositories.findKnowledgeScopeMappingById(mapping.id)).toMatchObject({
        id: mapping.id,
        rowCount: 1,
        scopeFields: ['productModel', 'platform', 'productCategory'],
      })

      expect(testContext.repositories.updateKnowledgeScopeMapping(mapping.id, { name: 'Updated mapping' })).toMatchObject({
        id: mapping.id,
        name: 'Updated mapping',
      })
      expect(testContext.repositories.deleteKnowledgeScopeMappingRecord(record.id)).toBe(true)
      testContext.repositories.refreshKnowledgeScopeMappingSummary(mapping.id)
      expect(testContext.repositories.findKnowledgeScopeMappingById(mapping.id)).toMatchObject({
        rowCount: 0,
        scopeFields: [],
      })
      expect(testContext.repositories.deleteKnowledgeScopeMapping(mapping.id)).toBe(true)
      expect(testContext.repositories.findKnowledgeScopeMappingById(mapping.id)).toBeNull()
    } finally {
      testContext.cleanup()
    }
  })

  it('creates, updates, and links knowledge base, task, version, and index records', async () => {
    const testContext = await setupKnowledgeRepositoryTest()

    try {
      const knowledgeBase = testContext.repositories.createKnowledgeBase({
        projectId: 'project-1',
        name: 'Customer Support KB',
      })

      expect(testContext.repositories.findKnowledgeBaseByProjectId('project-1')).toMatchObject({
        id: knowledgeBase.id,
        name: 'Customer Support KB',
        profileKey: 'generic_customer_service',
      })

      const task = testContext.repositories.createKnowledgeBuildTask({
        projectId: 'project-1',
        knowledgeBaseId: knowledgeBase.id,
        name: 'Q2 Batch Update',
        taskType: 'batch',
        baseVersionId: null,
        input: {
          documentIds: ['doc-1'],
          manualDrafts: [],
          repairQuestions: [],
        },
      })

      const paths = testContext.repositories.buildKnowledgeArtifactPaths({
        projectId: 'project-1',
        knowledgeBaseId: knowledgeBase.id,
        knowledgeVersionId: 'kv-1',
      })

      expect(paths.parentsFilePath.endsWith(path.join('versions', 'kv-1', 'parents.jsonl'))).toBe(true)
      expect(paths.chunksFilePath.endsWith(path.join('versions', 'kv-1', 'chunks.jsonl'))).toBe(true)

      const version = testContext.repositories.createKnowledgeVersion({
        knowledgeBaseId: knowledgeBase.id,
        taskId: task.id,
        name: 'Q2 Batch Draft',
        buildProfile: 'generic_customer_service',
        sourceSummary: { sourceCount: 1 },
        stageSummary: {
          sourceCount: 1,
          excludedCount: 0,
          rawRecordCount: 1,
          cleanedCount: 1,
          includeCount: 1,
          highRiskCount: 0,
          conflictCount: 0,
          pendingCount: 0,
          blockedCount: 0,
          approvedCount: 1,
          parentCount: 1,
          chunkCount: 1,
          coverage: 100,
          orphanCount: 0,
          ambiguityCount: 0,
          stageCounts: [],
        },
        coverageAudit: {
          coverage: 100,
          auditStatus: 'normal',
          reasons: [],
          orphanRecords: [],
          ambiguityRecords: [],
        },
        qaPairCount: 1,
        parentCount: 1,
        chunkCount: 1,
        pendingCount: 0,
        blockedCount: 0,
        parentsFilePath: paths.parentsFilePath,
        chunksFilePath: paths.chunksFilePath,
        manifestFilePath: paths.manifestFilePath,
      })

      testContext.repositories.replaceKnowledgeParents(version.id, [
        {
          id: 'parent-1',
          question: 'How to reset the router password?',
          answer: 'Hold Reset for 10 seconds.',
          questionAliases: ['Reset router password'],
          metadata: { intent: 'how_to' },
          sourceFiles: ['router-guide.txt'],
          sourceRecordIds: ['record-1'],
          reviewStatus: 'approved',
          recordKind: 'merge_ready_faq',
          isHighRisk: false,
          inheritedRiskReason: '',
        },
      ])

      testContext.repositories.replaceKnowledgeChunks(version.id, [
        {
          id: 'chunk-1',
          parentId: 'parent-1',
          chunkOrder: 1,
          sectionTitle: 'Overview',
          chunkText: 'Hold Reset for 10 seconds.',
          embeddingText: 'Question: How to reset the router password?\nAnswer Part:\nHold Reset for 10 seconds.',
          chunkType: 'answer',
          metadata: { intent: 'how_to' },
        },
      ])

      const indexVersion = testContext.repositories.createKnowledgeIndexVersion({
        knowledgeBaseId: knowledgeBase.id,
        knowledgeVersionId: version.id,
        name: 'Q2 Batch Index',
        profileKey: 'generic_customer_service',
        parentCount: 1,
        chunkCount: 1,
        stageSummary: version.stageSummary,
        manifestFilePath: paths.indexManifestFilePath,
      })

      testContext.repositories.updateKnowledgeBuildTask(task.id, {
        status: 'succeeded',
        knowledgeVersionId: version.id,
        knowledgeIndexVersionId: indexVersion.id,
      })

      testContext.repositories.updateKnowledgeBase(knowledgeBase.id, {
        currentDraftVersionId: version.id,
        currentStgVersionId: version.id,
        currentStgIndexVersionId: indexVersion.id,
      })

      expect(testContext.repositories.findKnowledgeVersionById(version.id)).toMatchObject({
        id: version.id,
        parentCount: 1,
        chunkCount: 1,
        parents: [
          expect.objectContaining({
            id: 'parent-1',
            question: 'How to reset the router password?',
          }),
        ],
        chunks: [
          expect.objectContaining({
            id: 'chunk-1',
            parentId: 'parent-1',
          }),
        ],
      })
    } finally {
      testContext.cleanup()
    }
  })
})
