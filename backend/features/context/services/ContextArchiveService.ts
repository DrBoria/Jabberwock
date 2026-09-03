/**
 * Infinite Context Graph Storage - archive layer, dual-write ingest and reconciliation-on-start.
 * ICG doc sections 5.6 (dual-write semantics) and 5.7 (reconciliation on start); LCM spec section 4.2 layout:
 * the SQLite database lives at `<storageDir>/context/jabberwock-context.db` in BOTH modes, because both
 * connectors map `IHostContext.storageDir` to their per-user data root (§3.1).
 *
 * Purity boundary (v4 G6 / LCM spec section 7.1): this module is pure Node - zero host API imports and no
 * webview-reachable path may reach it; the frontend consumes only protocol types + events over IConnectorEventBus.
 * The single native dependency `better-sqlite3` (locked by design doc, never substituted) is loaded lazily with a
 * guarded require so that VSIX builds packaged without node_modules degrade to "archive disabled" instead of
 * crashing activation; dev and server modes resolve it from the backend package's node_modules.
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { ContextMessageRole } from "@jabberwock/types"
import { GlobalFileNames } from "@shared/globalFileNames"

import { getBackendRootStore } from "@features/storeSingleton"
import { SCHEMA_SQL } from "@features/context/db/schema"

import { loadDatabaseDriver, openArchiveDatabase } from "./driver"
import type { SqlDatabase } from "./driver"

const CONTEXT_DIR_NAME = "context"
const ARCHIVE_DB_FILE_NAME = "jabberwock-context.db"

export type ContextArchiveStatus = "uninitialized" | "ready" | "disabled-driver-unavailable"

interface ArchiveState {
	status: ContextArchiveStatus
	db: SqlDatabase | null
	storageDir: string
}

/** Module-level singleton state; the archive is a process-wide resource owned by this service (P4 one-service boundary). */
const state: ArchiveState = { status: "uninitialized", db: null, storageDir: "" }

/** First-initialization gate shared by initContextArchive callers and getContextArchiveReady consumers (§5.7 idempotency); cleared on closeAndReset so test cycles can re-open cleanly against a fresh directory. */
let initialInitGate: Promise<ReconciliationReport> | null = null

/** Bounded per-task metadata cache - source for hello->state payloads and ContextWindowStore sync. Never holds content. */
const metaCache = new Map<string, { totalSeqCount: number; freshTailFromSeq: number }>()

function logWarn(message: string): void {
	console.warn(`[jabberwock] [context-archive] ${message}`)
}

/** Idempotent archive initialization: open the database, apply DDL on first run only (the verbatim schema has no IF NOT EXISTS), then reconcile JSON ground truth against it (§5.7). Never throws - failures are logged and reported so startup is never blocked ("log mismatches without blocking", §5.7). The first call's promise is retained as the process-wide readiness gate (getContextArchiveReady) so host paths that create their root store after bootstrap can mirror bounded metadata exactly once regardless of which side settles first; later calls while ready re-run reconciliation only, and concurrent callers share one in-flight initialization instead of double-opening the database. */
export function initContextArchive(storageDir: string): Promise<ReconciliationReport> {
	if (state.status === "ready" && state.db !== null) {
		return reconcileOnStart()
	}

	if (!initialInitGate) initialInitGate = runInitialOpenAndReconcile(storageDir)
	return initialInitGate
}

/** First-call body of initContextArchive: open + pragmas + DDL-on-first-run + reconciliation, with the §5.7 degradation path (log reason, never throw). */
async function runInitialOpenAndReconcile(storageDir: string): Promise<ReconciliationReport> {
	try {
		await fs.mkdir(path.join(storageDir, CONTEXT_DIR_NAME), { recursive: true })
		const Driver = loadDatabaseDriver()
		if (!Driver) {
			state.status = "disabled-driver-unavailable" // loadDatabaseDriver already logged the specific cause (missing module vs. ABI/load failure); this line marks init-level degradation for correlation (§5.6/§5.7)
			logWarn(
				"context archive disabled at startup: native driver unavailable; JSON persistence remains the source of truth.",
			)
			return { tasksScanned: 0, reconciledTasks: 0, discrepancies: [] }
		}

		const dbPath = path.join(storageDir, CONTEXT_DIR_NAME, ARCHIVE_DB_FILE_NAME)
		const { db, created } = openArchiveDatabase(dbPath, SCHEMA_SQL, Driver)
		if (!created && state.status !== "ready") {
			logWarn(`archive database already initialized at ${dbPath}; existing schema left untouched`)
		}

		state.db = db
		state.storageDir = storageDir
		state.status = "ready"
		return reconcileOnStart()
	} catch (error) {
		const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
		return disableWithReport(reason)
	}
}

