import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

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

  it('migrates an existing conversation audit jobs table to allow parsing status', async () => {
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-audit-schema-migrate-'));

    try {
      process.chdir(tempDir);
      fs.mkdirSync(path.join(tempDir, 'data'), { recursive: true });

      const legacyDb = new Database(path.join(tempDir, 'data', 'prompt-manager.db'));
      legacyDb.exec(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          business_description TEXT NOT NULL,
          business_goal TEXT NOT NULL,
          business_background TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE conversation_audit_jobs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'running', 'completed', 'failed')),
          parse_summary TEXT NOT NULL DEFAULT '{"knowledgeFileCount":0,"conversationCount":0,"turnCount":0,"invalidRowCount":0}',
          issue_count INTEGER NOT NULL DEFAULT 0,
          total_turns INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT
        );
      `);
      legacyDb.close();

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
        '2026-03-19T00:00:00.000Z',
        '2026-03-19T00:00:00.000Z'
      );

      expect(() => {
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
          'job-parsing',
          'project-1',
          'Audit Job Parsing',
          'parsing',
          JSON.stringify({ knowledgeFileCount: 0, conversationCount: 0, turnCount: 0, invalidRowCount: 0 }),
          '2026-03-19T00:00:00.000Z',
          '2026-03-19T00:00:00.000Z'
        );
      }).not.toThrow();

      db.close();
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('repairs child tables that still reference conversation_audit_jobs_legacy', async () => {
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-audit-schema-repair-'));

    try {
      process.chdir(tempDir);
      fs.mkdirSync(path.join(tempDir, 'data'), { recursive: true });

      const brokenDb = new Database(path.join(tempDir, 'data', 'prompt-manager.db'));
      brokenDb.exec(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          business_description TEXT NOT NULL,
          business_goal TEXT NOT NULL,
          business_background TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE conversation_audit_jobs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('parsing', 'draft', 'running', 'completed', 'failed')),
          parse_summary TEXT NOT NULL DEFAULT '{"knowledgeFileCount":0,"conversationCount":0,"turnCount":0,"invalidRowCount":0}',
          issue_count INTEGER NOT NULL DEFAULT 0,
          total_turns INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT
        );

        CREATE TABLE conversation_audit_knowledge_chunks (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL REFERENCES "conversation_audit_jobs_legacy"(id) ON DELETE CASCADE,
          source_name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      brokenDb.close();

      vi.resetModules();
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const row = db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'conversation_audit_knowledge_chunks'")
        .get() as { sql: string } | undefined;

      expect(row?.sql).toContain('REFERENCES conversation_audit_jobs(id)');
      expect(row?.sql).not.toContain('conversation_audit_jobs_legacy');

      db.close();
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
