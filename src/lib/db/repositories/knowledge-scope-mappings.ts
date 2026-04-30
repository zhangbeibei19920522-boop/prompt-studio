import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type { KnowledgeScopeMapping, KnowledgeScopeMappingRecord } from '@/types/database'

interface KnowledgeScopeMappingRow {
  id: string
  project_id: string
  name: string
  source_file_name: string
  source_file_hash: string
  key_field: string
  scope_fields_json: string
  row_count: number
  diagnostics_json: string
  created_at: string
  updated_at: string
}

interface KnowledgeScopeMappingRecordRow {
  id: string
  mapping_id: string
  lookup_key: string
  scope_json: string
  raw_json: string
  created_at: string
  updated_at: string
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function mapRowToKnowledgeScopeMapping(row: KnowledgeScopeMappingRow): KnowledgeScopeMapping {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    sourceFileName: row.source_file_name,
    sourceFileHash: row.source_file_hash,
    keyField: row.key_field,
    scopeFields: parseJson<string[]>(row.scope_fields_json, []),
    rowCount: row.row_count,
    diagnostics: parseJson<Array<Record<string, unknown>>>(row.diagnostics_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRowToKnowledgeScopeMappingRecord(row: KnowledgeScopeMappingRecordRow): KnowledgeScopeMappingRecord {
  return {
    id: row.id,
    mappingId: row.mapping_id,
    lookupKey: row.lookup_key,
    scope: parseJson<Record<string, string[]>>(row.scope_json, {}),
    raw: parseJson<Record<string, unknown>>(row.raw_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findKnowledgeScopeMappingById(id: string): KnowledgeScopeMapping | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM knowledge_scope_mappings WHERE id = ?')
    .get(id) as KnowledgeScopeMappingRow | undefined

  return row ? mapRowToKnowledgeScopeMapping(row) : null
}

export function findKnowledgeScopeMappingsByProject(projectId: string): KnowledgeScopeMapping[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM knowledge_scope_mappings WHERE project_id = ? ORDER BY updated_at DESC, created_at DESC')
    .all(projectId) as KnowledgeScopeMappingRow[]

  return rows.map(mapRowToKnowledgeScopeMapping)
}

export function createKnowledgeScopeMapping(data: {
  id?: string
  projectId: string
  name: string
  sourceFileName: string
  sourceFileHash: string
  keyField: string
  scopeFields: string[]
  rowCount: number
  diagnostics?: Array<Record<string, unknown>>
}): KnowledgeScopeMapping {
  const db = getDb()
  const id = data.id ?? nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO knowledge_scope_mappings (
      id,
      project_id,
      name,
      source_file_name,
      source_file_hash,
      key_field,
      scope_fields_json,
      row_count,
      diagnostics_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.name,
    data.sourceFileName,
    data.sourceFileHash,
    data.keyField,
    JSON.stringify(data.scopeFields),
    data.rowCount,
    JSON.stringify(data.diagnostics ?? []),
    now,
    now,
  )

  return findKnowledgeScopeMappingById(id)!
}

export function updateKnowledgeScopeMapping(
  id: string,
  data: {
    name?: string
    keyField?: string
    scopeFields?: string[]
    rowCount?: number
    diagnostics?: Array<Record<string, unknown>>
  },
): KnowledgeScopeMapping | null {
  const existing = findKnowledgeScopeMappingById(id)
  if (!existing) return null

  const db = getDb()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [new Date().toISOString()]

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.keyField !== undefined) {
    fields.push('key_field = ?')
    values.push(data.keyField)
  }
  if (data.scopeFields !== undefined) {
    fields.push('scope_fields_json = ?')
    values.push(JSON.stringify(data.scopeFields))
  }
  if (data.rowCount !== undefined) {
    fields.push('row_count = ?')
    values.push(data.rowCount)
  }
  if (data.diagnostics !== undefined) {
    fields.push('diagnostics_json = ?')
    values.push(JSON.stringify(data.diagnostics))
  }

  values.push(id)
  db.prepare(`UPDATE knowledge_scope_mappings SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findKnowledgeScopeMappingById(id)
}

export function deleteKnowledgeScopeMapping(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM knowledge_scope_mappings WHERE id = ?').run(id)
  return result.changes > 0
}

export function findKnowledgeScopeMappingRecordById(id: string): KnowledgeScopeMappingRecord | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM knowledge_scope_mapping_records WHERE id = ?')
    .get(id) as KnowledgeScopeMappingRecordRow | undefined

  return row ? mapRowToKnowledgeScopeMappingRecord(row) : null
}

export function findKnowledgeScopeMappingRecords(mappingId: string): KnowledgeScopeMappingRecord[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM knowledge_scope_mapping_records WHERE mapping_id = ? ORDER BY created_at ASC, id ASC')
    .all(mappingId) as KnowledgeScopeMappingRecordRow[]

  return rows.map(mapRowToKnowledgeScopeMappingRecord)
}

export function createKnowledgeScopeMappingRecord(data: {
  id?: string
  mappingId: string
  lookupKey: string
  scope: Record<string, string[]>
  raw?: Record<string, unknown>
}): KnowledgeScopeMappingRecord {
  const db = getDb()
  const id = data.id ?? nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO knowledge_scope_mapping_records (
      id,
      mapping_id,
      lookup_key,
      scope_json,
      raw_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.mappingId,
    data.lookupKey,
    JSON.stringify(data.scope),
    JSON.stringify(data.raw ?? {}),
    now,
    now,
  )

  return findKnowledgeScopeMappingRecordById(id)!
}

export function updateKnowledgeScopeMappingRecord(
  id: string,
  data: {
    lookupKey?: string
    scope?: Record<string, string[]>
    raw?: Record<string, unknown>
  },
): KnowledgeScopeMappingRecord | null {
  const existing = findKnowledgeScopeMappingRecordById(id)
  if (!existing) return null

  const db = getDb()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [new Date().toISOString()]

  if (data.lookupKey !== undefined) {
    fields.push('lookup_key = ?')
    values.push(data.lookupKey)
  }
  if (data.scope !== undefined) {
    fields.push('scope_json = ?')
    values.push(JSON.stringify(data.scope))
  }
  if (data.raw !== undefined) {
    fields.push('raw_json = ?')
    values.push(JSON.stringify(data.raw))
  }

  values.push(id)
  db.prepare(`UPDATE knowledge_scope_mapping_records SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findKnowledgeScopeMappingRecordById(id)
}

export function deleteKnowledgeScopeMappingRecord(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM knowledge_scope_mapping_records WHERE id = ?').run(id)
  return result.changes > 0
}

export function refreshKnowledgeScopeMappingSummary(mappingId: string): KnowledgeScopeMapping | null {
  const mapping = findKnowledgeScopeMappingById(mappingId)
  if (!mapping) return null

  const records = findKnowledgeScopeMappingRecords(mappingId)
  const scopeFields = [
    ...records.reduce((fields, record) => {
      for (const field of Object.keys(record.scope)) {
        fields.add(field)
      }
      return fields
    }, new Set<string>()),
  ]
  const keyField = scopeFields.includes('productModel') ? 'productModel' : scopeFields[0] ?? mapping.keyField

  return updateKnowledgeScopeMapping(mappingId, {
    keyField,
    scopeFields,
    rowCount: records.length,
  })
}