/** Process-wide readiness gate for the first archive initialization (ICG doc §5.7 idempotency): resolves when open + DDL + reconciliation settle in either mode. Host paths that create their root store after bootstrap (extension activation ordering, v4 plan §7.1 purity note) await this to mirror bounded metadata exactly once without re-running reconciliation or racing the floating init call; hosts that skip bootstrap's floating init get a defensive reconcile-only fallback instead of an unresolvable gate. */
export function getContextArchiveReady(): Promise<ReconciliationReport> {
	if (!initialInitGate) return reconcileOnStart() // no initialization started yet - reconcile against current state rather than opening anything new here
	return initialInitGate
}

/** Failure path for initContextArchive (ICG doc section 5.7 "log mismatches without blocking"): log the reason, close any half-opened database best-effort, mark state disabled and hand back an empty report so startup is never blocked. */
function disableWithReport(reason: string): ReconciliationReport {
	logWarn(`initialization failed, archive disabled: ${reason}`)
	if (state.db !== null && state.status === "ready") {
		try {
			state.db.close()
		} catch {
			// best-effort close on the failure path only
		}
	}
	state.status = "disabled-driver-unavailable"
	return { tasksScanned: 0, reconciledTasks: 0, discrepancies: [] }
}

export interface ReconciliationReport {
	tasksScanned: number
	reconciledTasks: number
	discrepancies: string[]
}

/** Read the archived prefix length for a task per §5.7 ("compare SQLite max(seq)"): contiguous seqs are assigned at ingest, so MAX(seq) is how many JSON messages are already covered. */
function getArchivedPrefixLen(db: SqlDatabase, taskId: string): number {
	const row = db
		.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(seq), 0) AS maxSeq FROM context_messages WHERE task_id = ?")
		.get<{ n: number; maxSeq: number }>(taskId)
	return Math.max(row?.n ?? 0, row?.maxSeq ?? 0)
}

/** Reconciliation on start (ICG doc §5.7): for every per-task JSON ground truth file under `<storageDir>/tasks/`, import the tail beyond what is already archived - this closes any gap left by a crash between the JSON write and the archive ingest, or by an upgrade from before ICG-C1 existed. Never throws; mismatches are logged without blocking startup. */
export async function reconcileOnStart(): Promise<ReconciliationReport> {
	const report: ReconciliationReport = { tasksScanned: 0, reconciledTasks: 0, discrepancies: [] }

	if (state.status !== "ready" || state.db === null) return report

	let taskIds: string[] = []
	try {
		const entries = await fs.readdir(path.join(state.storageDir, "tasks"), { withFileTypes: true })
		taskIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT")
			report.discrepancies.push(`tasks directory unreadable: ${String(error)}`)
		return report
	}

	const db = state.db
	for (const taskId of taskIds) {
		const outcome = await reconcileTask(db, taskId)
		if (outcome.scanned) report.tasksScanned += 1
		report.reconciledTasks += outcome.reconciled
		if (outcome.discrepancy !== undefined) report.discrepancies.push(outcome.discrepancy)
	}

	pushMetaToRootStore()
	return report
}

type TaskReconcileOutcome = { scanned: boolean; reconciled: number; discrepancy?: string }

/** Reconcile one task's JSON ground truth against its archived prefix (ICG doc section 5.7). Returns per-task deltas for the aggregate report; never throws - a bad file becomes a logged discrepancy so it cannot block startup or the other tasks. */
async function reconcileTask(db: SqlDatabase, taskId: string): Promise<TaskReconcileOutcome> {
	// Canonical per-task JSON ground truth file name - single source of truth in @shared/globalFileNames (rebased from legacy claude_messages.json layout, LCM spec section 2.1).
	const historyPath = path.join(state.storageDir, "tasks", taskId, GlobalFileNames.apiConversationHistory)

	let messages: unknown[] | null = null
	try {
		messages = JSON.parse(await fs.readFile(historyPath, "utf8")) as unknown[]
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { scanned: false, reconciled: 0 } // no canonical history file yet - legacy layout out of scope for ICG-C1
		return {
			scanned: false,
			reconciled: 0,
			discrepancy: `task ${taskId}: history unreadable or invalid: ${String(error)}`,
		}
	}

	if (!Array.isArray(messages))
		return { scanned: false, reconciled: 0, discrepancy: `task ${taskId}: history file is not an array; skipped` }

	const archivedPrefixLen = getArchivedPrefixLen(db, taskId)
	if (messages.length < archivedPrefixLen) {
		return {
			scanned: true,
			reconciled: 0,
			discrepancy: `task ${taskId}: json count ${messages.length} < archived prefix ${archivedPrefixLen}; lossy overwrite left archive untouched (P1)`,
		}
	}

	if (messages.length === archivedPrefixLen) {
		updateTaskMeta(db, taskId)
		return { scanned: true, reconciled: 0 }
	}

	const inserted = insertTailRows(db, taskId, messages.slice(archivedPrefixLen), archivedPrefixLen)
	logWarn(
		`task ${taskId}: imported ${inserted} message(s) missing from archive (json=${messages.length}, archived prefix=${archivedPrefixLen})`,
	)
	updateTaskMeta(db, taskId)
	return { scanned: true, reconciled: 1 }
}

