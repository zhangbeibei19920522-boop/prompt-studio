import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type {
  ConversationAuditRetrievedSource,
  ConversationAuditTurn,
} from '@/types/database'

interface ConversationAuditTurnRow {
  id: string
  job_id: string
  conversation_id: string
  turn_index: number
  user_message: string
  bot_reply: string
  has_issue: number | null
  knowledge_answer: string | null
  retrieved_sources_json: string
  created_at: string
  updated_at: string
}

function mapRowToAuditTurn(row: ConversationAuditTurnRow): ConversationAuditTurn {
  return {
    id: row.id,
    jobId: row.job_id,
    conversationId: row.conversation_id,
    turnIndex: row.turn_index,
    userMessage: row.user_message,
    botReply: row.bot_reply,
    hasIssue: row.has_issue === null ? null : Boolean(row.has_issue),
    knowledgeAnswer: row.knowledge_answer,
    retrievedSources: JSON.parse(row.retrieved_sources_json) as ConversationAuditRetrievedSource[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function replaceAuditTurns(
  jobId: string,
  turns: Array<Omit<ConversationAuditTurn, 'id' | 'jobId' | 'createdAt' | 'updatedAt'>>
): void {
  const db = getDb()
  const now = new Date().toISOString()

  const insertTurn = db.prepare(`
    INSERT INTO conversation_audit_turns (
      id,
      job_id,
      conversation_id,
      turn_index,
      user_message,
      bot_reply,
      has_issue,
      knowledge_answer,
      retrieved_sources_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM conversation_audit_turns WHERE job_id = ?').run(jobId)

    for (const turn of turns) {
      insertTurn.run(
        nanoid(),
        jobId,
        turn.conversationId,
        turn.turnIndex,
        turn.userMessage,
        turn.botReply,
        turn.hasIssue === null ? null : Number(turn.hasIssue),
        turn.knowledgeAnswer,
        JSON.stringify(turn.retrievedSources),
        now,
        now
      )
    }
  })

  replace()
}

export function findAuditTurnsByJob(
  jobId: string,
  options?: { hasIssue?: boolean | null }
): ConversationAuditTurn[] {
  const db = getDb()

  const whereClauses = ['job_id = ?']
  const values: unknown[] = [jobId]

  if (options && 'hasIssue' in options) {
    if (options.hasIssue === null) {
      whereClauses.push('has_issue IS NULL')
    } else {
      whereClauses.push('has_issue = ?')
      values.push(Number(options.hasIssue))
    }
  }

  const rows = db
    .prepare(`
      SELECT * FROM conversation_audit_turns
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY conversation_id ASC, turn_index ASC
    `)
    .all(...values) as ConversationAuditTurnRow[]

  return rows.map(mapRowToAuditTurn)
}

export function updateAuditTurnResult(
  id: string,
  result: Pick<ConversationAuditTurn, 'hasIssue' | 'knowledgeAnswer' | 'retrievedSources'>
): ConversationAuditTurn | null {
  const db = getDb()
  const now = new Date().toISOString()

  const update = db.prepare(`
    UPDATE conversation_audit_turns
    SET has_issue = ?, knowledge_answer = ?, retrieved_sources_json = ?, updated_at = ?
    WHERE id = ?
  `)

  update.run(
    result.hasIssue === null ? null : Number(result.hasIssue),
    result.knowledgeAnswer,
    JSON.stringify(result.retrievedSources),
    now,
    id
  )

  const row = db
    .prepare('SELECT * FROM conversation_audit_turns WHERE id = ?')
    .get(id) as ConversationAuditTurnRow | undefined

  return row ? mapRowToAuditTurn(row) : null
}
