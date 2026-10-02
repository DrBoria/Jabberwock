#!/usr/bin/env node
/**
 * gen-lint-debt.mjs — regenerate `reports/lint-debt.json` from a REAL ESLint run.
 *
 * WHY: pre-existing violations must never be recorded as a hand-written list of paths inside a
 * rule (a rule that names files stops catching everything and starts catching only the places
 * somebody remembered). They are recorded once, here, as machine-produced data keyed by
 * `<file>::<messageId>` with a count.
 *
 * The ledger is only allowed to SHRINK: this script rewrites the ceiling to whatever the current
 * source actually violates. Running it is therefore a deliberate act — it is the ONE way to
 * accept existing debt, and `scripts/check-ledgers.mjs` fails the build if a count ever grows.
 *
 * `JABBERWOCK_LINT_DEBT_OFF=1` makes the rules ignore the current ledger, so this run observes
 * every violation rather than only the ones not yet grandfathered.
 *
 * Usage:
 *   node scripts/gen-lint-debt.mjs            rewrite the ledger
 *   node scripts/gen-lint-debt.mjs --dry-run  print the counts, change nothing
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const REPORT_PATH = path.join(ROOT, "reports", "lint-debt.json")
const DRY_RUN = process.argv.includes("--dry-run")

/** Rules whose findings are grandfathered through the generic ledger. */
const DEBT_RULES = [
	"local/no-shadow-store",
	"local/no-impure-utils",
	"local/no-empty-handlers",
	"local/no-passthrough",
	"local/no-classes",
	"local/no-feature-store",
]

/** Workspaces are DISCOVERED, never listed — a new package is covered automatically. */
function findLintablePackages() {
	const dirs = []
	const consider = (dir) => {
		const abs = path.join(ROOT, dir)
		if (existsSync(path.join(abs, "eslint.config.mjs")) || existsSync(path.join(abs, "eslint.config.js")))
			dirs.push(dir)
	}
	for (const top of ["backend", "frontend"]) consider(top)
	for (const group of ["apps", "connectors", "packages"]) {
		let entries = []
		try {
			entries = readdirSync(path.join(ROOT, group), { withFileTypes: true })
		} catch {
			continue
		}
		for (const e of entries) if (e.isDirectory()) consider(`${group}/${e.name}`)
	}
	return dirs
}

function runEslint(pkgDir) {
	const bin = path.join(ROOT, "node_modules", ".bin", "eslint")
	const args = [".", "--format", "json"]
	try {
		return execFileSync(bin, args, {
			cwd: path.join(ROOT, pkgDir),
			encoding: "utf8",
			maxBuffer: 256 * 1024 * 1024,
			env: { ...process.env, JABBERWOCK_LINT_DEBT_OFF: "1", CI: "true" },
		})
	} catch (err) {
		// ESLint exits non-zero when it finds anything — the JSON report is still on stdout.
		const out = typeof err.stdout === "string" ? err.stdout : ""
		if (out.trimStart().startsWith("[")) return out
		// No JSON report at all: ESLint died BEFORE linting (unloadable config, missing parser,
		// bad option). Returning "[]" here would silently drop every entry for this package from
		// the ledger — i.e. it would erase the very debt the ledger exists to record. Fail loudly.
		const detail = String(err.stderr || err.message || "")
			.split("\n")
			.find((l) => l.trim().length > 0)
		throw new Error(`${pkgDir}: eslint produced no JSON report — ${detail ?? "unknown error"}`)
	}
}

const ledger = {}
let scanned = 0

for (const pkgDir of findLintablePackages()) {
	scanned++
	let report
	try {
		report = JSON.parse(runEslint(pkgDir))
	} catch (err) {
		console.error(`gen-lint-debt: FATAL — ${err.message}`)
		console.error("Refusing to rewrite the ledger: that would erase debt instead of recording it.")
		process.exit(1)
	}
	if (!Array.isArray(report)) {
		console.error(`gen-lint-debt: FATAL — ${pkgDir}: eslint report is not an array`)
		process.exit(1)
	}
	for (const file of report) {
		const rel = path.relative(ROOT, file.filePath).replace(/\\/g, "/")
		for (const msg of file.messages ?? []) {
			if (!DEBT_RULES.includes(msg.ruleId)) continue
			const key = `${rel}::${msg.messageId ?? "(no-message-id)"}`
			ledger[msg.ruleId] ??= {}
			ledger[msg.ruleId][key] = (ledger[msg.ruleId][key] ?? 0) + 1
		}
	}
}

// deterministic output: rules in DEBT_RULES order, keys sorted
const ordered = {}
for (const rule of DEBT_RULES) {
	if (!ledger[rule]) continue
	ordered[rule] = Object.fromEntries(Object.entries(ledger[rule]).sort(([a], [b]) => a.localeCompare(b)))
}

const totals = Object.fromEntries(Object.entries(ordered).map(([r, v]) => [r, Object.values(v).reduce((a, b) => a + b, 0)]))

if (DRY_RUN) {
	console.log(`gen-lint-debt (dry run) — scanned ${scanned} package(s)`)
	for (const [rule, total] of Object.entries(totals)) console.log(`  ${rule}: ${total}`)
	process.exit(0)
}

writeFileSync(REPORT_PATH, `${JSON.stringify(ordered, null, "\t")}\n`)
console.log(`gen-lint-debt: wrote ${path.relative(ROOT, REPORT_PATH)} from ${scanned} package(s)`)
for (const [rule, total] of Object.entries(totals)) console.log(`  ${rule}: ${total}`)
