import { getDb } from '@/lib/db'
import type { SessionExtractionProgress } from '@/types/database'

interface ExtractionProgressRow {
  session_id: string
  last_extracted_message_index: number
  updated_at: string
}

function mapRow(row: ExtractionProgressRow): SessionExtractionProgress {
  return {
    sessionId: row.session_id,
    lastExtractedMessageIndex: row.last_extracted_message_index,
    updatedAt: row.updated_at,
  }
}

export function getExtractionProgress(sessionId: string): SessionExtractionProgress | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM session_extraction_progress WHERE session_id = ?')
    .get(sessionId) as ExtractionProgressRow | undefined
  return row ? mapRow(row) : null
}

export function upsertExtractionProgress(sessionId: string, lastIndex: number): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO session_extraction_progress (session_id, last_extracted_message_index, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      last_extracted_message_index = excluded.last_extracted_message_index,
      updated_at = excluded.updated_at
  `).run(sessionId, lastIndex, now)
}
