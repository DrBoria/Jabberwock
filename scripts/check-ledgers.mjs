#!/usr/bin/env node
/**
 * check-ledgers.mjs — monotonic-debt guard for every allowlist in the repo.
 *
 * WHY: the whole lint strategy rests on allowlists that are documented as "may only
 * shrink" — the four ESLint debt ledgers, the v4 platform-purity baseline, and the
 * jscpd clone baseline. Nothing enforced that. Worse, `backend/eslint.config.mjs`
 * DERIVES its `vscode` allowlist from `reports/audit-platform.json` at lint time:
 * regenerating that artifact silently widens the allowlist while lint stays green.
 * This guard makes the whole family honest: a count that grows fails the build.
 *
 * Tracked counters:
 *   - packages/config-eslint/debt/{shadow-store,impure-utils,passthrough,empty-handlers}-debt.js
 *   - reports/audit-platform.json            → entries + backend-side entries (the lint allowlist)
 *   - reports/jscpd/jscpd-report.json        → clone count (when `pnpm dup-check` has run)
 *
 * Modes:
 *   node scripts/check-ledgers.mjs           compare with the snapshot; exit 1 on growth
 *   node scripts/check-ledgers.mjs --write   record the current counts as the new ceiling
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SNAPSHOT_PATH = path.join(ROOT, "reports", "ledger-snapshot.json")
const WRITE = process.argv.includes("--write")

// Machine-generated ledgers. Their ARRAY exports become counters automatically, so a new generated
// ledger (or a new list inside one) is picked up without editing this file. Nothing here is
// hand-maintained any more — that is the point.
const GENERATED_LEDGERS = ["packages/config-eslint/debt/import-debt.js"]

async function generatedCounters(relPath) {
	const abs = path.join(ROOT, relPath)
	if (!existsSync(abs)) return {}
	const mod = await import(pathToFileURL(abs).href)
	const base = path.basename(relPath, ".js")
	const out = {}
	for (const [name, value] of Object.entries(mod)) {
		if (Array.isArray(value)) out[`${base}:${name}`] = value.length
	}
	return out
}

function readJson(relPath) {
	const abs = path.join(ROOT, relPath)
	if (!existsSync(abs)) return null
	try {
		return JSON.parse(readFileSync(abs, "utf8"))
	} catch {
		return null
	}
}

const counts = {}

for (const relPath of GENERATED_LEDGERS) Object.assign(counts, await generatedCounters(relPath))

const platform = readJson("reports/audit-platform.json")
if (platform?.entries) {
	counts["audit-platform:entries"] = platform.entries.length
	counts["audit-platform:backend-allowlist"] = platform.entries.filter((e) => e.side === "backend").length
}

const jscpd = readJson("reports/jscpd/jscpd-report.json")
if (jscpd?.duplicates) counts["jscpd:clones"] = jscpd.duplicates.length

// The generic ESLint debt ledger. Rules are NOT enumerated: whatever `pnpm lint:debt` recorded
// becomes a counter here, so adding a rule with debt needs no edit in this file.
const lintDebt = readJson("reports/lint-debt.json")
if (lintDebt) {
	for (const [ruleId, entries] of Object.entries(lintDebt)) {
		const total = Object.values(entries).reduce((a, b) => a + b, 0)
		counts[`lint-debt:${ruleId.replace(/^local\//, "")}`] = total
	}
}

// Dead-code baseline sizes. These duplicate the checker's own baseline on purpose:
// appending entries to reports/dead-code-baseline.json silences `check-dead-code`,
// but it also GROWS these counters — which this guard rejects. Editing the baseline
// to hide dead code can therefore not pass the gate unnoticed.
const deadCode = readJson("reports/dead-code-baseline.json")
if (deadCode) {
	counts["dead-code:files"] = (deadCode.deadFile ?? []).length
	counts["dead-code:exports"] = (deadCode.unusedExport ?? []).length
}

if (WRITE || !existsSync(SNAPSHOT_PATH)) {
	writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(counts, null, "\t")}\n`)
	console.log(`check-ledgers: snapshot written to ${path.relative(ROOT, SNAPSHOT_PATH)} (--write)`)
	for (const [k, v] of Object.entries(counts)) console.log(`  ${k} = ${v}`)
	process.exit(0)
}

const baseline = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"))
const grown = []
const shrunk = []
const unknown = []

for (const [key, value] of Object.entries(counts)) {
	const before = baseline[key]
	if (before === undefined) {
		// A counter that is absent from the snapshot appears when an optional tool has run
		// for the first time (e.g. `pnpm dup-check` produces reports/jscpd/). Informational —
		// the tracked ledgers below always exist, so their growth is still caught.
		unknown.push(`${key} = ${value}`)
		continue
	}
	if (value > before) grown.push(`${key}: ${before} → ${value}  (GREW by ${value - before})`)
	else if (value < before) shrunk.push(`${key}: ${before} → ${value}  (shrunk by ${before - value})`)
}

for (const key of Object.keys(baseline)) {
	if (!(key in counts)) console.log(`  ⚠ ${key}: counter no longer produced (check the corresponding tool)`)
}

if (grown.length > 0) {
	console.error(`check-ledgers: ${grown.length} debt ledger(s) GREW:\n`)
	for (const g of grown) console.error(`  ✖ ${g}`)
	console.error(
		"\nDebt ledgers may only shrink. Fix the violation instead of grandfathering it, or (for a\n" +
			"deliberate, reviewed exception) delete an older entry in the same change. Never just\n" +
			"re-run with --write — that turns the ledger into a rubber stamp.",
	)
	process.exit(1)
}

console.log("check-ledgers: OK — no ledger grew")
for (const [k, v] of Object.entries(counts)) console.log(`  ${k} = ${v}${baseline[k] !== undefined && baseline[k] !== v ? ` (was ${baseline[k]})` : ""}`)
for (const s of shrunk) console.log(`  ↓ ${s}`)
for (const u of unknown) console.log(`  ℹ untracked counter: ${u}`)
if (shrunk.length > 0) console.log("\n  Shrink the snapshot with: node scripts/check-ledgers.mjs --write")
