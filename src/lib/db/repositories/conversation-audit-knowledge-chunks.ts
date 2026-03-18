import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type { ConversationAuditKnowledgeChunk } from '@/types/database'

interface ConversationAuditKnowledgeChunkRow {
  id: string
  job_id: string
  source_name: string
  source_type: string
  chunk_index: number
  content: string
  metadata_json: string
  created_at: string
}

function mapRowToKnowledgeChunk(
  row: ConversationAuditKnowledgeChunkRow
): ConversationAuditKnowledgeChunk {
  return {
    id: row.id,
    jobId: row.job_id,
    sourceName: row.source_name,
    sourceType: row.source_type,
    chunkIndex: row.chunk_index,
    content: row.content,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    createdAt: row.created_at,
  }
}

export function replaceKnowledgeChunks(
  jobId: string,
  chunks: Array<
    Omit<ConversationAuditKnowledgeChunk, 'id' | 'jobId' | 'createdAt'>
  >
): void {
  const db = getDb()
  const now = new Date().toISOString()

  const insertChunk = db.prepare(`
    INSERT INTO conversation_audit_knowledge_chunks (
      id,
      job_id,
      source_name,
      source_type,
      chunk_index,
      content,
      metadata_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM conversation_audit_knowledge_chunks WHERE job_id = ?').run(jobId)

    for (const chunk of chunks) {
      insertChunk.run(
        nanoid(),
        jobId,
        chunk.sourceName,
        chunk.sourceType,
        chunk.chunkIndex,
        chunk.content,
        JSON.stringify(chunk.metadata),
        now
      )
    }
  })

  replace()
}

export function findKnowledgeChunksByJob(jobId: string): ConversationAuditKnowledgeChunk[] {
  const db = getDb()
  const rows = db
    .prepare(`
      SELECT * FROM conversation_audit_knowledge_chunks
      WHERE job_id = ?
      ORDER BY chunk_index ASC, created_at ASC
    `)
    .all(jobId) as ConversationAuditKnowledgeChunkRow[]

  return rows.map(mapRowToKnowledgeChunk)
}
