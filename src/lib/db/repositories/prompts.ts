import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { Prompt, PromptVersion } from '@/types/database'

interface PromptRow {
  id: string
  project_id: string
  title: string
  content: string
  description: string
  tags: string
  variables: string
  version: number
  status: 'draft' | 'active' | 'archived'
  created_at: string
  updated_at: string
}

function mapRowToPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    content: row.content,
    description: row.description,
    tags: JSON.parse(row.tags),
    variables: JSON.parse(row.variables),
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findPromptsByProject(projectId: string): Prompt[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM prompts WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as PromptRow[]
  return rows.map(mapRowToPrompt)
}

export function findPromptById(id: string): Prompt | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) as PromptRow | undefined
  return row ? mapRowToPrompt(row) : null
}

export function createPrompt(
  data: Omit<Prompt, 'id' | 'version' | 'createdAt' | 'updatedAt'>
): Prompt {
  const db = getDb()
  const id = nanoid()
  const versionId = nanoid()
  const now = new Date().toISOString()
  const initialVersion = 1

  const tagsJson = JSON.stringify(data.tags)
  const variablesJson = JSON.stringify(data.variables)

  db.prepare(`
    INSERT INTO prompts (id, project_id, title, content, description, tags, variables, version, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.title,
    data.content,
    data.description,
    tagsJson,
    variablesJson,
    initialVersion,
    data.status,
    now,
    now
  )

  db.prepare(`
    INSERT INTO prompt_versions (id, prompt_id, version, content, change_note, session_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(versionId, id, initialVersion, data.content, '初始版本', null, now)

  return {
    id,
    projectId: data.projectId,
    title: data.title,
    content: data.content,
    description: data.description,
    tags: data.tags,
    variables: data.variables,
    version: initialVersion,
    status: data.status,
    createdAt: now,
    updatedAt: now,
  }
}

export function updatePrompt(
  id: string,
  data: Partial<Omit<Prompt, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>,
  sessionId?: string
): Prompt | null {
  const db = getDb()
  const existing = findPromptById(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const contentChanged = data.content !== undefined && data.content !== existing.content

  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.title !== undefined) {
    fields.push('title = ?')
    values.push(data.title)
  }
  if (data.content !== undefined) {
    fields.push('content = ?')
    values.push(data.content)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
  }
  if (data.tags !== undefined) {
    fields.push('tags = ?')
    values.push(JSON.stringify(data.tags))
  }
  if (data.variables !== undefined) {
    fields.push('variables = ?')
    values.push(JSON.stringify(data.variables))
  }
  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
  }

  let newVersion = existing.version
  if (contentChanged) {
    newVersion = existing.version + 1
    fields.push('version = ?')
    values.push(newVersion)
  }

  values.push(id)
  db.prepare(`UPDATE prompts SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  if (contentChanged) {
    const versionId = nanoid()
    db.prepare(`
      INSERT INTO prompt_versions (id, prompt_id, version, content, change_note, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      id,
      newVersion,
      data.content,
      '更新内容',
      sessionId ?? null,
      now
    )
  }

  return findPromptById(id)
}

export function deletePrompt(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM prompts WHERE id = ?').run(id)
  return result.changes > 0
}
