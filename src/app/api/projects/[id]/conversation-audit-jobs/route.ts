import { NextResponse } from 'next/server'

import { persistConversationAuditUploads } from '@/lib/audit/job-upload-storage'
import { scheduleConversationAuditJobParsing } from '@/lib/audit/job-parser'
import {
  createConversationAuditJob,
  findConversationAuditJobsByProject,
} from '@/lib/db/repositories/conversation-audit-jobs'

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

    console.log('[ConversationAudit] Creating job request', {
      projectId,
      name,
      historyFileName: historyFile.name,
      historyFileSize: historyFile.size,
      knowledgeFileCount: knowledgeFiles.length,
      knowledgeFiles: knowledgeFiles.map((file) => ({
        name: file.name,
        size: file.size,
      })),
    })

    const job = createConversationAuditJob({
      projectId,
      name,
      status: 'parsing',
      parseSummary: {
        knowledgeFileCount: 0,
        conversationCount: 0,
        turnCount: 0,
        invalidRowCount: 0,
      },
    })

    await persistConversationAuditUploads(job.id, {
      historyFile,
      knowledgeFiles,
    })
    console.log('[ConversationAudit] Job uploads persisted', {
      jobId: job.id,
      projectId,
      historyFileName: historyFile.name,
      knowledgeFileCount: knowledgeFiles.length,
    })
    scheduleConversationAuditJobParsing(job.id)
    console.log('[ConversationAudit] Job parsing scheduled', {
      jobId: job.id,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          job,
          parseSummary: job.parseSummary,
          conversations: [],
          turns: [],
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
