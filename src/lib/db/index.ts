import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

function ensureColumn(
  database: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  const hasColumn = columns.some((column) => column.name === columnName)

  if (!hasColumn) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  }
}

const CONVERSATION_AUDIT_JOBS_TABLE_SQL = `
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
)
`

const CONVERSATION_AUDIT_KNOWLEDGE_CHUNKS_TABLE_SQL = `
CREATE TABLE conversation_audit_knowledge_chunks (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES conversation_audit_jobs(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
`

const CONVERSATION_AUDIT_CONVERSATIONS_TABLE_SQL = `
CREATE TABLE conversation_audit_conversations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES conversation_audit_jobs(id) ON DELETE CASCADE,
  external_conversation_id TEXT NOT NULL,
  turn_count INTEGER NOT NULL DEFAULT 0,
  overall_status TEXT NOT NULL DEFAULT 'unknown' CHECK(overall_status IN ('passed', 'failed', 'unknown')),
  process_status TEXT NOT NULL DEFAULT 'unknown' CHECK(process_status IN ('passed', 'failed', 'unknown')),
  knowledge_status TEXT NOT NULL DEFAULT 'unknown' CHECK(knowledge_status IN ('passed', 'failed', 'unknown')),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low', 'medium', 'high')),
  summary TEXT NOT NULL DEFAULT '',
  process_steps_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
`

const CONVERSATION_AUDIT_TURNS_TABLE_SQL = `
CREATE TABLE conversation_audit_turns (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES conversation_audit_jobs(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversation_audit_conversations(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  bot_reply TEXT NOT NULL DEFAULT '',
  has_issue INTEGER,
  knowledge_answer TEXT,
  retrieved_sources_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
`

function migrateConversationAuditJobsTable(database: Database.Database): void {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'conversation_audit_jobs'")
    .get() as { sql: string } | undefined

  if (!row?.sql || row.sql.includes("'parsing'")) {
    return
  }

  database.exec('PRAGMA foreign_keys = OFF')

  try {
    const migrate = database.transaction(() => {
      database.exec(`
        ALTER TABLE conversation_audit_jobs RENAME TO conversation_audit_jobs_legacy;
        ${CONVERSATION_AUDIT_JOBS_TABLE_SQL};
        INSERT INTO conversation_audit_jobs (
          id,
          project_id,
          name,
          status,
          parse_summary,
          issue_count,
          total_turns,
          error_message,
          created_at,
          updated_at,
          completed_at
        )
        SELECT
          id,
          project_id,
          name,
          status,
          parse_summary,
          issue_count,
          total_turns,
          error_message,
          created_at,
          updated_at,
          completed_at
        FROM conversation_audit_jobs_legacy;
        DROP TABLE conversation_audit_jobs_legacy;
        CREATE INDEX IF NOT EXISTS idx_audit_jobs_project ON conversation_audit_jobs(project_id);
      `)
    })

    migrate()
  } finally {
    database.exec('PRAGMA foreign_keys = ON')
  }
}

function repairConversationAuditChildTableReferences(database: Database.Database): void {
  const tables = [
    {
      name: 'conversation_audit_knowledge_chunks',
      sql: CONVERSATION_AUDIT_KNOWLEDGE_CHUNKS_TABLE_SQL,
      columns: 'id, job_id, source_name, source_type, chunk_index, content, metadata_json, created_at',
      indexes: ["CREATE INDEX IF NOT EXISTS idx_audit_chunks_job ON conversation_audit_knowledge_chunks(job_id)"],
    },
    {
      name: 'conversation_audit_conversations',
      sql: CONVERSATION_AUDIT_CONVERSATIONS_TABLE_SQL,
      columns: 'id, job_id, external_conversation_id, turn_count, overall_status, process_status, knowledge_status, risk_level, summary, process_steps_json, created_at',
      indexes: ["CREATE INDEX IF NOT EXISTS idx_audit_conversations_job ON conversation_audit_conversations(job_id)"],
    },
    {
      name: 'conversation_audit_turns',
      sql: CONVERSATION_AUDIT_TURNS_TABLE_SQL,
      columns: 'id, job_id, conversation_id, turn_index, user_message, bot_reply, has_issue, knowledge_answer, retrieved_sources_json, created_at, updated_at',
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_audit_turns_job ON conversation_audit_turns(job_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_turns_conversation ON conversation_audit_turns(conversation_id)",
      ],
    },
  ] as const

  const brokenTables = tables.filter((table) => {
    const row = database
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table.name) as { sql: string } | undefined

    return row?.sql?.includes('conversation_audit_jobs_legacy') === true
  })

  if (brokenTables.length === 0) {
    return
  }

  database.exec('PRAGMA foreign_keys = OFF')

  try {
    const repair = database.transaction(() => {
      for (const table of brokenTables) {
        database.exec(`
          ALTER TABLE ${table.name} RENAME TO ${table.name}_legacy_ref;
          ${table.sql};
          INSERT INTO ${table.name} (${table.columns})
          SELECT ${table.columns}
          FROM ${table.name}_legacy_ref;
          DROP TABLE ${table.name}_legacy_ref;
          ${table.indexes.join(';\n')};
        `)
      }
    })

    repair()
  } finally {
    database.exec('PRAGMA foreign_keys = ON')
  }
}

