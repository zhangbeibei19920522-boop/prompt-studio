import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { Project } from '@/types/database'

interface ProjectRow {
  id: string
  name: string
  description: string
  business_description: string
  business_goal: string
  business_background: string
  created_at: string
  updated_at: string
}

function mapRowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    businessDescription: row.business_description,
    businessGoal: row.business_goal,
    businessBackground: row.business_background,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findAllProjects(): Project[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as ProjectRow[]
  return rows.map(mapRowToProject)
}

export function findProjectById(id: string): Project | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  return row ? mapRowToProject(row) : null
}

export function createProject(
  data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
): Project {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO projects (id, name, description, business_description, business_goal, business_background, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name,
    data.description,
    data.businessDescription,
    data.businessGoal,
    data.businessBackground,
    now,
    now
  )

  return {
    id,
    name: data.name,
    description: data.description,
    businessDescription: data.businessDescription,
    businessGoal: data.businessGoal,
    businessBackground: data.businessBackground,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateProject(
  id: string,
  data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>
): Project | null {
  const db = getDb()
  const existing = findProjectById(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
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

  values.push(id)
  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return findProjectById(id)
}

export function deleteProject(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  return result.changes > 0
}
