/**
 * Native SQLite driver loading for the context archive (ICG-C1). Isolated module so ContextArchiveService stays within its line budget, and because this is the ONLY place in the feature that resolves `better-sqlite3`. Purity boundary (v4 G6 / LCM spec section 7.1): pure Node - zero host API imports; loaded lazily with a guarded require so VSIX builds packaged without node_modules degrade to "archive disabled" instead of crashing activation, and an ABI-mismatched binding surfaces the underlying error plus rebuild remedy (§5.6/§5.7). The module also owns the open + first-run DDL step (connection pragmas applied on every open per section 5.5) so ContextArchiveService only tracks module state around it.
 */

import { createRequire } from "node:module"
import * as path from "node:path"

/** Minimal structural surface of the native driver used by this module. Deliberately not imported (not even as a type) so no dependency on `better-sqlite3` or its community types package ever enters the bundle graph; the real class returned at runtime satisfies these shapes structurally. */
export interface SqlStatement {
	run(...params: unknown[]): { changes: number }
	get<T = Record<string, unknown>>(...params: unknown[]): T | undefined
	all<T = Record<string, unknown>>(...params: unknown[]): T[]
}

type TransactionalFn<Args extends unknown[], R> = (...args: Args) => R

export interface SqlDatabase {
	prepare(sql: string): SqlStatement
	exec(sql: string): void
	pragma(name: string, options?: { simple?: boolean }): unknown
	close(): void
	transaction<Args extends unknown[], R>(fn: TransactionalFn<Args, R>): TransactionalFn<Args, R>
}

type DatabaseCtor = new (filename: string, options?: Record<string, unknown>) => SqlDatabase

/** Structural shape of the require() result across CJS/ESM interop; narrowed by typeof guards below. */
type DriverModule = DatabaseCtor | { default?: unknown }

function logWarn(message: string): void {
	console.warn(`[jabberwock] [context-archive] ${message}`)
}

/** Load the native driver lazily and guard every failure mode (missing module in VSIX production packaging, failed native binding) so callers can degrade to "archive disabled" instead of throwing. */
export function loadDatabaseDriver(): DatabaseCtor | null {
	try {
		const req = createRequire(typeof __filename === "string" ? __filename : path.join(process.cwd(), "noop.cjs"))
		// Single driver name per the design doc lock (LCM spec section 4.6): better-sqlite3 resolves from this package's node_modules in every runtime; no alternate electron-named build is installed or declared, so referencing one could never succeed and would only mislabel a real ABI mismatch as "production packaging". Inside an IDE extension host the binding may be compiled for plain Node instead of Electron: that load failure surfaces through logDriverLoadFailure with its rebuild remedy and degrades to "archive disabled" without crashing activation (ICG doc sections 5.6/5.7).
		const mod: DriverModule = req("better-sqlite3") as DriverModule
		if (typeof mod !== "function") {
			logWarn(
				`driver module resolved but is not a constructor (${String(typeof mod)}); context archive disabled. JSON persistence remains the source of truth.`,
			)
			return typeof mod.default === "function" ? (mod.default as DatabaseCtor) : null
		}
		return mod
	} catch (error) {
		logDriverLoadFailure(error)
		return null
	}
}

/** Log why the native driver could not be loaded, distinguishing the two degradation causes so operators can act on them. A missing module is expected in production VSIX packaging without node_modules and degrades silently per ICG doc section 5.6; a load failure of an installed binding (typically compiled for plain Node but running inside an IDE extension host with a different native ABI) must surface the underlying error plus the rebuild remedy, because it indicates a fixable environment gap rather than intended packaging behavior. */
function logDriverLoadFailure(error: unknown): void {
	const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
	if (/Cannot find module|ERR_MODULE_NOT_FOUND/i.test(reason)) {
		logWarn(
			"better-sqlite3 is not resolvable in this runtime; context archive disabled (VSIX production packaging without node_modules). JSON persistence remains the source of truth.",
		)
		return
	}
	logWarn(
		`better-sqlite3 failed to load (${reason}); context archive disabled. If running inside an IDE extension host, rebuild the native module for that runtime's ABI (e.g., npx @electron/rebuild -w better-sqlite3). JSON persistence remains the source of truth.`,
	)
}

/** Per-connection pragmas (ICG doc section 5.5). journal_mode is persistent in the file; busy_timeout and cache_size are per connection, so they are re-applied on every open. */
function applyConnectionPragmas(db: SqlDatabase): void {
	db.pragma("journal_mode=WAL")
	db.pragma("busy_timeout=5000")
	// [Q2 default] L2 page cache sized for >1 GB working sets without pressuring host memory budgets.
	db.pragma("cache_size=-65536")
}

/** Open the archive database and apply the first-run DDL (ICG doc section 5.5): construct the driver, apply the per-connection pragmas, then create the verbatim schema when the context_messages table does not exist yet (the schema has no IF NOT EXISTS). Throws when the driver constructor fails so the owning service routes to its disable-and-report failure path (§5.6/§5.7). */
export function openArchiveDatabase(
	dbPath: string,
	schemaSql: string,
	Driver: DatabaseCtor,
): { db: SqlDatabase; created: boolean } {
	const db = new Driver(dbPath, { verbose: null }) as SqlDatabase
	applyConnectionPragmas(db)

	const tableRow = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='context_messages'")
		.get<{ name: string }>()
	if (!tableRow) {
		db.exec(schemaSql)
		return { db, created: true }
	}
	return { db, created: false }
}
