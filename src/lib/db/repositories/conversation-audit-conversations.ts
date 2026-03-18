import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type { ConversationAuditConversation } from '@/types/database'

interface ConversationAuditConversationRow {
  id: string
  job_id: string
  external_conversation_id: string
  turn_count: number
  created_at: string
}

function mapRowToConversation(row: ConversationAuditConversationRow): ConversationAuditConversation {
  return {
    id: row.id,
    jobId: row.job_id,
    externalConversationId: row.external_conversation_id,
    turnCount: row.turn_count,
    createdAt: row.created_at,
  }
}

export function replaceAuditConversations(
  jobId: string,
  conversations: Array<Omit<ConversationAuditConversation, 'id' | 'jobId' | 'createdAt'>>
): void {
  const db = getDb()
  const now = new Date().toISOString()

  const insertConversation = db.prepare(`
    INSERT INTO conversation_audit_conversations (
      id,
      job_id,
      external_conversation_id,
      turn_count,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `)

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM conversation_audit_conversations WHERE job_id = ?').run(jobId)

    for (const conversation of conversations) {
      insertConversation.run(
        nanoid(),
        jobId,
        conversation.externalConversationId,
        conversation.turnCount,
        now
      )
    }
  })

  replace()
}

export function findAuditConversationsByJob(jobId: string): ConversationAuditConversation[] {
  const db = getDb()
  const rows = db
    .prepare(`
      SELECT * FROM conversation_audit_conversations
      WHERE job_id = ?
      ORDER BY created_at ASC, external_conversation_id ASC
    `)
    .all(jobId) as ConversationAuditConversationRow[]

  return rows.map(mapRowToConversation)
}
