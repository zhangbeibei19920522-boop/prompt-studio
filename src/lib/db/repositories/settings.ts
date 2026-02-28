import { getDb } from '@/lib/db'
import type { GlobalSettings } from '@/types/database'

interface SettingsRow {
  id: string
  provider: string
  api_key: string
  model: string
  base_url: string
  business_description: string
  business_goal: string
  business_background: string
}

function mapRowToSettings(row: SettingsRow): GlobalSettings {
  return {
    id: row.id,
    provider: row.provider,
    apiKey: row.api_key,
    model: row.model,
    baseUrl: row.base_url,
    businessDescription: row.business_description,
    businessGoal: row.business_goal,
    businessBackground: row.business_background,
  }
}

export function getSettings(): GlobalSettings {
  const db = getDb()
  const row = db.prepare('SELECT * FROM global_settings WHERE id = ?').get('default') as SettingsRow
  return mapRowToSettings(row)
}

export function updateSettings(data: Partial<Omit<GlobalSettings, 'id'>>): GlobalSettings {
  const db = getDb()

  const fields: string[] = []
  const values: unknown[] = []

  if (data.provider !== undefined) {
    fields.push('provider = ?')
    values.push(data.provider)
  }
  if (data.apiKey !== undefined) {
    fields.push('api_key = ?')
    values.push(data.apiKey)
  }
  if (data.model !== undefined) {
    fields.push('model = ?')
    values.push(data.model)
  }
  if (data.baseUrl !== undefined) {
    fields.push('base_url = ?')
    values.push(data.baseUrl)
  }
  if (data.businessDescription !== undefined) {
    fields.push('business_description = ?')
    values.push(data.businessDescription)
  }
  if (data.businessGoal !== undefined) {
    fields.push('business_goal = ?')
    values.push(data.businessGoal)
  }
  if (data.businessBackground !== undefined) {
    fields.push('business_background = ?')
    values.push(data.businessBackground)
  }

  if (fields.length > 0) {
    values.push('default')
    db.prepare(`UPDATE global_settings SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  return getSettings()
}
