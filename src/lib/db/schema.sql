-- Prompt Manager Database Schema

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  provider TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL DEFAULT '',
  business_description TEXT NOT NULL DEFAULT '',
  business_goal TEXT NOT NULL DEFAULT '',
  business_background TEXT NOT NULL DEFAULT ''
);

-- Ensure single row exists
INSERT OR IGNORE INTO global_settings (id) VALUES ('default');

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  business_description TEXT NOT NULL DEFAULT '',
  business_goal TEXT NOT NULL DEFAULT '',
  business_background TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  variables TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  change_note TEXT NOT NULL DEFAULT '',
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profile_key TEXT NOT NULL DEFAULT 'generic_customer_service',
  profile_config_json TEXT NOT NULL DEFAULT '{"sourceAdapters":{},"cleaningRules":{},"riskRules":{},"promotionRules":{},"mergeRules":{},"conflictRules":{},"metadataSchema":[],"entityDictionary":{}}',
  repair_config_json TEXT NOT NULL DEFAULT '{}',
  current_draft_version_id TEXT,
  current_stg_version_id TEXT,
  current_prod_version_id TEXT,
  current_stg_index_version_id TEXT,
  current_prod_index_version_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_build_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  knowledge_version_id TEXT REFERENCES knowledge_versions(id) ON DELETE SET NULL,
  knowledge_index_version_id TEXT REFERENCES knowledge_index_versions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK(task_type IN ('batch', 'manual', 'repair', 'full')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  current_step TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  base_version_id TEXT,
  input_json TEXT NOT NULL DEFAULT '{"documentIds":[],"manualDrafts":[],"repairQuestions":[]}',
  stage_summary_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES knowledge_build_tasks(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'stg', 'prod', 'archived')),
  build_profile TEXT NOT NULL DEFAULT 'generic_customer_service',
  source_summary_json TEXT NOT NULL DEFAULT '{}',
  stage_summary_json TEXT NOT NULL,
  coverage_audit_json TEXT NOT NULL,
  qa_pair_count INTEGER NOT NULL DEFAULT 0,
  parent_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  parents_file_path TEXT NOT NULL,
  chunks_file_path TEXT NOT NULL,
  manifest_file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_parents (
  id TEXT PRIMARY KEY,
  knowledge_version_id TEXT NOT NULL REFERENCES knowledge_versions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  question_aliases_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  source_files_json TEXT NOT NULL DEFAULT '[]',
  source_record_ids_json TEXT NOT NULL DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'approved' CHECK(review_status IN ('approved', 'pending', 'blocked')),
  record_kind TEXT NOT NULL DEFAULT 'merge_ready_faq',
  is_high_risk INTEGER NOT NULL DEFAULT 0,
  inherited_risk_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  knowledge_version_id TEXT NOT NULL REFERENCES knowledge_versions(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL REFERENCES knowledge_parents(id) ON DELETE CASCADE,
  chunk_order INTEGER NOT NULL DEFAULT 0,
  section_title TEXT NOT NULL DEFAULT '概述',
  chunk_text TEXT NOT NULL,
  embedding_text TEXT NOT NULL,
  chunk_type TEXT NOT NULL DEFAULT 'answer',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_index_versions (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  knowledge_version_id TEXT NOT NULL REFERENCES knowledge_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'ready', 'stg', 'prod', 'archived')),
  profile_key TEXT NOT NULL DEFAULT 'generic_customer_service',
  parent_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  stage_summary_json TEXT NOT NULL,
  manifest_file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  built_at TEXT,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '新对话',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  references_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompts_project ON prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_tasks_project ON knowledge_build_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_tasks_base ON knowledge_build_tasks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_base ON knowledge_versions(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_task ON knowledge_versions(task_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_parents_version ON knowledge_parents(knowledge_version_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_version ON knowledge_chunks(knowledge_version_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_parent ON knowledge_chunks(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_index_versions_base ON knowledge_index_versions(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_index_versions_version ON knowledge_index_versions(knowledge_version_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

-- 记忆系统
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('global', 'project')),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('preference', 'fact')),
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('auto', 'manual')),
  source_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_extraction_progress (
  session_id TEXT PRIMARY KEY,
  last_extracted_message_index INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
CREATE INDEX IF NOT EXISTS idx_memories_scope_project ON memories(scope, project_id);

-- 自动化测试系统
CREATE TABLE IF NOT EXISTS test_suites (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  section TEXT NOT NULL DEFAULT 'full-flow' CHECK(section IN ('full-flow', 'unit')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prompt_id TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_version_id TEXT REFERENCES prompt_versions(id) ON DELETE SET NULL,
  workflow_mode TEXT NOT NULL DEFAULT 'single' CHECK(workflow_mode IN ('single', 'routing')),
  routing_config TEXT,
  config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'ready', 'running', 'completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  test_suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  expected_output_diagnostics TEXT,
  expected_intent TEXT,
  generation_metadata_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  test_suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed')),
  results TEXT NOT NULL DEFAULT '[]',
  report TEXT NOT NULL DEFAULT '{}',
  score REAL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS test_suite_generation_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'completed', 'failed')),
  generated_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  request_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_test_suites_project ON test_suites(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON test_cases(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite ON test_runs(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_test_suite_generation_jobs_project ON test_suite_generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_suite_generation_jobs_suite ON test_suite_generation_jobs(suite_id);

-- 会话质检
CREATE TABLE IF NOT EXISTS conversation_audit_jobs (
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

CREATE TABLE IF NOT EXISTS conversation_audit_knowledge_chunks (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES conversation_audit_jobs(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_audit_conversations (
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
);

CREATE TABLE IF NOT EXISTS conversation_audit_turns (
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
);

CREATE INDEX IF NOT EXISTS idx_audit_jobs_project ON conversation_audit_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_chunks_job ON conversation_audit_knowledge_chunks(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_conversations_job ON conversation_audit_conversations(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_turns_job ON conversation_audit_turns(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_turns_conversation ON conversation_audit_turns(conversation_id);
