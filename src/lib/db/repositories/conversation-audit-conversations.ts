import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type { ConversationAuditConversation, ConversationAuditProcessStep } from '@/types/database'

interface ConversationAuditConversationRow {
  id: string
  job_id: string
  external_conversation_id: string
  turn_count: number
  overall_status: ConversationAuditConversation['overallStatus']
  process_status: ConversationAuditConversation['processStatus']
  knowledge_status: ConversationAuditConversation['knowledgeStatus']
  risk_level: ConversationAuditConversation['riskLevel']
  summary: string
  process_steps_json: string
  created_at: string
}

function mapRowToConversation(row: ConversationAuditConversationRow): ConversationAuditConversation {
  return {
    id: row.id,
    jobId: row.job_id,
    externalConversationId: row.external_conversation_id,
    turnCount: row.turn_count,
    overallStatus: row.overall_status,
    processStatus: row.process_status,
    knowledgeStatus: row.knowledge_status,
    riskLevel: row.risk_level,
    summary: row.summary,
    processSteps: JSON.parse(row.process_steps_json) as ConversationAuditProcessStep[],
    createdAt: row.created_at,
  }
}

export function replaceAuditConversations(
  jobId: string,
  conversations: Array<
    Pick<ConversationAuditConversation, 'externalConversationId' | 'turnCount'>
    & Partial<
      Pick<
        ConversationAuditConversation,
        'overallStatus' | 'processStatus' | 'knowledgeStatus' | 'riskLevel' | 'summary' | 'processSteps'
      >
    >
  >
): void {
  const db = getDb()
  const now = new Date().toISOString()

  const insertConversation = db.prepare(`
    INSERT INTO conversation_audit_conversations (
      id,
      job_id,
      external_conversation_id,
      turn_count,
      overall_status,
      process_status,
      knowledge_status,
      risk_level,
      summary,
      process_steps_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM conversation_audit_conversations WHERE job_id = ?').run(jobId)

    for (const conversation of conversations) {
      insertConversation.run(
        nanoid(),
        jobId,
        conversation.externalConversationId,
        conversation.turnCount,
        conversation.overallStatus ?? 'unknown',
        conversation.processStatus ?? 'unknown',
        conversation.knowledgeStatus ?? 'unknown',
        conversation.riskLevel ?? 'low',
        conversation.summary ?? '',
        JSON.stringify(conversation.processSteps ?? []),
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

export function updateAuditConversationResult(
  id: string,
  result: Pick<
    ConversationAuditConversation,
    'overallStatus' | 'processStatus' | 'knowledgeStatus' | 'riskLevel' | 'summary' | 'processSteps'
  >
): ConversationAuditConversation | null {
  const db = getDb()

  db.prepare(`
    UPDATE conversation_audit_conversations
    SET overall_status = ?, process_status = ?, knowledge_status = ?, risk_level = ?, summary = ?, process_steps_json = ?
    WHERE id = ?
  `).run(
    result.overallStatus,
    result.processStatus,
    result.knowledgeStatus,
    result.riskLevel,
    result.summary,
    JSON.stringify(result.processSteps),
    id
  )

  const row = db
    .prepare('SELECT * FROM conversation_audit_conversations WHERE id = ?')
    .get(id) as ConversationAuditConversationRow | undefined

  return row ? mapRowToConversation(row) : null
}
