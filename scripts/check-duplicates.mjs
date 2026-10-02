#!/usr/bin/env node
/**
 * check-duplicates.mjs — structural duplicate detector (part of `pnpm check-arch`).
 *
 * WHY: the repo repeatedly grows SECOND implementations of the same concern in a
 * different feature folder (live examples: `chat/mcp/store.ts` vs
 * `settings/mcp/mcp-execution/`, and `chat/ask/{handlers,orchestrators,utils}.ts`
 * vs `chat/task/notifications/ask/{handlers,orchestrators,utils}.ts`). None of the
 * ESLint rules can see this: `no-duplicated-logic` only compares siblings inside
 * one folder, and `no-store-outside-store` checks model-name collisions only
 * WITHIN a single file. Both duplicates are invisible to every existing gate.
 *
 * WHAT it reports (deterministic, sorted — so the baseline diff is stable):
 *   1. MST model NAME defined in >1 file within the SAME area   → real collision
 *      (MST/bridge register stores BY NAME — `mstBridge.registerStore("X", …)`,
 *      so two models sharing a name silently break name-keyed lookup)
 *   2. the same MODEL mounted into >1 parent within the SAME area → split state
 *      (two independent instances of one store, only one of which is hydrated)
 *   3. exported symbol defined in >1 file within the SAME area   → the
 *      "second implementation of the same domain" signature
 *   4. file NAME carrying a legacy/duplicate marker (Legacy*, Old*, *Deprecated*,
 *      *Unused*, *Duplicate*, *Backup*) → an explicit "this is a copy" marker
 *
 * Cross-package twins (backend vs frontend) are NOT reported: v2 makes intents and
 * stores per-side by design.
 *
 * Modes:
 *   node scripts/check-duplicates.mjs           compare against the committed baseline;
 *                                               exit 1 on any NEW finding
 *   node scripts/check-duplicates.mjs --write   rewrite the baseline (a deliberate
 *                                               act — the baseline may only shrink)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BASELINE_PATH = path.join(ROOT, "reports", "duplicate-baseline.json")
const WRITE = process.argv.includes("--write")

const ROOTS = ["backend", "frontend/src", "apps/cli/src", "packages", "connectors"]
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", ".turbo", ".next", "coverage", "__mocks__"])
const MARKER_WORDS = new Set(["legacy", "deprecated", "obsolete", "unused", "duplicate", "old", "backup", "copyof"])

function walk(dir, out = []) {
	let entries
	try {
		entries = readdirSync(dir, { withFileTypes: true })
	} catch {
		return out
	}
	for (const e of entries) {
		if (SKIP_DIRS.has(e.name)) continue
		const p = path.join(dir, e.name)
		if (e.isDirectory()) walk(p, out)
		else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p)
	}
	return out
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/")

/** Top-level package + area, e.g. "backend/features", "frontend/features". */
function areaOf(p) {
	const seg = p.split("/")
	if (seg[0] === "backend") return `backend/${seg[1]}`
	if (seg[0] === "frontend") return `frontend/${seg[1]}`
	return `${seg[0]}/${seg[1]}`
}

/** Split a file/identifier into lower-cased words across camelCase + separators. */
function words(s) {
	return s
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(/[-_.\s]+/)
		.filter(Boolean)
		.map((w) => w.toLowerCase())
}

function collect() {
	const files = ROOTS.flatMap((r) => walk(path.join(ROOT, r)))
	const models = new Map()
	const mounts = new Map()
	const exports_ = new Map()
	const markers = []

	for (const f of files) {
		const src = readFileSync(f, "utf8")
		const r = rel(f)
		const push = (map, key) => {
			if (!map.has(key)) map.set(key, [])
			const l = map.get(key)
			if (!l.includes(r)) l.push(r)
		}
		for (const m of src.matchAll(/types\s*\.\s*model\s*\(\s*["'`]([A-Za-z0-9_$]+)["'`]/g)) push(models, m[1])
		for (const m of src.matchAll(/types\s*\.\s*(?:optional|maybe|array)\s*(?:<[^>]*>)?\s*\(\s*([A-Z][A-Za-z0-9_$]*)/g))
			push(mounts, m[1])
		for (const m of src.matchAll(/^export\s+(?:const|function|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/gm))
			push(exports_, m[1])
		if (words(path.basename(f).replace(/\.tsx?$/, "")).some((w) => MARKER_WORDS.has(w))) markers.push(r)
	}

	/** Only keep entries whose files all live in ONE area (cross-package twins are legit). */
	const sameArea = (map) => {
		const out = []
		for (const [name, fs_] of map) {
			if (fs_.length < 2) continue
			if (new Set(fs_.map(areaOf)).size !== 1) continue
			out.push(`${name} @ ${fs_.sort().join(" , ")}`)
		}
		return out.sort()
	}

	return {
		modelNameCollision: sameArea(models),
		modelMountedTwice: sameArea(mounts),
		duplicateExport: sameArea(exports_),
		legacyMarkerFile: [...new Set(markers)].sort(),
	}
}

const current = collect()
const currentCounts = Object.fromEntries(Object.entries(current).map(([k, v]) => [k, v.length]))

if (WRITE || !existsSync(BASELINE_PATH)) {
	writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, "\t")}\n`)
	console.log(`check-duplicates: baseline written to ${rel(BASELINE_PATH)} (--write)`)
	console.log(`  ${JSON.stringify(currentCounts)}`)
	process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
const regressions = []
for (const key of Object.keys(current)) {
	const known = new Set(baseline[key] ?? [])
	for (const finding of current[key]) {
		if (!known.has(finding)) regressions.push(`${key}: ${finding}`)
	}
}

const shrunk = []
for (const key of Object.keys(current)) {
	const now = new Set(current[key] ?? [])
	const stale = (baseline[key] ?? []).filter((f) => !now.has(f)).length
	if (stale > 0) shrunk.push(`${key}: ${stale} resolved entr(ies) — re-run with --write to shrink the baseline`)
}

if (regressions.length > 0) {
	console.error(`check-duplicates: ${regressions.length} NEW duplicate finding(s):\n`)
	for (const r of regressions) console.error(`  ✖ ${r}`)
	console.error(
		"\nA second implementation of an existing concern is not a new module — merge it into the\n" +
			"owning feature (one domain → one store, one set of actions/handlers). If the duplicate is\n" +
			"deliberate and reviewed, record it in reports/duplicate-baseline.json with --write.",
	)
	process.exit(1)
}

console.log(`check-duplicates: OK — no new duplication (${JSON.stringify(currentCounts)})`)
for (const s of shrunk) console.log(`  ↓ ${s}`)
