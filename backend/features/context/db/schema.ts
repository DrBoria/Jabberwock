/**
 * Infinite Context Graph Storage - embedded archive DDL (ICG-C1).
 *
 * Byte-for-byte mirror of `./schema.sql` so the bundled server/extension builds can initialize
 * the database without reading a file from disk next to the single-file bundle. A vitest gate in
 * this feature asserts that this constant stays identical to schema.sql, which remains the
 * canonical spec artifact (LCM spec section 4.6 DDL verbatim + ICG doc section 5.5 pragmas).
 */

export const SCHEMA_SQL = `-- Infinite Context Graph Storage - archive schema (ICG-C1).
-- DDL kept verbatim from the LCM spec section 4.6 block at git commit 2574bd280
-- (plans/architecture-lossless-context-management.md, recovered read-only); all statements,
-- column lists, defaults and indexes are byte-identical to that block. The two non-English
-- comment fragments were translated into English per the project language rule; SQL itself is untouched.
-- Additive pragmas from ICG doc section 5.5 (Q2 default) follow the verbatim header line.

PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
-- L2 page cache sized for >1 GB working sets without pressuring host memory budgets [ICG Q2 default: -64 MB].
-- wal_autocheckpoint is left at its SQLite default in v1 (tuned only on evidence of checkpoint storms, ICG section 5.5).
PRAGMA cache_size=-65536;

CREATE TABLE context_messages (          -- P1: append-only, INSERT/SELECT only inside the service layer
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL, seq INTEGER NOT NULL, role TEXT NOT NULL,   -- user|assistant|tool|system
  content_json TEXT NOT NULL,           -- verbatim parts (Anthropic blocks) - lossless source of truth
  token_count INTEGER NOT NULL, created_at INTEGER NOT NULL, metadata_json TEXT,
  UNIQUE(task_id, seq));
CREATE INDEX idx_cm_task_seq ON context_messages(task_id, seq);

CREATE TABLE context_nodes (             -- DAG section 4.3; summary text only on rollups
  node_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, kind TEXT NOT NULL, depth INTEGER NOT NULL,
  parent_ids_json TEXT NOT NULL DEFAULT '[]', child_node_ids_json TEXT NOT NULL DEFAULT '[]',
  from_seq INTEGER NOT NULL, to_seq INTEGER NOT NULL, token_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', summary_text TEXT, escalation_level INTEGER,
  title TEXT, source TEXT,               -- topic_group: auto|user; task_embed: child_task_id in meta_json
  meta_json TEXT, created_at INTEGER NOT NULL);
CREATE INDEX idx_cn_task_depth ON context_nodes(task_id, depth);
CREATE INDEX idx_cn_range ON context_nodes(task_id, from_seq, to_seq);

CREATE VIRTUAL TABLE messages_fts USING fts5(content_text, content='context_messages', content_rowid='rowid');  -- triggers on INSERT only (append-only -> AFTER INSERT)
CREATE VIRTUAL TABLE summaries_fts USING fts5(summary_text, content='context_nodes', content_rowid=rowid);

CREATE TABLE active_window_manifest (    -- lcm context_items: what the model sees right now (section 4.4)
  task_id TEXT NOT NULL, ordinal INTEGER NOT NULL, node_id TEXT NOT NULL, kind TEXT NOT NULL,
  PRIMARY KEY(task_id, ordinal));

CREATE TABLE compaction_events (         -- compression boundaries + reconciliation/UI timeline
  id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, fired_at INTEGER NOT NULL,
  from_seq INTEGER NOT NULL, to_seq INTEGER NOT NULL, node_ids_json TEXT NOT NULL, tokens_before INTEGER, tokens_after INTEGER);

-- ─────────────────────────── FTS sync triggers (ICG section 5.2: AFTER INSERT only - P1 append-only) ───────────────────────────
-- Flat text extraction at INSERT time per LCM spec section 4.6 ("text blocks + tool input/output as text");
-- thinking blocks are INCLUDED by default [Q3 recommended include] so "what did we discuss / why" recall finds reasoning, not only final answers.
-- Structured parts remain verbatim in content_json and are what recall returns byte-for-byte (ICG section 6.4).

CREATE TRIGGER cm_fts_ai AFTER INSERT ON context_messages BEGIN
  INSERT INTO messages_fts(rowid, content_text)
  SELECT NEW.rowid, COALESCE((SELECT group_concat(piece.text, ' ') FROM (
      -- Plain string content: indexed verbatim.
      SELECT json_extract(NEW.content_json, '$') AS text WHERE json_type(NEW.content_json) = 'text'
      UNION ALL
      -- Array of API blocks: flatten text + thinking [Q3 default] for keyword searchability.
      SELECT CASE json_extract(j.value, '$.type') WHEN 'text' THEN json_extract(j.value, '$.text') ELSE json_extract(j.value, '$.thinking') END AS text FROM json_each(CASE WHEN json_type(NEW.content_json) = 'array' THEN NEW.content_json ELSE '[]' END) j WHERE json_extract(j.value, '$.type') IN ('text', 'thinking')
      UNION ALL
      -- tool_use: name + input as flat text (LCM spec section 4.6).
      SELECT COALESCE(json_extract(j.value, '$.name'), '') || ': ' || COALESCE(CAST(json_extract(j.value, '$.input') AS TEXT), '{}') AS text FROM json_each(CASE WHEN json_type(NEW.content_json) = 'array' THEN NEW.content_json ELSE '[]' END) j WHERE json_extract(j.value, '$.type') = 'tool_use'
      UNION ALL
      -- tool_result: content as flat text (string or JSON array of blocks).
      SELECT COALESCE(CAST(json_extract(j.value, '$.content') AS TEXT), '') AS text FROM json_each(CASE WHEN json_type(NEW.content_json) = 'array' THEN NEW.content_json ELSE '[]' END) j WHERE json_extract(j.value, '$.type') = 'tool_result'
  ) piece WHERE piece.text IS NOT NULL AND length(piece.text) > 0), '');
END;

CREATE TRIGGER cn_fts_ai AFTER INSERT ON context_nodes BEGIN
  INSERT INTO summaries_fts(rowid, summary_text) VALUES (NEW.rowid, COALESCE(NEW.summary_text, ''));
END;`
