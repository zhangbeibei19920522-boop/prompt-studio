import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('conversation audit schema', () => {
  it('creates conversation audit tables and allows inserting a job row', async () => {
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-audit-schema-'));

    try {
      process.chdir(tempDir);
      vi.resetModules();

      const { getDb } = await import('@/lib/db');

      const db = getDb();

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
      `).run(
        'project-1',
        'Project 1',
        '',
        '',
        '',
        '',
        '2026-03-18T00:00:00.000Z',
        '2026-03-18T00:00:00.000Z'
      );

      db.prepare(`
        INSERT INTO conversation_audit_jobs (
          id,
          project_id,
          name,
          status,
          parse_summary,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'job-1',
        'project-1',
        'Audit Job 1',
        'draft',
        JSON.stringify({ knowledgeFileCount: 0, conversationCount: 0, turnCount: 0, invalidRowCount: 0 }),
        '2026-03-18T00:00:00.000Z',
        '2026-03-18T00:00:00.000Z'
      );

      const row = db
        .prepare('SELECT id, project_id, status FROM conversation_audit_jobs WHERE id = ?')
        .get('job-1') as { id: string; project_id: string; status: string } | undefined;

      expect(row).toEqual({
        id: 'job-1',
        project_id: 'project-1',
        status: 'draft',
      });

      db.close();
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
