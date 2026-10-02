/**
 * Loader for the MACHINE-GENERATED debt ledger.
 *
 * The ledger itself lives in `reports/lint-debt.json` and is produced by `pnpm lint:debt` from a
 * real ESLint run — it is DATA, never hand-written, and it is the ONLY place where pre-existing
 * violations are recorded. Rules stay total; nothing here names a file for a rule to skip.
 *
 * Shape:
 *   { "local/no-shadow-store": { "backend/features/x.ts::moduleMutableState": 1 } }
 *   key   = "<repo-relative file>::<eslint messageId>"
 *   value = how many findings of that kind the file is allowed to keep
 *
 * `JABBERWOCK_LINT_DEBT_OFF=1` disables the ledger entirely. That is what the generator uses: it
 * has to observe EVERY violation to rebuild the ledger, so it cannot run with the ledger applied.
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPORT_PATH = path.resolve(HERE, "../../../reports/lint-debt.json")

/** Ledger is OFF while regenerating, so the generator sees the full violation set. */
const DEBT_DISABLED = process.env.JABBERWOCK_LINT_DEBT_OFF === "1"

function loadLedger() {
	if (DEBT_DISABLED) return {}
	if (!existsSync(REPORT_PATH)) return {}
	try {
		return JSON.parse(readFileSync(REPORT_PATH, "utf8"))
	} catch {
		return {}
	}
}

const ledger = loadLedger()

/**
 * The `debt` option value for one rule.
 * @param {string} ruleId
 * @returns {Record<string, number>}
 */
export function debtFor(ruleId) {
	return ledger[ruleId] ?? {}
}
