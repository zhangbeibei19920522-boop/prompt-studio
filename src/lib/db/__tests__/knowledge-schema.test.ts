import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('knowledge schema', () => {
  it('creates knowledge tables and allows inserting a knowledge base row', async () => {
    const originalCwd = process.cwd()
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-schema-'))

    try {
      process.chdir(tempDir)
      vi.resetModules()

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      const now = '2026-04-21T00:00:00.000Z'

      db.prepare(`
        INSERT INTO projects (
          id,
          name,
          description,
          business_description,
          business_goal,
          business_background,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('project-1', 'Project 1', '', '', '', '', now, now)

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
        'kb-1',
        'project-1',
        'Knowledge Base',
        'generic_customer_service',
        JSON.stringify({}),
        JSON.stringify({}),
        now,
        now,
      )

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'knowledge_%' ORDER BY name")
        .all() as Array<{ name: string }>

      expect(tables.map((row) => row.name)).toEqual([
        'knowledge_bases',
        'knowledge_build_tasks',
        'knowledge_chunks',
        'knowledge_index_versions',
        'knowledge_parents',
        'knowledge_versions',
      ])

      const row = db
        .prepare('SELECT id, project_id, profile_key FROM knowledge_bases WHERE id = ?')
        .get('kb-1') as { id: string; project_id: string; profile_key: string } | undefined

      expect(row).toEqual({
        id: 'kb-1',
        project_id: 'project-1',
        profile_key: 'generic_customer_service',
      })

      db.close()
    } finally {
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
