import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { buildKnowledgeArtifactPaths } from '@/lib/knowledge/storage'
import {
  ensureIndexIngestArtifacts,
  writeIndexIngestArtifacts,
} from '@/lib/knowledge/index-ingest'

describe('index ingest storage', () => {
  it('exposes index-local ingest artifact paths', () => {
    const paths = buildKnowledgeArtifactPaths({
      projectId: 'project-1',
      knowledgeBaseId: 'kb-1',
      knowledgeVersionId: 'version-1',
    })

    expect(paths.indexParentsFilePath).toContain('/indexes/version-1/parents.jsonl')
    expect(paths.indexChunksFilePath).toContain('/indexes/version-1/chunks.jsonl')
    expect(paths.indexVectorsFilePath).toContain('/indexes/version-1/vectors.jsonl')
    expect(paths.indexIngestFilePath).toContain('/indexes/version-1/ingest.json')
  })

  it('writes index-local ingest artifacts for new index versions', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-ingest-write-'))
    const paths = {
      ...buildKnowledgeArtifactPaths({
        projectId: 'project-1',
        knowledgeBaseId: 'kb-1',
        knowledgeVersionId: 'version-1',
      }),
      baseDir: tempDir,
      versionDir: path.join(tempDir, 'versions', 'version-1'),
      indexDir: path.join(tempDir, 'indexes', 'version-1'),
      parentsFilePath: path.join(tempDir, 'versions', 'version-1', 'parents.jsonl'),
      chunksFilePath: path.join(tempDir, 'versions', 'version-1', 'chunks.jsonl'),
      manifestFilePath: path.join(tempDir, 'versions', 'version-1', 'manifest.json'),
      indexManifestFilePath: path.join(tempDir, 'indexes', 'version-1', 'manifest.json'),
      indexParentsFilePath: path.join(tempDir, 'indexes', 'version-1', 'parents.jsonl'),
      indexChunksFilePath: path.join(tempDir, 'indexes', 'version-1', 'chunks.jsonl'),
      indexVectorsFilePath: path.join(tempDir, 'indexes', 'version-1', 'vectors.jsonl'),
      indexIngestFilePath: path.join(tempDir, 'indexes', 'version-1', 'ingest.json'),
    }

    try {
      const result = writeIndexIngestArtifacts({
        paths,
        parents: [{ id: 'parent-1', question_clean: 'How do I reset the router?', question_aliases: [] }],
        chunks: [{ id: 'chunk-1', parent_id: 'parent-1', chunk_text: 'Hold the reset button for 10 seconds.' }],
      })

      expect(result.backfilled).toBe(false)
      expect(result.parents).toHaveLength(1)
      expect(result.chunks).toHaveLength(1)
      expect(fs.existsSync(paths.indexParentsFilePath)).toBe(true)
      expect(fs.existsSync(paths.indexChunksFilePath)).toBe(true)
      expect(fs.existsSync(paths.indexVectorsFilePath)).toBe(true)
      expect(fs.existsSync(paths.indexIngestFilePath)).toBe(true)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('writes external embedding vectors for index-local ingest artifacts', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-ingest-embedding-'))
    const paths = {
      ...buildKnowledgeArtifactPaths({
        projectId: 'project-1',
        knowledgeBaseId: 'kb-1',
        knowledgeVersionId: 'version-1',
      }),
      baseDir: tempDir,
      versionDir: path.join(tempDir, 'versions', 'version-1'),
      indexDir: path.join(tempDir, 'indexes', 'version-1'),
      parentsFilePath: path.join(tempDir, 'versions', 'version-1', 'parents.jsonl'),
      chunksFilePath: path.join(tempDir, 'versions', 'version-1', 'chunks.jsonl'),
      manifestFilePath: path.join(tempDir, 'versions', 'version-1', 'manifest.json'),
      indexManifestFilePath: path.join(tempDir, 'indexes', 'version-1', 'manifest.json'),
      indexParentsFilePath: path.join(tempDir, 'indexes', 'version-1', 'parents.jsonl'),
      indexChunksFilePath: path.join(tempDir, 'indexes', 'version-1', 'chunks.jsonl'),
      indexVectorsFilePath: path.join(tempDir, 'indexes', 'version-1', 'vectors.jsonl'),
      indexIngestFilePath: path.join(tempDir, 'indexes', 'version-1', 'ingest.json'),
    }
    const embedTexts = vi.fn(async (texts: string[], options: { textType: string }) => {
      expect(texts).toEqual(['主问题：How do I reset the router?'])
      expect(options.textType).toBe('document')
      return [[0.11, 0.22]]
    })

    try {
      const result = await writeIndexIngestArtifacts({
        paths,
        parents: [{ id: 'parent-1', question_clean: 'How do I reset the router?', question_aliases: [] }],
        chunks: [
          {
            id: 'chunk-1',
            parent_id: 'parent-1',
            embedding_text: '主问题：How do I reset the router?',
            chunk_text: 'Hold the reset button for 10 seconds.',
          },
        ],
        embeddingClient: {
          provider: 'external',
          modelName: 'text-embedding-v4',
          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          embedTexts,
          embedText: vi.fn(),
        },
      })

      expect(result.vectors).toEqual([
        expect.objectContaining({
          chunk_id: 'chunk-1',
          parent_id: 'parent-1',
          embedding_text: '主问题：How do I reset the router?',
          vector: [0.11, 0.22],
        }),
      ])
      expect(JSON.parse(fs.readFileSync(paths.indexIngestFilePath, 'utf-8'))).toEqual(
        expect.objectContaining({
          embeddingProvider: 'external',
          embeddingModel: 'text-embedding-v4',
          embeddingBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        }),
      )
      expect(embedTexts).toHaveBeenCalledTimes(1)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('passes embedding batch and parallel env config to the resolved index embedding client', async () => {
    vi.resetModules()
    vi.stubEnv('EMBEDDING_API_KEY', 'test-key')
    vi.stubEnv('EMBEDDING_MODEL', 'text-embedding-v4')
    vi.stubEnv('EMBEDDING_BASE_URL', 'https://embedding.example/v1')
    vi.stubEnv('EMBEDDING_BATCH_SIZE', '1')
    vi.stubEnv('EMBEDDING_PARALLEL_REQUESTS', '2')

    let activeRequests = 0
    let maxActiveRequests = 0
    const proxyFetch = vi.fn(async (_url: string, init: RequestInit) => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await new Promise((resolve) => setTimeout(resolve, 20))
      activeRequests -= 1
      const body = JSON.parse(String(init.body)) as { input: string[] }
      return new Response(
        JSON.stringify({
          data: body.input.map((_text, index) => ({ index, embedding: [index] })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })

    vi.doMock('@/lib/ai/proxy-fetch', () => ({
      proxyFetch,
    }))

    try {
      const { resolveIndexEmbeddingClient } = await import('@/lib/knowledge/index-ingest')
      const client = resolveIndexEmbeddingClient()

      await client?.embedTexts(['文档一', '文档二', '文档三'], { textType: 'document' })

      expect(maxActiveRequests).toBeGreaterThan(1)
      expect(proxyFetch).toHaveBeenCalledWith(
        'https://embedding.example/v1/embeddings',
        expect.objectContaining({
          body: expect.stringContaining('"model":"text-embedding-v4"'),
        }),
      )
    } finally {
      vi.doUnmock('@/lib/ai/proxy-fetch')
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it('rebuilds local-hash vectors when external embedding config is available', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-ingest-rebuild-external-'))
    const paths = {
      ...buildKnowledgeArtifactPaths({
        projectId: 'project-1',
        knowledgeBaseId: 'kb-1',
        knowledgeVersionId: 'version-1',
      }),
      baseDir: tempDir,
      versionDir: path.join(tempDir, 'versions', 'version-1'),
      indexDir: path.join(tempDir, 'indexes', 'version-1'),
      parentsFilePath: path.join(tempDir, 'versions', 'version-1', 'parents.jsonl'),
      chunksFilePath: path.join(tempDir, 'versions', 'version-1', 'chunks.jsonl'),
      manifestFilePath: path.join(tempDir, 'versions', 'version-1', 'manifest.json'),
      indexManifestFilePath: path.join(tempDir, 'indexes', 'version-1', 'manifest.json'),
      indexParentsFilePath: path.join(tempDir, 'indexes', 'version-1', 'parents.jsonl'),
      indexChunksFilePath: path.join(tempDir, 'indexes', 'version-1', 'chunks.jsonl'),
      indexVectorsFilePath: path.join(tempDir, 'indexes', 'version-1', 'vectors.jsonl'),
      indexIngestFilePath: path.join(tempDir, 'indexes', 'version-1', 'ingest.json'),
    }
    const embedTexts = vi.fn(async () => [[0.9, 0.8]])

    try {
      fs.mkdirSync(path.dirname(paths.indexParentsFilePath), { recursive: true })
      fs.writeFileSync(
        paths.indexParentsFilePath,
        `${JSON.stringify({ id: 'parent-1', question_clean: 'How do I reset the router?', question_aliases: [] })}\n`,
        'utf-8',
      )
      fs.writeFileSync(
        paths.indexChunksFilePath,
        `${JSON.stringify({ id: 'chunk-1', parent_id: 'parent-1', embedding_text: '主问题：How do I reset the router?' })}\n`,
        'utf-8',
      )
      fs.writeFileSync(
        paths.indexVectorsFilePath,
        `${JSON.stringify({ chunk_id: 'chunk-1', parent_id: 'parent-1', vector: [0.1, 0.2] })}\n`,
        'utf-8',
      )
      fs.writeFileSync(
        paths.indexIngestFilePath,
        JSON.stringify({ embeddingProvider: 'local-hash-v1', embeddingModel: 'local-hash-v1' }),
        'utf-8',
      )

      const result = await ensureIndexIngestArtifacts({
        paths,
        embeddingClient: {
          provider: 'external',
          modelName: 'text-embedding-v4',
          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          embedTexts,
          embedText: vi.fn(),
        },
      })

      expect(result.backfilled).toBe(true)
      expect(result.vectors[0]?.vector).toEqual([0.9, 0.8])
      expect(embedTexts).toHaveBeenCalledTimes(1)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('reuses unchanged chunk embeddings when rewriting external ingest artifacts', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-ingest-cache-'))
    const paths = {
      ...buildKnowledgeArtifactPaths({
        projectId: 'project-1',
        knowledgeBaseId: 'kb-1',
        knowledgeVersionId: 'version-1',
      }),
      baseDir: tempDir,
      versionDir: path.join(tempDir, 'versions', 'version-1'),
      indexDir: path.join(tempDir, 'indexes', 'version-1'),
      parentsFilePath: path.join(tempDir, 'versions', 'version-1', 'parents.jsonl'),
      chunksFilePath: path.join(tempDir, 'versions', 'version-1', 'chunks.jsonl'),
      manifestFilePath: path.join(tempDir, 'versions', 'version-1', 'manifest.json'),
      indexManifestFilePath: path.join(tempDir, 'indexes', 'version-1', 'manifest.json'),
      indexParentsFilePath: path.join(tempDir, 'indexes', 'version-1', 'parents.jsonl'),
      indexChunksFilePath: path.join(tempDir, 'indexes', 'version-1', 'chunks.jsonl'),
      indexVectorsFilePath: path.join(tempDir, 'indexes', 'version-1', 'vectors.jsonl'),
      indexIngestFilePath: path.join(tempDir, 'indexes', 'version-1', 'ingest.json'),
    }
    const embedTexts = vi
      .fn()
      .mockImplementationOnce(async (texts: string[]) => {
        expect(texts).toEqual(['主问题：A', '主问题：B'])
        return [[0.1], [0.2]]
      })
      .mockImplementationOnce(async (texts: string[]) => {
        expect(texts).toEqual(['主问题：B changed'])
        return [[0.3]]
      })
    const embeddingClient = {
      provider: 'external',
      modelName: 'text-embedding-v4',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      embedTexts,
      embedText: vi.fn(),
    }

    try {
      await writeIndexIngestArtifacts({
        paths,
        parents: [
          { id: 'parent-a', question_clean: 'A', question_aliases: [] },
          { id: 'parent-b', question_clean: 'B', question_aliases: [] },
        ],
        chunks: [
          { id: 'chunk-a', parent_id: 'parent-a', embedding_text: '主问题：A' },
          { id: 'chunk-b', parent_id: 'parent-b', embedding_text: '主问题：B' },
        ],
        embeddingClient,
      })

      const result = await writeIndexIngestArtifacts({
        paths,
        parents: [
          { id: 'parent-a', question_clean: 'A', question_aliases: [] },
          { id: 'parent-b', question_clean: 'B', question_aliases: [] },
        ],
        chunks: [
          { id: 'chunk-a', parent_id: 'parent-a', embedding_text: '主问题：A' },
          { id: 'chunk-b', parent_id: 'parent-b', embedding_text: '主问题：B changed' },
        ],
        embeddingClient,
      })

      expect(result.vectors.map((vector) => vector.vector)).toEqual([[0.1], [0.3]])
      expect(embedTexts).toHaveBeenCalledTimes(2)
      expect(fs.existsSync(path.join(paths.indexDir, 'embedding-cache.json'))).toBe(true)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('lazy-backfills missing index ingest artifacts from source knowledge artifacts', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-ingest-backfill-'))
    const paths = {
      ...buildKnowledgeArtifactPaths({
        projectId: 'project-1',
        knowledgeBaseId: 'kb-1',
        knowledgeVersionId: 'version-1',
      }),
      baseDir: tempDir,
      versionDir: path.join(tempDir, 'versions', 'version-1'),
      indexDir: path.join(tempDir, 'indexes', 'version-1'),
      parentsFilePath: path.join(tempDir, 'versions', 'version-1', 'parents.jsonl'),
      chunksFilePath: path.join(tempDir, 'versions', 'version-1', 'chunks.jsonl'),
      manifestFilePath: path.join(tempDir, 'versions', 'version-1', 'manifest.json'),
      indexManifestFilePath: path.join(tempDir, 'indexes', 'version-1', 'manifest.json'),
      indexParentsFilePath: path.join(tempDir, 'indexes', 'version-1', 'parents.jsonl'),
      indexChunksFilePath: path.join(tempDir, 'indexes', 'version-1', 'chunks.jsonl'),
      indexVectorsFilePath: path.join(tempDir, 'indexes', 'version-1', 'vectors.jsonl'),
      indexIngestFilePath: path.join(tempDir, 'indexes', 'version-1', 'ingest.json'),
    }

    try {
      fs.mkdirSync(path.dirname(paths.parentsFilePath), { recursive: true })
      fs.mkdirSync(path.dirname(paths.chunksFilePath), { recursive: true })
      fs.writeFileSync(
        paths.parentsFilePath,
        `${JSON.stringify({ id: 'parent-1', question_clean: 'How do I reset the router?', question_aliases: [] })}\n`,
        'utf-8',
      )
      fs.writeFileSync(
        paths.chunksFilePath,
        `${JSON.stringify({ id: 'chunk-1', parent_id: 'parent-1', chunk_text: 'Hold the reset button for 10 seconds.' })}\n`,
        'utf-8',
      )

      const result = ensureIndexIngestArtifacts({ paths })

      expect(result.backfilled).toBe(true)
      expect(result.parents).toHaveLength(1)
      expect(result.chunks).toHaveLength(1)
      expect(result.vectors).toHaveLength(1)
      expect(fs.existsSync(paths.indexParentsFilePath)).toBe(true)
      expect(fs.existsSync(paths.indexChunksFilePath)).toBe(true)
      expect(fs.existsSync(paths.indexVectorsFilePath)).toBe(true)
      expect(fs.existsSync(paths.indexIngestFilePath)).toBe(true)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('writes index-local ingest artifacts when ensuring an index version', async () => {
    const originalCwd = process.cwd()
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-ingest-service-'))

    process.chdir(tempDir)
    vi.resetModules()

    try {
      const { getDb } = await import('@/lib/db')
      const { createKnowledgeBase } = await import('@/lib/db/repositories/knowledge-bases')
      const { createKnowledgeVersion } = await import('@/lib/db/repositories/knowledge-versions')
      const { ensureKnowledgeIndexVersion } = await import('@/lib/knowledge/service')
      const { buildKnowledgeArtifactPaths: buildPaths } = await import('@/lib/knowledge/storage')
      const db = getDb()
      const now = '2026-04-23T00:00:00.000Z'

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

      const knowledgeBase = createKnowledgeBase({
        projectId: 'project-1',
        name: 'Customer Support KB',
      })
      const paths = buildPaths({
        projectId: 'project-1',
        knowledgeBaseId: knowledgeBase.id,
        knowledgeVersionId: 'version-1',
      })

      fs.mkdirSync(path.dirname(paths.parentsFilePath), { recursive: true })
      fs.writeFileSync(
        paths.parentsFilePath,
        `${JSON.stringify({ id: 'parent-1', question_clean: 'How do I reset the router?', question_aliases: [] })}\n`,
        'utf-8',
      )
      fs.writeFileSync(
        paths.chunksFilePath,
        `${JSON.stringify({ id: 'chunk-1', parent_id: 'parent-1', chunk_text: 'Hold the reset button for 10 seconds.' })}\n`,
        'utf-8',
      )
      fs.writeFileSync(paths.manifestFilePath, '{}', 'utf-8')

      createKnowledgeVersion({
        id: 'version-1',
        knowledgeBaseId: knowledgeBase.id,
        taskId: null,
        name: 'Version 1',
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

      ensureKnowledgeIndexVersion('version-1')

      expect(fs.existsSync(paths.indexParentsFilePath)).toBe(true)
      expect(fs.existsSync(paths.indexChunksFilePath)).toBe(true)
      expect(fs.existsSync(paths.indexVectorsFilePath)).toBe(true)
      expect(fs.existsSync(paths.indexIngestFilePath)).toBe(true)

      db.close()
    } finally {
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
