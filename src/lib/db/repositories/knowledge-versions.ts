import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type {
  KnowledgeChunk,
  KnowledgeCoverageAudit,
  KnowledgeParent,
  KnowledgeStageSummary,
  KnowledgeVersion,
} from '@/types/database'

interface KnowledgeVersionRow {
  id: string
  knowledge_base_id: string
  task_id: string | null
  name: string
  status: KnowledgeVersion['status']
  build_profile: string
  source_summary_json: string
  stage_summary_json: string
  coverage_audit_json: string
  qa_pair_count: number
  parent_count: number
  chunk_count: number
  pending_count: number
  blocked_count: number
  parents_file_path: string
  chunks_file_path: string
  manifest_file_path: string
  created_at: string
  updated_at: string
  published_at: string | null
}

interface KnowledgeParentRow {
  id: string
  knowledge_version_id: string
  question: string
  answer: string
  question_aliases_json: string
  metadata_json: string
  source_files_json: string
  source_record_ids_json: string
  review_status: KnowledgeParent['reviewStatus']
  record_kind: string
  is_high_risk: number
  inherited_risk_reason: string
  created_at: string
  updated_at: string
}

interface KnowledgeChunkRow {
  id: string
  knowledge_version_id: string
  parent_id: string
  chunk_order: number
  section_title: string
  chunk_text: string
  embedding_text: string
  chunk_type: string
  metadata_json: string
  created_at: string
  updated_at: string
}