/** Append a tail of messages as the next contiguous seqs (starting at `prefixLen + 1`). INSERT OR IGNORE makes re-runs idempotent (§4.3 hash-idempotency spirit); the transaction keeps a batch all-or-nothing so a crash mid-batch cannot leave partial rows behind WAL rollback. */
function insertTailRows(db: SqlDatabase, taskId: string, tail: readonly unknown[], prefixLen: number): number {
	const insert = db.prepare(
		"INSERT OR IGNORE INTO context_messages (task_id, seq, role, content_json, token_count, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)

	let inserted = 0
	db.transaction(() => {
		for (let i = 0; i < tail.length; i += 1) {
			const message = tail[i] as ArchivedApiMessage | null
			if (!message || typeof message !== "object") continue
			const contentJson = JSON.stringify(message.content ?? null)
			const metadataJson =
				message.ts !== undefined || message.id !== undefined
					? JSON.stringify({ ts: message.ts ?? null, id: message.id ?? null })
					: null
			const result = insert.run(
				taskId,
				prefixLen + i + 1,
				normalizeRole(message.role),
				contentJson,
				Math.max(1, Math.ceil(contentJson.length / 4)), // rough char/4 estimate at ingest; authoritative tiktoken counts happen in the compressor assembly path (ICG-C2)
				Date.now(),
				metadataJson,
			)
			inserted += result.changes // INSERT OR IGNORE makes re-runs idempotent; count only rows actually written so IngestResult.ingested stays honest under any prior state
		}
	})()

	return inserted
}

/** Role domain per the LCM DDL comment (user|assistant|tool|system); exported so consumers and tests can validate against it without re-declaring. */
export const KNOWN_CONTEXT_ROLES = ["user", "assistant", "tool", "system"] as readonly ContextMessageRole[]

function normalizeRole(role: unknown): string {
	// Verbatim storage - the archive never mutates or drops data (P1). Out-of-domain values are preserved exactly as received; non-string roles are serialized so a malformed row can never break the batch bind (role column is NOT NULL TEXT).
	if (typeof role === "string") return role.length > 0 ? role : "unknown"
	if (role == null) return "unknown"
	try {
		const serialized = JSON.stringify(role)
		return typeof serialized === "string" && serialized.length > 0 ? serialized : String(role)
	} catch {
		return String(role)
	}
}

interface ArchivedApiMessage {
	role?: unknown
	content?: unknown
	ts?: number
	id?: string
}

/** Ingest result of a dual-write call (ICG doc section 5.6). */
export interface IngestResult {
	/** Rows newly inserted by this call - 0 when the tail was already archived (idempotent re-ingest, section 4.3 spirit). */
	ingested: number
	/** Total rows now archived for the task after this call. */
	totalArchived: number
}

/**
 * Dual-write ingest point of ICG doc section 5.6 - called from the existing message-save flow when API messages are finalized and persisted to JSON ground truth. Synchronous by design (better-sqlite3 ops are atomic and short, so no async races across fiber yield points); only FINALIZED messages enter here, never in-flight stream chunks (§5.6). Idempotent: re-ingesting an already-archived tail inserts nothing; a shrunken JSON below the archived prefix is left untouched (P1 append-only) with a logged discrepancy. Never throws - archive failures must not break message persistence and reconciliation on start closes any gap (§5.7).
 */
export function ingestTaskMessages(taskId: string, messages: readonly ArchivedApiMessage[]): IngestResult {
	if (state.status !== "ready" || state.db === null) {
		return { ingested: 0, totalArchived: 0 } // archive disabled - JSON remains the source of truth (§5.6 degradation path)
	}

	const db = state.db
	const archivedPrefixLen = getArchivedPrefixLen(db, taskId)

	if (messages.length < archivedPrefixLen) {
		logWarn(
			`task ${taskId}: ingest count ${messages.length} below archived prefix ${archivedPrefixLen}; lossy overwrite left archive untouched (P1)`,
		)
		updateTaskMeta(db, taskId)
		pushMetaToRootStore()
		return { ingested: 0, totalArchived: getArchivedPrefixLen(db, taskId) }
	}

	const tail = messages.slice(archivedPrefixLen) // [] when nothing new - slice past the end returns an empty array, so no explicit guard is needed here
	const inserted = tail.length > 0 ? insertTailRows(db, taskId, tail, archivedPrefixLen) : 0
	updateTaskMeta(db, taskId)
	pushMetaToRootStore()
	return { ingested: inserted, totalArchived: getArchivedPrefixLen(db, taskId) }
}

/** Refresh the bounded metadata cache entry for a task (COUNT + MIN(seq)); O(1)-ish index reads at push time per ICG doc section 7.3. */
function updateTaskMeta(db: SqlDatabase, taskId: string): void {
	const row = db
		.prepare("SELECT COUNT(*) AS n, COALESCE(MIN(seq), 0) AS minSeq FROM context_messages WHERE task_id = ?")
		.get<{ n: number; minSeq: number }>(taskId)
	if (!row || row.n === 0) return
	// ICG-C1 has no rollup nodes yet (the GIVEN compressor lands later, section 4.5), so the fresh tail starts at min(seq); once compaction exists this becomes manifest-driven (ICG-C2+).
	metaCache.set(taskId, { totalSeqCount: row.n, freshTailFromSeq: row.minSeq })
}

/** Mirror the bounded metadata cache into the root-store `context` key for hydrated-state consumers. Guarded by design: in extension mode archive init runs before createBackendRootStore() at startup (bootstrap ordering), so early pushes are no-ops until a later ingest or reconcile syncs; server mode has no MST root store and reads getContextWindowMeta() directly instead. */
function pushMetaToRootStore(): void {
	try {
		const root = getBackendRootStore()
		for (const [taskId, meta] of metaCache) {
			root.context.setTaskMeta(taskId, meta.totalSeqCount, meta.freshTailFromSeq)
		}
	} catch {
		// Root store not created yet - nothing to sync; the next ingest or reconcile will retry.
	}
}

/** Public entry point for callers that need bounded metadata mirrored into the root store after an out-of-band archive change (tests, future cutover tooling). */
export function syncContextWindowMetaToStore(): void {
	pushMetaToRootStore()
}

/** Bounded per-task metadata snapshot for hello->state payloads (ICG doc section 7.3) - a copy of the cache, never content: full history stays on disk and arrives via explicit range fetches after the handshake. */
export function getContextWindowMeta(): Record<string, { totalSeqCount: number; freshTailFromSeq: number }> {
	const entries = [...metaCache].map(([taskId, meta]) => [taskId, { ...meta }] as const) // shallow copy per entry - callers must not observe cache mutations through the snapshot
	return Object.fromEntries(entries)
}

/** Test support only - the ICG-C1 acceptance gates need direct SQL assertions before the read path lands with ContextSearchService in ICG-C2; replace or remove when that service exists. */
export function archiveQueryForTests<T>(sql: string, params?: readonly unknown[]): T[] {
	if (state.status !== "ready" || state.db === null) throw new Error("context archive is not ready")
	return state.db.prepare(sql).all(...(params ?? [])) as T[]
}

/** Read-only access to the open archive database while ready (null when uninitialized or degraded per section 5.6); ICG-C2 ContextSearchService reuses this instead of opening its own connection. */
export function getContextDatabase(): SqlDatabase | null {
	return state.status === "ready" ? state.db : null
}

/** Close the database and reset module-level state. Test teardown hook for now; doubles as a future graceful-shutdown seam (WAL checkpoint happens on close inside better-sqlite3). */
export function closeAndResetContextArchive(): void {
	if (state.db !== null) {
		try {
			state.db.close()
		} catch {
			logWarn("close failed during reset; state cleared anyway")
		}
	}
	state.status = "uninitialized"
	state.db = null
	state.storageDir = ""
	initialInitGate = null // allow a fresh first-initialization gate on the next initContextArchive call (test cycles, future graceful-shutdown seam)
	metaCache.clear()
}
