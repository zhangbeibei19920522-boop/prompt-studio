import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type { KnowledgeScopeMappingRecord, KnowledgeScopeMappingVersion } from '@/types/database'

interface KnowledgeScopeMappingVersionRow {
  id: string
  project_id: string
  name: string
  file_name: string
  file_hash: string
  row_count: number
  key_field: string
  scope_fields_json: string
  records_file_path: string
  records_json: string
  created_at: string
  updated_at: string
}

function mapRowToKnowledgeScopeMappingVersion(row: KnowledgeScopeMappingVersionRow): KnowledgeScopeMappingVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    fileName: row.file_name,
    fileHash: row.file_hash,
    rowCount: row.row_count,
    keyField: row.key_field,
    scopeFields: JSON.parse(row.scope_fields_json) as string[],
    recordsFilePath: row.records_file_path,
    records: JSON.parse(row.records_json) as KnowledgeScopeMappingRecord[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findKnowledgeScopeMappingVersionById(id: string): KnowledgeScopeMappingVersion | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM knowledge_scope_mapping_versions WHERE id = ?')
    .get(id) as KnowledgeScopeMappingVersionRow | undefined

  return row ? mapRowToKnowledgeScopeMappingVersion(row) : null
}

export function findKnowledgeScopeMappingVersionsByProject(projectId: string): KnowledgeScopeMappingVersion[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM knowledge_scope_mapping_versions WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as KnowledgeScopeMappingVersionRow[]

  return rows.map(mapRowToKnowledgeScopeMappingVersion)
}

export function createKnowledgeScopeMappingVersion(data: {
  id?: string
  projectId: string
  name: string
  fileName: string
  fileHash: string
  rowCount: number
  keyField: string
  scopeFields: string[]
  recordsFilePath: string
  records: KnowledgeScopeMappingRecord[]
}): KnowledgeScopeMappingVersion {
  const db = getDb()
  const id = data.id ?? nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO knowledge_scope_mapping_versions (
      id,
      project_id,
      name,
      file_name,
      file_hash,
      row_count,
      key_field,
      scope_fields_json,
      records_file_path,
      records_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.name,
    data.fileName,
    data.fileHash,
    data.rowCount,
    data.keyField,
    JSON.stringify(data.scopeFields),
    data.recordsFilePath,
    JSON.stringify(data.records),
    now,
    now,
  )

  return findKnowledgeScopeMappingVersionById(id)!
}