function ensureConversationAuditConversationColumns(database: Database.Database): void {
  const columns = database
    .prepare("PRAGMA table_info(conversation_audit_conversations)")
    .all() as Array<{ name: string }>

  if (columns.length === 0) {
    return
  }

  const existing = new Set(columns.map((column) => column.name))
  const addStatements = [
    !existing.has('overall_status')
      ? "ALTER TABLE conversation_audit_conversations ADD COLUMN overall_status TEXT NOT NULL DEFAULT 'unknown' CHECK(overall_status IN ('passed', 'failed', 'unknown'))"
      : null,
    !existing.has('process_status')
      ? "ALTER TABLE conversation_audit_conversations ADD COLUMN process_status TEXT NOT NULL DEFAULT 'unknown' CHECK(process_status IN ('passed', 'failed', 'unknown'))"
      : null,
    !existing.has('knowledge_status')
      ? "ALTER TABLE conversation_audit_conversations ADD COLUMN knowledge_status TEXT NOT NULL DEFAULT 'unknown' CHECK(knowledge_status IN ('passed', 'failed', 'unknown'))"
      : null,
    !existing.has('risk_level')
      ? "ALTER TABLE conversation_audit_conversations ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low', 'medium', 'high'))"
      : null,
    !existing.has('summary')
      ? "ALTER TABLE conversation_audit_conversations ADD COLUMN summary TEXT NOT NULL DEFAULT ''"
      : null,
    !existing.has('process_steps_json')
      ? "ALTER TABLE conversation_audit_conversations ADD COLUMN process_steps_json TEXT NOT NULL DEFAULT '[]'"
      : null,
  ].filter(Boolean) as string[]

  if (addStatements.length === 0) {
    return
  }

  const migrate = database.transaction(() => {
    for (const statement of addStatements) {
      database.exec(statement)
    }
  })

  migrate()
}

export function getDb(): Database.Database {
  if (db) return db

  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = path.join(dataDir, 'prompt-manager.db')
  db = new Database(dbPath)

  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema
  const schemaPath = path.join(__dirname, 'schema.sql')
  let schema: string
  // In Next.js, __dirname may not work for .sql files, so read relative to cwd
  const altPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql')
  if (fs.existsSync(schemaPath)) {
    schema = fs.readFileSync(schemaPath, 'utf-8')
  } else if (fs.existsSync(altPath)) {
    schema = fs.readFileSync(altPath, 'utf-8')
  } else {
    throw new Error('Cannot find schema.sql')
  }

  db.exec(schema)
  migrateConversationAuditJobsTable(db)
  repairConversationAuditChildTableReferences(db)
  ensureConversationAuditConversationColumns(db)
  ensureColumn(
    db,
    'test_suites',
    'section',
    "TEXT NOT NULL DEFAULT 'full-flow' CHECK(section IN ('full-flow', 'unit'))"
  )
  ensureColumn(db, 'test_suites', 'workflow_mode', "TEXT NOT NULL DEFAULT 'single'")
  ensureColumn(db, 'test_suites', 'routing_config', 'TEXT')
  ensureColumn(db, 'test_cases', 'expected_output_diagnostics', 'TEXT')
  ensureColumn(db, 'test_cases', 'expected_intent', 'TEXT')

  return db
}
