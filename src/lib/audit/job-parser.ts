import { parseConversationHistoryWorkbook } from '@/lib/audit/history-parser'
import { buildKnowledgeChunks } from '@/lib/audit/knowledge-chunker'
import { clearConversationAuditUploads, readConversationAuditUploads } from '@/lib/audit/job-upload-storage'
import { findAuditConversationsByJob, replaceAuditConversations } from '@/lib/db/repositories/conversation-audit-conversations'
import { replaceKnowledgeChunks } from '@/lib/db/repositories/conversation-audit-knowledge-chunks'
import { updateConversationAuditJob } from '@/lib/db/repositories/conversation-audit-jobs'
import { replaceAuditTurns } from '@/lib/db/repositories/conversation-audit-turns'
import { parseDocumentBuffer } from '@/lib/utils/parse-document'

export async function parseConversationAuditJob(jobId: string): Promise<void> {
  try {
    console.log('[ConversationAudit] Job parsing started', { jobId })
    const uploads = await readConversationAuditUploads(jobId)
    const parsedKnowledgeChunks = []

    console.log('[ConversationAudit] Job parsing loaded uploads', {
      jobId,
      historyFileName: uploads.historyFile.name,
      historyFileSize: uploads.historyFile.buffer.length,
      knowledgeFileCount: uploads.knowledgeFiles.length,
      knowledgeFiles: uploads.knowledgeFiles.map((file) => ({
        name: file.name,
        size: file.buffer.length,
      })),
    })

    for (const file of uploads.knowledgeFiles) {
      const ext = file.name.split('.').pop() ?? 'txt'
      console.log('[ConversationAudit] Parsing knowledge file', {
        jobId,
        fileName: file.name,
        ext,
        size: file.buffer.length,
      })
      const content = await parseDocumentBuffer(file.buffer, ext)
      const chunks = buildKnowledgeChunks({
        sourceName: file.name,
        sourceType: ext,
        content,
      })

      console.log('[ConversationAudit] Parsed knowledge file', {
        jobId,
        fileName: file.name,
        ext,
        contentLength: content.length,
        chunkCount: chunks.length,
      })

      parsedKnowledgeChunks.push(...chunks)
    }

    const history = parseConversationHistoryWorkbook(uploads.historyFile.buffer)

    console.log('[ConversationAudit] Parsed history workbook', {
      jobId,
      historyFileName: uploads.historyFile.name,
      totalRows: history.summary.totalRows,
      validRows: history.summary.validRows,
      invalidRows: history.summary.invalidRows,
      conversationCount: history.summary.conversationCount,
      turnCount: history.summary.turnCount,
      errors: history.summary.errors.slice(0, 10),
    })

    replaceKnowledgeChunks(
      jobId,
      parsedKnowledgeChunks.map((chunk) => ({
        sourceName: chunk.sourceName,
        sourceType: chunk.sourceType,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        metadata: {
          sheetName: chunk.sheetName,
        },
      }))
    )

    replaceAuditConversations(jobId, history.conversations)

    const storedConversations = findAuditConversationsByJob(jobId)
    const conversationIdMap = new Map(
      storedConversations.map((conversation) => [conversation.externalConversationId, conversation.id])
    )

    replaceAuditTurns(
      jobId,
      history.turns.map((turn) => ({
        conversationId: conversationIdMap.get(turn.externalConversationId)!,
        turnIndex: turn.turnIndex,
        userMessage: turn.userMessage,
        botReply: turn.botReply,
        hasIssue: null,
        knowledgeAnswer: null,
        retrievedSources: [],
      }))
    )

    updateConversationAuditJob(jobId, {
      status: 'draft',
      parseSummary: {
        knowledgeFileCount: uploads.knowledgeFiles.length,
        conversationCount: history.summary.conversationCount,
        turnCount: history.summary.turnCount,
        invalidRowCount: history.summary.invalidRows,
      },
      totalTurns: history.summary.turnCount,
      errorMessage: null,
      completedAt: null,
    })

    console.log('[ConversationAudit] Job parsing completed', {
      jobId,
      knowledgeFileCount: uploads.knowledgeFiles.length,
      knowledgeChunkCount: parsedKnowledgeChunks.length,
      conversationCount: history.summary.conversationCount,
      turnCount: history.summary.turnCount,
      invalidRowCount: history.summary.invalidRows,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse conversation audit job'

    console.error('[ConversationAudit] Job parsing failed', {
      jobId,
      error: message,
    })

    try {
      updateConversationAuditJob(jobId, {
        status: 'failed',
        errorMessage: message,
        completedAt: null,
      })
    } catch {
      // Ignore follow-up persistence failures in detached background work.
    }
  } finally {
    try {
      await clearConversationAuditUploads(jobId)
    } catch {
      console.error('[ConversationAudit] Failed to clear persisted uploads', { jobId })
    }
  }
}

export function scheduleConversationAuditJobParsing(jobId: string): void {
  console.log('[ConversationAudit] Scheduling job parsing', { jobId })
  setTimeout(() => {
    console.log('[ConversationAudit] Triggering scheduled job parsing', { jobId })
    void parseConversationAuditJob(jobId)
  }, 0)
}
