import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { SCHEMA_SQL } from "./schema"

/** Normalize line endings and surrounding whitespace so the gate compares content identity only. */
function normalize(sqlText: string): string {
	return sqlText.replace(/\r\n/g, "\n").trim()
}

describe("context archive schema (ICG-C1)", () => {
	it("SCHEMA_SQL stays byte-identical to the canonical schema.sql artifact", () => {
		const here = path.dirname(fileURLToPath(import.meta.url))
		const fileSql = readFileSync(path.join(here, "schema.sql"), "utf8")
		expect(normalize(SCHEMA_SQL)).toBe(normalize(fileSql))
	})

	it("SCHEMA_SQL contains the core archive objects (tables, FTS virtual tables, sync triggers)", () => {
		const sql = normalize(SCHEMA_SQL)
		for (const marker of [
			"CREATE TABLE context_messages",
			"UNIQUE(task_id, seq)",
			"CREATE INDEX idx_cm_task_seq ON context_messages(task_id, seq)",
			"CREATE VIRTUAL TABLE messages_fts USING fts5(content_text, content='context_messages', content_rowid='rowid')",
			"CREATE TRIGGER cm_fts_ai AFTER INSERT ON context_messages BEGIN",
			"PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
			"PRAGMA cache_size=-65536;",
		]) {
			expect(sql).toContain(marker)
		}
	})
})
