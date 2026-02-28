import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { Session } from '@/types/database'

interface SessionRow {
  id: string
  project_id: string
  title: string
  created_at: string
  updated_at: string
}

function mapRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findSessionsByProject(projectId: string): Session[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC')
    .all(projectId) as SessionRow[]
  return rows.map(mapRowToSession)
}

export function findSessionById(id: string): Session | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined
  return row ? mapRowToSession(row) : null
}

export function createSession(data: { projectId: string; title?: string }): Session {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()
  const title = data.title ?? '新对话'

  db.prepare(`
    INSERT INTO sessions (id, project_id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.projectId, title, now, now)

  return {
    id,
    projectId: data.projectId,
    title,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateSession(
  id: string,
  data: { title?: string }
): Session | null {
  const db = getDb()
  const existing = findSessionById(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.title !== undefined) {
    fields.push('title = ?')
    values.push(data.title)
  }

  values.push(id)
  db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findSessionById(id)
}

export function deleteSession(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  return result.changes > 0
}
