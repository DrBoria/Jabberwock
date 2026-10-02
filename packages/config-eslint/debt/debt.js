/**
 * THE generic debt mechanism — one implementation for every rule.
 *
 * DOCTRINE (user mandate): a rule must be TOTAL and PATTERN-BASED. It never carries a list of
 * concrete file paths — the moment a rule names files, it stops catching everything and starts
 * catching only the places somebody remembered to list.
 *
 * Pre-existing violations therefore live in ONE place: the machine-generated ledger
 * `reports/lint-debt.json`, produced by `pnpm lint:debt` from a real ESLint run. Nothing in it is
 * hand-written, and nothing in it disables a rule:
 *
 *   { "local/no-shadow-store": { "backend/features/x.ts::moduleMutableState": 1, ... } }
 *
 * The key is `<file>::<messageId>` and the value is how many findings of that KIND that file is
 * allowed to keep. Consequences:
 *
 *   - the rule still evaluates EVERY file and EVERY violation kind;
 *   - a file may keep at most its recorded count of one kind of violation — fixing one and adding
 *     a different one still fails, and adding a second of the same kind fails;
 *   - the ledger can only shrink (scripts/check-ledgers.mjs fails if a count grows);
 *   - no rule option ever mentions a path again.
 *
 * Usage inside a rule — intercept `context.report` once and every report site is filtered:
 *
 *     create(rawContext) {
 *         const context = applyDebt(rawContext, rawContext.options?.[0]?.debt)
 *         ...
 *     }
 */

import { existsSync } from "node:fs"
import path from "node:path"

/** @typedef {Record<string, number>} DebtLedger  key = "<file>::<messageId>", value = allowed count */

/**
 * Repo-root discovery WITHOUT hardcoding a path: walk up to the directory that holds the pnpm
 * workspace manifest. ESLint hands rules an ABSOLUTE filename, while the ledger keys are
 * repo-relative, and ESLint runs with cwd = the individual package — so the rule has to normalise
 * the same way the generator does, from any cwd.
 */
let cachedRoot = null
function repoRoot(from) {
	if (cachedRoot) return cachedRoot
	let dir = path.dirname(from)
	for (;;) {
		if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
			cachedRoot = dir
			return dir
		}
		const parent = path.dirname(dir)
		if (parent === dir) {
			cachedRoot = process.cwd()
			return cachedRoot
		}
		dir = parent
	}
}

/**
 * @param {string} absFilename
 * @returns {string} repo-relative, forward slashes
 */
function repoRelative(absFilename) {
	return path.relative(repoRoot(absFilename), absFilename).replace(/\\/g, "/")
}
/**
 * Build a per-(file, messageId) allowance filter backed by a ledger.
 * @param {DebtLedger | undefined} ledger
 */
function makeDebtFilter(ledger) {
	const allowed = ledger && typeof ledger === "object" ? ledger : {}
	/** how many findings of this exact (file, messageId) we have already grandfathered */
	const used = new Map()

	return {
		/**
		 * True when this finding is covered by the ledger and should NOT be reported.
		 * @param {string} filename repo-relative, forward slashes
		 * @param {string | undefined} messageId
		 */
		covers(filename, messageId) {
			const key = `${filename}::${messageId ?? "(no-message-id)"}`
			const budget = allowed[key] ?? 0
			if (budget <= 0) return false
			const spent = used.get(key) ?? 0
			if (spent >= budget) return false
			used.set(key, spent + 1)
			return true
		},
	}
}

/**
 * Wrap an ESLint rule context so that `report()` silently drops findings covered by the debt
 * ledger. Everything else on the context is inherited unchanged, so a rule body needs no other
 * change — which is the point: the debt mechanism is invisible to the rule's logic.
 *
 * Implemented with `Object.create` (prototype delegation) rather than a `Proxy`: ESLint defines
 * `report` as a non-configurable, non-writable own property, and a Proxy `get` trap is not allowed
 * to return a different value for such a property. Delegating keeps every other member reachable
 * with identical behaviour while letting us shadow `report` with an own property.
 *
 * @param {object} context
 * @param {DebtLedger | undefined} ledger
 */
export function applyDebt(context, ledger) {
	const filter = makeDebtFilter(ledger)
	const filename = repoRelative(context.filename ?? context.getFilename())
	const wrapped = Object.create(context)
	Object.defineProperty(wrapped, "report", {
		value: (descriptor) => {
			if (filter.covers(filename, descriptor?.messageId)) return
			context.report(descriptor)
		},
		writable: true,
		configurable: true,
		enumerable: true,
	})
	return wrapped
}
