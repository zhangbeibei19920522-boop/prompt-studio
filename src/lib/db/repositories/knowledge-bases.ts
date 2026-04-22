import { nanoid } from 'nanoid'

import { getDb } from '@/lib/db'
import type { KnowledgeBase, KnowledgeProfileConfig } from '@/types/database'

interface KnowledgeBaseRow {
  id: string
  project_id: string
  name: string
  profile_key: string
  profile_config_json: string
  repair_config_json: string
  current_draft_version_id: string | null
  current_stg_version_id: string | null
  current_prod_version_id: string | null
  current_stg_index_version_id: string | null
  current_prod_index_version_id: string | null
  created_at: string
  updated_at: string
}

export function defaultKnowledgeProfileConfig(): KnowledgeProfileConfig {
  return {
    sourceAdapters: {},
    cleaningRules: {},
    riskRules: {},
    promotionRules: {},
    mergeRules: {},
    conflictRules: {},
    metadataSchema: [],
    entityDictionary: {},
  }
}

function mapRowToKnowledgeBase(row: KnowledgeBaseRow): KnowledgeBase {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    profileKey: row.profile_key,
    profileConfig: row.profile_config_json
      ? {
          ...defaultKnowledgeProfileConfig(),
          ...(JSON.parse(row.profile_config_json) as Partial<KnowledgeProfileConfig>),
        }
      : defaultKnowledgeProfileConfig(),
    repairConfig: row.repair_config_json ? (JSON.parse(row.repair_config_json) as Record<string, unknown>) : {},
    currentDraftVersionId: row.current_draft_version_id,
    currentStgVersionId: row.current_stg_version_id,
    currentProdVersionId: row.current_prod_version_id,
    currentStgIndexVersionId: row.current_stg_index_version_id,
    currentProdIndexVersionId: row.current_prod_index_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findKnowledgeBaseById(id: string): KnowledgeBase | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id) as KnowledgeBaseRow | undefined
  return row ? mapRowToKnowledgeBase(row) : null
}

export function findKnowledgeBaseByProjectId(projectId: string): KnowledgeBase | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM knowledge_bases WHERE project_id = ?').get(projectId) as KnowledgeBaseRow | undefined
  return row ? mapRowToKnowledgeBase(row) : null
}

export function createKnowledgeBase(data: {
  projectId: string
  name: string
  profileKey?: string
  profileConfig?: Partial<KnowledgeProfileConfig>
  repairConfig?: Record<string, unknown>
}): KnowledgeBase {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()
  const profileConfig = {
    ...defaultKnowledgeProfileConfig(),
    ...(data.profileConfig ?? {}),
  }

  db.prepare(`
    INSERT INTO knowledge_bases (
      id,
      project_id,
      name,
      profile_key,
      profile_config_json,
      repair_config_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.name,
    data.profileKey ?? 'generic_customer_service',
    JSON.stringify(profileConfig),
    JSON.stringify(data.repairConfig ?? {}),
    now,
    now,
  )

  return findKnowledgeBaseById(id)!
}

export function updateKnowledgeBase(
  id: string,
  data: {
    name?: string
    profileKey?: string
    profileConfig?: Partial<KnowledgeProfileConfig>
    repairConfig?: Record<string, unknown>
    currentDraftVersionId?: string | null
    currentStgVersionId?: string | null
    currentProdVersionId?: string | null
    currentStgIndexVersionId?: string | null
    currentProdIndexVersionId?: string | null
  },
): KnowledgeBase | null {
  const existing = findKnowledgeBaseById(id)
  if (!existing) return null

  const db = getDb()
  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.profileKey !== undefined) {
    fields.push('profile_key = ?')
    values.push(data.profileKey)
  }
  if (data.profileConfig !== undefined) {
    fields.push('profile_config_json = ?')
    values.push(JSON.stringify({ ...existing.profileConfig, ...data.profileConfig }))
  }
  if (data.repairConfig !== undefined) {
    fields.push('repair_config_json = ?')
    values.push(JSON.stringify(data.repairConfig))
  }
  if (data.currentDraftVersionId !== undefined) {
    fields.push('current_draft_version_id = ?')
    values.push(data.currentDraftVersionId)
  }
  if (data.currentStgVersionId !== undefined) {
    fields.push('current_stg_version_id = ?')
    values.push(data.currentStgVersionId)
  }
  if (data.currentProdVersionId !== undefined) {
    fields.push('current_prod_version_id = ?')
    values.push(data.currentProdVersionId)
  }
  if (data.currentStgIndexVersionId !== undefined) {
    fields.push('current_stg_index_version_id = ?')
    values.push(data.currentStgIndexVersionId)
  }
  if (data.currentProdIndexVersionId !== undefined) {
    fields.push('current_prod_index_version_id = ?')
    values.push(data.currentProdIndexVersionId)
  }

  values.push(id)
  db.prepare(`UPDATE knowledge_bases SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return findKnowledgeBaseById(id)
}

