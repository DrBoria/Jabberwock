#!/usr/bin/env node
/**
 * check-rule-options — enforces the "rules are TOTAL, exceptions are PATTERNS" doctrine.
 *
 * WHY THIS EXISTS
 * ---------------
 * A lint rule that names specific files stops catching everything and starts catching only
 * the places that were listed. Concretely, enumerations of file paths / feature names inside
 * rule options are always WRONG in the same way:
 *
 *   - they only cover what was remembered at the time they were written;
 *   - they silently go stale (a renamed file keeps its exemption, a new file never gets one);
 *   - they hide real violations from the report, so the build looks green while the rule's
 *     premise is violated;
 *   - nobody — human or agent — can enumerate the whole repo by hand, so any list is a
 *     sampling, not a rule.
 *
 * The correct shape is:
 *
 *   1. the rule is TOTAL (it reports every occurrence of the pattern it describes);
 *   2. exceptions are ROLE patterns (`connectors/`, `.test.`, `*.d.ts`) — a KIND of file that
 *      cannot be a violation by construction — or a bare filename used as a convention;
 *   3. anything instance-specific goes into a MACHINE-GENERATED debt ledger keyed by
 *      (file, messageId), which is monotonic: it may only shrink.
 *
 * This checker scans every lint config for string literals inside rule-option arrays and fails
 * when an entry pins a location or enumerates identities.
 *
 * CLASSIFICATION
 * --------------
 *   glob (`*` / `?` present)                  → OK  (a pattern by construction)
 *   role token (`connectors/`, `.test.`, `dist/`, `__mocks__`) → OK (no extension)
 *   convention filename (`singleton.ts`)      → OK  (a name, and it matches anywhere)
 *   `@alias/some/specific/module`             → VIOLATION  pinnedPath
 *   `some/deep/relative/path`  (2+ slashes)   → VIOLATION  pinnedPath
 *   bare identifier in an identity-list option
 *     (`statelessFeatures`, `sanctionedBusNames`) → VIOLATION identityEnumeration
 *
 * Baseline: reports/rule-options-baseline.json (shrink-only). Run with --write to regenerate.
 *
 * Usage:
 *   node scripts/check-rule-options.mjs            # verify against the baseline
 *   node scripts/check-rule-options.mjs --list     # print every finding
 *   node scripts/check-rule-options.mjs --write    # rewrite the baseline
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const BASELINE_PATH = path.join(ROOT, "reports", "rule-options-baseline.json")
const WRITE = process.argv.includes("--write")
const LIST = process.argv.includes("--list")

/** Option keys whose arrays are lists of IDENTITIES (names of features/buses/files), not paths. */
const IDENTITY_LIST_KEY = /^(stateless|sanctioned|exempted?|ignore[d]?)([A-Z].*)?$|names$|names[A-Z]/i

/** Option keys whose arrays are lists of PATHS / globs. */
const PATH_LIST_KEY = /path|file|dir|allow|include|exempt|ignore/i

/**
 * Keys that SCOPE a rule (which files it applies to). Kept for documentation: a directory
 * PREFIX (`frontend/src/`) is legitimate there — it says "this rule governs this subtree" —
 * while a concrete FILE says "this rule is switched off for this one place".
 */
const SCOPE_KEYS = new Set(["includes", "roots", "files", "ignores", "default"])

/**
 * Standalone vendored / example projects with their own lockfile; they are outside the
 * workspace's lint graph, so their configs are not governed by this doctrine.
 */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "reports", "loseless-context", "DebugMCP", "md-todo-mcp"])

/**
 * Config files to audit (every lint config in the workspace).
 * @returns {string[]}
 */
function configFiles() {
	const found = []
	const walk = (dir, depth) => {
		if (depth > 3) return
		let entries
		try {
			entries = readdirSync(dir, { withFileTypes: true })
		} catch {
			return
		}
		for (const e of entries) {
			if (e.name.startsWith(".")) continue
			if (SKIP_DIRS.has(e.name)) continue
			const abs = path.join(dir, e.name)
			if (e.isDirectory()) {
				walk(abs, depth + 1)
				continue
			}
			if (e.name.startsWith("eslint.config.")) found.push(abs)
		}
	}
	walk(ROOT, 0)
	const base = path.join(ROOT, "packages", "config-eslint", "base.js")
	if (existsSync(base)) found.push(base)
	// rule sources may carry DEFAULT option arrays of their own
	const rulesDir = path.join(ROOT, "packages", "config-eslint", "rules")
	if (existsSync(rulesDir)) {
		for (const f of readdirSync(rulesDir)) {
			if (f.endsWith(".js")) found.push(path.join(rulesDir, f))
		}
	}
	return [...new Set(found)].sort()
}

/**
 * Strip comments, preserving line structure (so reported line numbers stay correct).
 * Without this, an option array carrying an explanatory comment (which may contain `(` or `{`)
 * is skipped by the array scanner — i.e. the checker would silently miss real offenders.
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
		.replace(/(^|[^:])\/\/[^\n]*/g, (_m, p1) => p1 + " ")
}

/**
 * Extract `key: [ "..." , "..." ]` groups from a JS source.
 * Deliberately a light textual scan: lint options are small literal arrays, and this checker
 * must not need a parser to run.
 * @param {string} src
 * @returns {{key: string, entries: string[], line: number}[]}
 */