function mapRowToKnowledgeParent(row: KnowledgeParentRow): KnowledgeParent {
  return {
    id: row.id,
    knowledgeVersionId: row.knowledge_version_id,
    question: row.question,
    answer: row.answer,
    questionAliases: JSON.parse(row.question_aliases_json) as string[],
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    sourceFiles: JSON.parse(row.source_files_json) as string[],
    sourceRecordIds: JSON.parse(row.source_record_ids_json) as string[],
    reviewStatus: row.review_status,
    recordKind: row.record_kind,
    isHighRisk: Boolean(row.is_high_risk),
    inheritedRiskReason: row.inherited_risk_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRowToKnowledgeChunk(row: KnowledgeChunkRow): KnowledgeChunk {
  return {
    id: row.id,
    knowledgeVersionId: row.knowledge_version_id,
    parentId: row.parent_id,
    chunkOrder: row.chunk_order,
    sectionTitle: row.section_title,
    chunkText: row.chunk_text,
    embeddingText: row.embedding_text,
    chunkType: row.chunk_type,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRowToKnowledgeVersion(row: KnowledgeVersionRow): KnowledgeVersion {
  return {
    id: row.id,
    knowledgeBaseId: row.knowledge_base_id,
    taskId: row.task_id,
    name: row.name,
    status: row.status,
    buildProfile: row.build_profile,
    sourceSummary: JSON.parse(row.source_summary_json) as Record<string, unknown>,
    stageSummary: JSON.parse(row.stage_summary_json) as KnowledgeStageSummary,
    coverageAudit: JSON.parse(row.coverage_audit_json) as KnowledgeCoverageAudit,
    qaPairCount: row.qa_pair_count,
    parentCount: row.parent_count,
    chunkCount: row.chunk_count,
    pendingCount: row.pending_count,
    blockedCount: row.blocked_count,
    parentsFilePath: row.parents_file_path,
    chunksFilePath: row.chunks_file_path,
    manifestFilePath: row.manifest_file_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }
}

export function findKnowledgeParentsByVersionId(knowledgeVersionId: string): KnowledgeParent[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM knowledge_parents WHERE knowledge_version_id = ? ORDER BY created_at ASC')
    .all(knowledgeVersionId) as KnowledgeParentRow[]
  return rows.map(mapRowToKnowledgeParent)
}

export function findKnowledgeChunksByVersionId(knowledgeVersionId: string): KnowledgeChunk[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM knowledge_chunks WHERE knowledge_version_id = ? ORDER BY chunk_order ASC, created_at ASC')
    .all(knowledgeVersionId) as KnowledgeChunkRow[]
  return rows.map(mapRowToKnowledgeChunk)
}

export function findKnowledgeVersionById(id: string): KnowledgeVersion | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM knowledge_versions WHERE id = ?').get(id) as KnowledgeVersionRow | undefined
  if (!row) return null
  return {
    ...mapRowToKnowledgeVersion(row),
    parents: findKnowledgeParentsByVersionId(id),
    chunks: findKnowledgeChunksByVersionId(id),
  }
}

export function findKnowledgeVersionsByProject(projectId: string): KnowledgeVersion[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT kv.*
    FROM knowledge_versions kv
    INNER JOIN knowledge_bases kb ON kb.id = kv.knowledge_base_id
    WHERE kb.project_id = ?
    ORDER BY kv.created_at DESC
  `).all(projectId) as KnowledgeVersionRow[]
  return rows.map(mapRowToKnowledgeVersion)
}

export function createKnowledgeVersion(data: {
  id?: string
  knowledgeBaseId: string
  taskId: string | null
  name: string
  buildProfile: string
  sourceSummary: Record<string, unknown>
  stageSummary: KnowledgeStageSummary
  coverageAudit: KnowledgeCoverageAudit
  qaPairCount: number
  parentCount: number
  chunkCount: number
  pendingCount: number
  blockedCount: number
  parentsFilePath: string
  chunksFilePath: string
  manifestFilePath: string
}): KnowledgeVersion {
  const db = getDb()
  const id = data.id ?? nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO knowledge_versions (
      id,
      knowledge_base_id,
      task_id,
      name,
      status,
      build_profile,
      source_summary_json,
      stage_summary_json,
      coverage_audit_json,
      qa_pair_count,
      parent_count,
      chunk_count,
      pending_count,
      blocked_count,
      parents_file_path,
      chunks_file_path,
      manifest_file_path,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.knowledgeBaseId,
    data.taskId,
    data.name,
    'draft',
    data.buildProfile,
    JSON.stringify(data.sourceSummary),
    JSON.stringify(data.stageSummary),
    JSON.stringify(data.coverageAudit),
    data.qaPairCount,
    data.parentCount,
    data.chunkCount,
    data.pendingCount,
    data.blockedCount,
    data.parentsFilePath,
    data.chunksFilePath,
    data.manifestFilePath,
    now,
    now,
  )

  return findKnowledgeVersionById(id)!
}

export function updateKnowledgeVersion(
  id: string,
  data: {
    status?: KnowledgeVersion['status']
    stageSummary?: KnowledgeStageSummary
    coverageAudit?: KnowledgeCoverageAudit
    pendingCount?: number
    blockedCount?: number
    parentCount?: number
    chunkCount?: number
    qaPairCount?: number
    publishedAt?: string | null
  },
): KnowledgeVersion | null {
  const existing = findKnowledgeVersionById(id)
  if (!existing) return null

  const db = getDb()
  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
  }
  if (data.stageSummary !== undefined) {
    fields.push('stage_summary_json = ?')
    values.push(JSON.stringify(data.stageSummary))
  }
  if (data.coverageAudit !== undefined) {
    fields.push('coverage_audit_json = ?')
    values.push(JSON.stringify(data.coverageAudit))
  }
  if (data.pendingCount !== undefined) {
    fields.push('pending_count = ?')
    values.push(data.pendingCount)
  }
  if (data.blockedCount !== undefined) {
    fields.push('blocked_count = ?')
    values.push(data.blockedCount)
  }
  if (data.parentCount !== undefined) {
    fields.push('parent_count = ?')
    values.push(data.parentCount)
  }
  if (data.chunkCount !== undefined) {
    fields.push('chunk_count = ?')
    values.push(data.chunkCount)
  }
  if (data.qaPairCount !== undefined) {
    fields.push('qa_pair_count = ?')
    values.push(data.qaPairCount)
  }
  if (data.publishedAt !== undefined) {
    fields.push('published_at = ?')
    values.push(data.publishedAt)
  }

  values.push(id)
  db.prepare(`UPDATE knowledge_versions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return findKnowledgeVersionById(id)
}

export function replaceKnowledgeParents(
  knowledgeVersionId: string,
  parents: Array<{
    id?: string
    question: string
    answer: string
    questionAliases: string[]
    metadata: Record<string, unknown>
    sourceFiles: string[]
    sourceRecordIds: string[]
    reviewStatus: KnowledgeParent['reviewStatus']
    recordKind: string
    isHighRisk: boolean
    inheritedRiskReason: string
  }>,
): KnowledgeParent[] {
  const db = getDb()
  const now = new Date().toISOString()
  const insert = db.prepare(`
    INSERT INTO knowledge_parents (
      id,
      knowledge_version_id,
      question,
      answer,
      question_aliases_json,
      metadata_json,
      source_files_json,
      source_record_ids_json,
      review_status,
      record_kind,
      is_high_risk,
      inherited_risk_reason,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM knowledge_parents WHERE knowledge_version_id = ?').run(knowledgeVersionId)
    for (const parent of parents) {
      insert.run(
        parent.id ?? nanoid(),
        knowledgeVersionId,
        parent.question,
        parent.answer,
        JSON.stringify(parent.questionAliases),
        JSON.stringify(parent.metadata),
        JSON.stringify(parent.sourceFiles),
        JSON.stringify(parent.sourceRecordIds),
        parent.reviewStatus,
        parent.recordKind,
        parent.isHighRisk ? 1 : 0,
        parent.inheritedRiskReason,
        now,
        now,
      )
    }
  })

  replace()
  return findKnowledgeParentsByVersionId(knowledgeVersionId)
}

export function replaceKnowledgeChunks(
  knowledgeVersionId: string,
  chunks: Array<{
    id?: string
    parentId: string
    chunkOrder: number
    sectionTitle: string
    chunkText: string
    embeddingText: string
    chunkType: string
    metadata: Record<string, unknown>
  }>,
): KnowledgeChunk[] {
  const db = getDb()
  const now = new Date().toISOString()
  const insert = db.prepare(`
    INSERT INTO knowledge_chunks (
      id,
      knowledge_version_id,
      parent_id,
      chunk_order,
      section_title,
      chunk_text,
      embedding_text,
      chunk_type,
      metadata_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM knowledge_chunks WHERE knowledge_version_id = ?').run(knowledgeVersionId)
    for (const chunk of chunks) {
      insert.run(
        chunk.id ?? nanoid(),
        knowledgeVersionId,
        chunk.parentId,
        chunk.chunkOrder,
        chunk.sectionTitle,
        chunk.chunkText,
        chunk.embeddingText,
        chunk.chunkType,
        JSON.stringify(chunk.metadata),
        now,
        now,
      )
    }
  })

  replace()
  return findKnowledgeChunksByVersionId(knowledgeVersionId)
}
