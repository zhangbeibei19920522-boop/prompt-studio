import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { Message } from '@/types/database'

interface MessageRow {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  references_json: string
  metadata_json: string | null
  created_at: string
}

function mapRowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    references: JSON.parse(row.references_json),
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    createdAt: row.created_at,
  }
}

export function findMessagesBySession(sessionId: string): Message[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as MessageRow[]
  return rows.map(mapRowToMessage)
}

export function createMessage(data: Omit<Message, 'id' | 'createdAt'>): Message {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  const referencesJson = JSON.stringify(data.references)
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null

  db.prepare(`
    INSERT INTO messages (id, session_id, role, content, references_json, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.sessionId, data.role, data.content, referencesJson, metadataJson, now)

  return {
    id,
    sessionId: data.sessionId,
    role: data.role,
    content: data.content,
    references: data.references,
    metadata: data.metadata,
    createdAt: now,
  }
}
