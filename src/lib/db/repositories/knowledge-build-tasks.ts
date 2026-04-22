import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type { KnowledgeBuildTask, KnowledgeStageSummary, KnowledgeTaskInput, KnowledgeTaskType } from '@/types/database'

interface KnowledgeBuildTaskRow {
  id: string
  project_id: string
  knowledge_base_id: string
  knowledge_version_id: string | null
  knowledge_index_version_id: string | null
  name: string
  task_type: KnowledgeTaskType
  status: KnowledgeBuildTask['status']
  current_step: string
  progress: number
  base_version_id: string | null
  input_json: string
  stage_summary_json: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

const EMPTY_TASK_INPUT: KnowledgeTaskInput = {
  documentIds: [],
  manualDrafts: [],
  repairQuestions: [],
}

function mapRowToKnowledgeBuildTask(row: KnowledgeBuildTaskRow): KnowledgeBuildTask {
  return {
    id: row.id,
    projectId: row.project_id,
    knowledgeBaseId: row.knowledge_base_id,
    knowledgeVersionId: row.knowledge_version_id,
    knowledgeIndexVersionId: row.knowledge_index_version_id,
    name: row.name,
    taskType: row.task_type,
    status: row.status,
    currentStep: row.current_step,
    progress: row.progress,
    baseVersionId: row.base_version_id,
    input: row.input_json ? (JSON.parse(row.input_json) as KnowledgeTaskInput) : EMPTY_TASK_INPUT,
    stageSummary: row.stage_summary_json ? (JSON.parse(row.stage_summary_json) as KnowledgeStageSummary) : null,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

export function findKnowledgeBuildTaskById(id: string): KnowledgeBuildTask | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM knowledge_build_tasks WHERE id = ?').get(id) as KnowledgeBuildTaskRow | undefined
  return row ? mapRowToKnowledgeBuildTask(row) : null
}

export function findKnowledgeBuildTasksByProject(projectId: string): KnowledgeBuildTask[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM knowledge_build_tasks WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as KnowledgeBuildTaskRow[]
  return rows.map(mapRowToKnowledgeBuildTask)
}

export function createKnowledgeBuildTask(data: {
  projectId: string
  knowledgeBaseId: string
  name: string
  taskType: KnowledgeTaskType
  baseVersionId: string | null
  input: KnowledgeTaskInput
}): KnowledgeBuildTask {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO knowledge_build_tasks (
      id,
      project_id,
      knowledge_base_id,
      name,
      task_type,
      status,
      current_step,
      progress,
      base_version_id,
      input_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.knowledgeBaseId,
    data.name,
    data.taskType,
    'pending',
    'queued',
    0,
    data.baseVersionId,
    JSON.stringify(data.input),
    now,
    now,
  )

  return findKnowledgeBuildTaskById(id)!
}

export function updateKnowledgeBuildTask(
  id: string,
  data: {
    status?: KnowledgeBuildTask['status']
    currentStep?: string
    progress?: number
    baseVersionId?: string | null
    knowledgeVersionId?: string | null
    knowledgeIndexVersionId?: string | null
    stageSummary?: KnowledgeStageSummary | null
    errorMessage?: string | null
    startedAt?: string | null
    completedAt?: string | null
  },
): KnowledgeBuildTask | null {
  const existing = findKnowledgeBuildTaskById(id)
  if (!existing) return null

  const db = getDb()
  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
  }
  if (data.currentStep !== undefined) {
    fields.push('current_step = ?')
    values.push(data.currentStep)
  }
  if (data.progress !== undefined) {
    fields.push('progress = ?')
    values.push(data.progress)
  }
  if (data.baseVersionId !== undefined) {
    fields.push('base_version_id = ?')
    values.push(data.baseVersionId)
  }
  if (data.knowledgeVersionId !== undefined) {
    fields.push('knowledge_version_id = ?')
    values.push(data.knowledgeVersionId)
  }
  if (data.knowledgeIndexVersionId !== undefined) {
    fields.push('knowledge_index_version_id = ?')
    values.push(data.knowledgeIndexVersionId)
  }
  if (data.stageSummary !== undefined) {
    fields.push('stage_summary_json = ?')
    values.push(data.stageSummary ? JSON.stringify(data.stageSummary) : null)
  }
  if (data.errorMessage !== undefined) {
    fields.push('error_message = ?')
    values.push(data.errorMessage)
  }
  if (data.startedAt !== undefined) {
    fields.push('started_at = ?')
    values.push(data.startedAt)
  }
  if (data.completedAt !== undefined) {
    fields.push('completed_at = ?')
    values.push(data.completedAt)
  }

  values.push(id)
  db.prepare(`UPDATE knowledge_build_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return findKnowledgeBuildTaskById(id)
}

