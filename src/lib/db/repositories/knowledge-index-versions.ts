import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type { KnowledgeIndexVersion, KnowledgeStageSummary } from '@/types/database'

interface KnowledgeIndexVersionRow {
  id: string
  knowledge_base_id: string
  knowledge_version_id: string
  name: string
  status: KnowledgeIndexVersion['status']
  profile_key: string
  parent_count: number
  chunk_count: number
  stage_summary_json: string
  manifest_file_path: string
  created_at: string
  updated_at: string
  built_at: string | null
  published_at: string | null
}

function mapRowToKnowledgeIndexVersion(row: KnowledgeIndexVersionRow): KnowledgeIndexVersion {
  return {
    id: row.id,
    knowledgeBaseId: row.knowledge_base_id,
    knowledgeVersionId: row.knowledge_version_id,
    name: row.name,
    status: row.status,
    profileKey: row.profile_key,
    parentCount: row.parent_count,
    chunkCount: row.chunk_count,
    stageSummary: JSON.parse(row.stage_summary_json) as KnowledgeStageSummary,
    manifestFilePath: row.manifest_file_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    builtAt: row.built_at,
    publishedAt: row.published_at,
  }
}

export function findKnowledgeIndexVersionById(id: string): KnowledgeIndexVersion | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM knowledge_index_versions WHERE id = ?')
    .get(id) as KnowledgeIndexVersionRow | undefined
  return row ? mapRowToKnowledgeIndexVersion(row) : null
}

export function findKnowledgeIndexVersionByKnowledgeVersionId(knowledgeVersionId: string): KnowledgeIndexVersion | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM knowledge_index_versions WHERE knowledge_version_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(knowledgeVersionId) as KnowledgeIndexVersionRow | undefined
  return row ? mapRowToKnowledgeIndexVersion(row) : null
}

export function findKnowledgeIndexVersionsByProject(projectId: string): KnowledgeIndexVersion[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT kiv.*
    FROM knowledge_index_versions kiv
    INNER JOIN knowledge_bases kb ON kb.id = kiv.knowledge_base_id
    WHERE kb.project_id = ?
    ORDER BY kiv.created_at DESC
  `).all(projectId) as KnowledgeIndexVersionRow[]
  return rows.map(mapRowToKnowledgeIndexVersion)
}

export function createKnowledgeIndexVersion(data: {
  knowledgeBaseId: string
  knowledgeVersionId: string
  name: string
  profileKey: string
  parentCount: number
  chunkCount: number
  stageSummary: KnowledgeStageSummary
  manifestFilePath: string
}): KnowledgeIndexVersion {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO knowledge_index_versions (
      id,
      knowledge_base_id,
      knowledge_version_id,
      name,
      status,
      profile_key,
      parent_count,
      chunk_count,
      stage_summary_json,
      manifest_file_path,
      created_at,
      updated_at,
      built_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.knowledgeBaseId,
    data.knowledgeVersionId,
    data.name,
    'ready',
    data.profileKey,
    data.parentCount,
    data.chunkCount,
    JSON.stringify(data.stageSummary),
    data.manifestFilePath,
    now,
    now,
    now,
  )

  return findKnowledgeIndexVersionById(id)!
}

export function updateKnowledgeIndexVersion(
  id: string,
  data: {
    status?: KnowledgeIndexVersion['status']
    publishedAt?: string | null
  },
): KnowledgeIndexVersion | null {
  const existing = findKnowledgeIndexVersionById(id)
  if (!existing) return null

  const db = getDb()
  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
  }
  if (data.publishedAt !== undefined) {
    fields.push('published_at = ?')
    values.push(data.publishedAt)
  }

  values.push(id)
  db.prepare(`UPDATE knowledge_index_versions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return findKnowledgeIndexVersionById(id)
}

