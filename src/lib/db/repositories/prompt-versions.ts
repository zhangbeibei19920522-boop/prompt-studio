import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { PromptVersion } from '@/types/database'

interface PromptVersionRow {
  id: string
  prompt_id: string
  version: number
  content: string
  change_note: string
  session_id: string | null
  created_at: string
}

function mapRowToVersion(row: PromptVersionRow): PromptVersion {
  return {
    id: row.id,
    promptId: row.prompt_id,
    version: row.version,
    content: row.content,
    changeNote: row.change_note,
    sessionId: row.session_id,
    createdAt: row.created_at,
  }
}

export function findVersionsByPrompt(promptId: string): PromptVersion[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version DESC')
    .all(promptId) as PromptVersionRow[]
  return rows.map(mapRowToVersion)
}

export function createVersion(data: Omit<PromptVersion, 'id' | 'createdAt'>): PromptVersion {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO prompt_versions (id, prompt_id, version, content, change_note, session_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.promptId,
    data.version,
    data.content,
    data.changeNote,
    data.sessionId,
    now
  )

  return {
    id,
    promptId: data.promptId,
    version: data.version,
    content: data.content,
    changeNote: data.changeNote,
    sessionId: data.sessionId,
    createdAt: now,
  }
}
