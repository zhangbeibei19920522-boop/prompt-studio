import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

interface KnowledgeRepositories {
  createKnowledgeBase: typeof import('@/lib/db/repositories/knowledge-bases').createKnowledgeBase
  findKnowledgeBaseByProjectId: typeof import('@/lib/db/repositories/knowledge-bases').findKnowledgeBaseByProjectId
  updateKnowledgeBase: typeof import('@/lib/db/repositories/knowledge-bases').updateKnowledgeBase
  createKnowledgeBuildTask: typeof import('@/lib/db/repositories/knowledge-build-tasks').createKnowledgeBuildTask
  updateKnowledgeBuildTask: typeof import('@/lib/db/repositories/knowledge-build-tasks').updateKnowledgeBuildTask
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
