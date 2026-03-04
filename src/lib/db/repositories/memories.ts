import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { Memory } from '@/types/database'

interface MemoryRow {
  id: string
  scope: 'global' | 'project'
  project_id: string | null
  category: 'preference' | 'fact'
  content: string
  source: 'auto' | 'manual'
  source_session_id: string | null
  created_at: string
  updated_at: string
}

function mapRowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    scope: row.scope,
    projectId: row.project_id,
    category: row.category,
    content: row.content,
    source: row.source,
    sourceSessionId: row.source_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findGlobalMemories(): Memory[] {
  const db = getDb()
  const rows = db
    .prepare("SELECT * FROM memories WHERE scope = 'global' ORDER BY updated_at DESC")
    .all() as MemoryRow[]
  return rows.map(mapRowToMemory)
}

export function findProjectMemories(projectId: string): Memory[] {
  const db = getDb()
  const rows = db
    .prepare("SELECT * FROM memories WHERE scope = 'project' AND project_id = ? ORDER BY updated_at DESC")
    .all(projectId) as MemoryRow[]
  return rows.map(mapRowToMemory)
}

export function findMemoryById(id: string): Memory | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined
  return row ? mapRowToMemory(row) : null
}

export function countMemoriesByScope(scope: 'global' | 'project', projectId?: string): number {
  const db = getDb()
  if (scope === 'global') {
    const result = db.prepare("SELECT COUNT(*) as count FROM memories WHERE scope = 'global'").get() as { count: number }
    return result.count
  }
  const result = db
    .prepare("SELECT COUNT(*) as count FROM memories WHERE scope = 'project' AND project_id = ?")
    .get(projectId) as { count: number }
  return result.count
}

export function createMemory(data: {
  scope: 'global' | 'project'
  projectId?: string | null
  category: 'preference' | 'fact'
  content: string
  source?: 'auto' | 'manual'
  sourceSessionId?: string | null
}): Memory {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO memories (id, scope, project_id, category, content, source, source_session_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.scope,
    data.projectId ?? null,
    data.category,
    data.content,
    data.source ?? 'manual',
    data.sourceSessionId ?? null,
    now,
    now
  )

  return {
    id,
    scope: data.scope,
    projectId: data.projectId ?? null,
    category: data.category,
    content: data.content,
    source: data.source ?? 'manual',
    sourceSessionId: data.sourceSessionId ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateMemory(id: string, data: Partial<Pick<Memory, 'content' | 'category'>>): Memory | null {
  const db = getDb()
  const existing = findMemoryById(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.content !== undefined) {
    fields.push('content = ?')
    values.push(data.content)
  }
  if (data.category !== undefined) {
    fields.push('category = ?')
    values.push(data.category)
  }

  values.push(id)
  db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findMemoryById(id)
}

export function deleteMemory(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id)
  return result.changes > 0
}

export function promoteToGlobal(memoryId: string): Memory | null {
  const db = getDb()
  const existing = findMemoryById(memoryId)
  if (!existing || existing.scope === 'global') return existing

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE memories SET scope = 'global', project_id = NULL, updated_at = ? WHERE id = ?
  `).run(now, memoryId)

  return findMemoryById(memoryId)
}
