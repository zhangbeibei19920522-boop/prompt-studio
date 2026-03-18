import { NextResponse } from 'next/server'

import { parseConversationHistoryWorkbook } from '@/lib/audit/history-parser'
import { buildKnowledgeChunks } from '@/lib/audit/knowledge-chunker'
import { findAuditConversationsByJob, replaceAuditConversations } from '@/lib/db/repositories/conversation-audit-conversations'
import { replaceKnowledgeChunks } from '@/lib/db/repositories/conversation-audit-knowledge-chunks'
import {
  createConversationAuditJob,
  findConversationAuditJobsByProject,
  findConversationAuditJobById,
} from '@/lib/db/repositories/conversation-audit-jobs'
import { findAuditTurnsByJob, replaceAuditTurns } from '@/lib/db/repositories/conversation-audit-turns'
import { parseDocumentBuffer } from '@/lib/utils/parse-document'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const jobs = findConversationAuditJobsByProject(id)

    return NextResponse.json({ success: true, data: jobs, error: null })
  } catch (error) {
    console.error('[GET /api/projects/[id]/conversation-audit-jobs]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch conversation audit jobs' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const formData = await request.formData()
    const name = String(formData.get('name') ?? '').trim()
    const historyFile = formData.get('historyFile')
    const knowledgeFiles = formData.getAll('knowledgeFiles').filter((file): file is File => file instanceof File)

    if (!name) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "name" is required' },
        { status: 400 }
      )
    }

    if (!(historyFile instanceof File)) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "historyFile" is required' },
        { status: 400 }
      )
    }

    const parsedKnowledgeChunks = []
    for (const file of knowledgeFiles) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const ext = file.name.split('.').pop() ?? 'txt'
      const content = await parseDocumentBuffer(buffer, ext)
      const chunks = buildKnowledgeChunks({
        sourceName: file.name,
        sourceType: ext,
        content,
      })

      parsedKnowledgeChunks.push(...chunks)
    }

    const historyBuffer = Buffer.from(await historyFile.arrayBuffer())
    const history = parseConversationHistoryWorkbook(historyBuffer)
    const job = createConversationAuditJob({
      projectId,
      name,
      parseSummary: {
        knowledgeFileCount: knowledgeFiles.length,
        conversationCount: history.summary.conversationCount,
        turnCount: history.summary.turnCount,
        invalidRowCount: history.summary.invalidRows,
      },
    })

    replaceKnowledgeChunks(
      job.id,
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

    replaceAuditConversations(job.id, history.conversations)

    const storedConversations = findAuditConversationsByJob(job.id)
    const conversationIdMap = new Map(
      storedConversations.map((conversation) => [conversation.externalConversationId, conversation.id])
    )

    replaceAuditTurns(
      job.id,
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

    const storedJob = findConversationAuditJobById(job.id)!
    const storedTurns = findAuditTurnsByJob(job.id)

    return NextResponse.json(
      {
        success: true,
        data: {
          job: storedJob,
          parseSummary: storedJob.parseSummary,
          conversations: storedConversations,
          turns: storedTurns,
        },
        error: null,
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create conversation audit job'
    console.error('[POST /api/projects/[id]/conversation-audit-jobs]', error)
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 }
    )
  }
}
