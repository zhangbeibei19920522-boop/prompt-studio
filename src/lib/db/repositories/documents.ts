import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { Document } from '@/types/database'

interface DocumentRow {
  id: string
  project_id: string
  name: string
  type: string
  content: string
  created_at: string
}

function mapRowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    type: row.type,
    content: row.content,
    createdAt: row.created_at,
  }
}

export function findDocumentsByProject(projectId: string): Document[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as DocumentRow[]
  return rows.map(mapRowToDocument)
}

export function findDocumentById(id: string): Document | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow | undefined
  return row ? mapRowToDocument(row) : null
}

export function createDocument(data: Omit<Document, 'id' | 'createdAt'>): Document {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO documents (id, project_id, name, type, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.projectId, data.name, data.type, data.content, now)

  return {
    id,
    projectId: data.projectId,
    name: data.name,
    type: data.type,
    content: data.content,
    createdAt: now,
  }
}

export function deleteDocument(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id)
  return result.changes > 0
}
