import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type {
  ConversationAuditJob,
  ConversationAuditJobStatus,
  ConversationAuditParseSummary,
} from '@/types/database'

interface ConversationAuditJobRow {
  id: string
  project_id: string
  name: string
  status: ConversationAuditJobStatus
  parse_summary: string
  issue_count: number
  total_turns: number
  error_message: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

function mapRowToConversationAuditJob(row: ConversationAuditJobRow): ConversationAuditJob {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    status: row.status,
    parseSummary: JSON.parse(row.parse_summary) as ConversationAuditParseSummary,
    issueCount: row.issue_count,
    totalTurns: row.total_turns,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  }
}

export function findConversationAuditJobsByProject(projectId: string): ConversationAuditJob[] {
  const db = getDb()
  const rows = db
    .prepare(`
      SELECT * FROM conversation_audit_jobs
      WHERE project_id = ?
      ORDER BY created_at DESC, rowid DESC
    `)
    .all(projectId) as ConversationAuditJobRow[]

  return rows.map(mapRowToConversationAuditJob)
}

export function findConversationAuditJobById(id: string): ConversationAuditJob | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM conversation_audit_jobs WHERE id = ?')
    .get(id) as ConversationAuditJobRow | undefined

  return row ? mapRowToConversationAuditJob(row) : null
}

export function createConversationAuditJob(data: {
  projectId: string
  name: string
  status?: ConversationAuditJobStatus
  parseSummary?: ConversationAuditParseSummary
}): ConversationAuditJob {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()
  const status = data.status ?? 'draft'
  const parseSummary = data.parseSummary ?? {
    knowledgeFileCount: 0,
    conversationCount: 0,
    turnCount: 0,
    invalidRowCount: 0,
  }

  db.prepare(`
    INSERT INTO conversation_audit_jobs (
      id,
      project_id,
      name,
      status,
      parse_summary,
      issue_count,
      total_turns,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.name,
    status,
    JSON.stringify(parseSummary),
    0,
    0,
    now,
    now
  )

  return findConversationAuditJobById(id)!
}

export function updateConversationAuditJob(
  id: string,
  data: {
    name?: string
    status?: ConversationAuditJobStatus
    parseSummary?: ConversationAuditParseSummary
    issueCount?: number
    totalTurns?: number
    errorMessage?: string | null
    completedAt?: string | null
  }
): ConversationAuditJob | null {
  const db = getDb()
  const existing = findConversationAuditJobById(id)
  if (!existing) return null

  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [new Date().toISOString()]

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)

    if ((data.status === 'completed' || data.status === 'failed') && data.completedAt === undefined) {
      fields.push('completed_at = ?')
      values.push(new Date().toISOString())
    }
    if ((data.status === 'parsing' || data.status === 'draft' || data.status === 'running') && data.completedAt === undefined) {
      fields.push('completed_at = ?')
      values.push(null)
    }
  }
  if (data.parseSummary !== undefined) {
    fields.push('parse_summary = ?')
    values.push(JSON.stringify(data.parseSummary))
  }
  if (data.issueCount !== undefined) {
    fields.push('issue_count = ?')
    values.push(data.issueCount)
  }
  if (data.totalTurns !== undefined) {
    fields.push('total_turns = ?')
    values.push(data.totalTurns)
  }
  if (data.errorMessage !== undefined) {
    fields.push('error_message = ?')
    values.push(data.errorMessage)
  }
  if (data.completedAt !== undefined) {
    fields.push('completed_at = ?')
    values.push(data.completedAt)
  }

  values.push(id)
  db.prepare(`UPDATE conversation_audit_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findConversationAuditJobById(id)
}

export function deleteConversationAuditJob(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM conversation_audit_jobs WHERE id = ?').run(id)
  return result.changes > 0
}