function optionArrays(src) {
	const out = []
	const re = /([A-Za-z_$][\w$]*)\s*:\s*\[([^[\]]*)\]/g
	let m
	while ((m = re.exec(src)) !== null) {
		const body = m[2]
		// Object-form options (`paths: [{ name, message }]`) are not plain path lists; and a long
		// sentence is a human-readable message, not an option value.
		if (body.includes("=>") || body.includes("(") || body.includes("{")) continue
		const entries = [...body.matchAll(/["'`]([^"'`]*)["'`]/g)].map((x) => x[1])
		if (entries.length === 0) continue
		// only literal-string arrays (comments stripped of strings) qualify
		if (entries.some((e) => e.includes("\n"))) continue
		const line = src.slice(0, m.index).split("\n").length
		out.push({ key: m[1], entries, line })
	}
	return out
}

/**
 * Classify a single option entry.
 * @param {string} key
 * @param {string} entry
 * @returns {string | null} violation kind, or null when acceptable
 */
function classify(key, entry) {
	if (entry.includes("*") || entry.includes("?")) return null // explicit glob pattern
	if (entry.length > 100) return null // a description, not an option value
	// A trailing slash means a DIRECTORY PREFIX, which is always a role token: it governs a whole
	// subtree by declared role (`connectors/`, `integrations/`, `services/checkpoints/`). It can
	// never pin a single location — that is the anti-pattern this checker exists to catch.
	if (entry.endsWith("/")) return null
	const slashes = (entry.match(/\//g) ?? []).length
	// A NAMESPACE prefix (`@features/intents/`) names a role: an entire cross-cutting namespace
	// (the fiber intent bus, a connector namespace) that is never a feature's internal.
	if (entry.startsWith("@") && entry.endsWith("/")) return null
	if (entry.startsWith("@")) return "pinnedPath" // alias path → one exact module
	if (slashes >= 2) return "pinnedPath" // deep relative path → one exact location
	if (slashes === 1) {
		// one slash and no glob: a role token like `connectors/` … unless it names a file
		return /\.[a-z]+$/i.test(entry) ? "pinnedPath" : null
	}
	// no slash at all
	if (/^[A-Za-z_$][\w$]*$/.test(entry)) {
		if (IDENTITY_LIST_KEY.test(key) && !PATH_LIST_KEY.test(key)) return "identityEnumeration"
		return null
	}
	if (/\.(ts|tsx|js|mjs|cjs|json|d\.ts)$/i.test(entry)) {
		// A bare filename is acceptable as a CONVENTION (it matches anywhere in the repo).
		return null
	}
	return null
}

const findings = []
for (const file of configFiles()) {
	const src = stripComments(readFileSync(file, "utf8"))
	const rel = path.relative(ROOT, file).replace(/\\/g, "/")
	for (const { key, entries, line } of optionArrays(src)) {
		for (const entry of entries) {
			const kind = classify(key, entry)
			if (!kind) continue
			findings.push({ file: rel, key, entry, kind, line })
		}
	}
}

findings.sort((a, b) => `${a.file}::${a.key}::${a.entry}`.localeCompare(`${b.file}::${b.key}::${b.entry}`))

if (LIST) {
	for (const f of findings) console.log(`${f.file}:${f.line}\t[${f.kind}] ${f.key}[${JSON.stringify(f.entry)}]`)
	console.log(`\n${findings.length} finding(s)`)
}

if (WRITE) {
	const grouped = {}
	for (const f of findings) {
		const k = `${f.file}::${f.key}::${f.entry}`
		grouped[k] = { kind: f.kind, count: (grouped[k]?.count ?? 0) + 1 }
	}
	writeFileSync(BASELINE_PATH, `${JSON.stringify(grouped, null, "\t")}\n`)
	console.log(`check-rule-options: wrote ${path.relative(ROOT, BASELINE_PATH)} (${findings.length} finding(s))`)
	process.exit(0)
}

if (!existsSync(BASELINE_PATH)) {
	console.error(`check-rule-options: baseline missing at ${path.relative(ROOT, BASELINE_PATH)}`)
	console.error("Run: node scripts/check-rule-options.mjs --write")
	process.exit(1)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
const current = new Map()
for (const f of findings) {
	const k = `${f.file}::${f.key}::${f.entry}`
	current.set(k, (current.get(k) ?? 0) + 1)
}

const fixed = Object.keys(baseline).filter((k) => !current.has(k))
const added = [...current.keys()].filter((k) => !(k in baseline))

if (fixed.length > 0) {
	console.log("check-rule-options: offenders removed — shrink the baseline:")
	for (const k of fixed) console.log(`  - ${k}`)
	console.log("Run: node scripts/check-rule-options.mjs --write")
}
if (added.length > 0) {
	console.error("check-rule-options: NEW pinned paths / identity enumerations in rule options:")
	for (const k of added) console.error(`  + ${k}`)
	console.error(
		"\nA rule must be TOTAL. Express the exception as a ROLE pattern (a kind of file that\n" +
			"cannot be a violation by construction), or record the instance in the machine-generated\n" +
			"debt ledger (`debt: debtFor(\"<ruleId>\")`). Never add a file path or a name to a list.",
	)
}
if (fixed.length > 0 || added.length > 0) process.exit(1)
console.log(`check-rule-options: OK (${current.size} baselined, shrink-only)`)
