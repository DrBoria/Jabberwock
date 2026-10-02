#!/usr/bin/env node
/**
 * check-dead-code.mjs — unused file / export / type detector (part of `pnpm check-arch`).
 *
 * WHY a two-engine design:
 *   knip alone produces false positives in THIS repo. The v4 layout deliberately keeps the
 *   connectors TypeScript-isolated: `backend/esbuild.mjs` resolves `@features/*`, `@shared/*`,
 *   `@connectors/*`, `@extension-activation/*` … for the whole bundle from
 *   `backend/tsconfig.json`, while a connector tsconfig either has no `paths` at all or maps
 *   aliases to local declaration stubs. A tsconfig-based resolver (knip) therefore cannot
 *   follow connector → backend, and every file reached only through such an alias looks dead.
 *   Measured on the first run: 22 of 93 "unused files" were imported through an alias.
 *
 *   So a finding is reported only when BOTH engines agree:
 *     engine 1 — knip: the file/symbol is unreachable from any entry point;
 *     engine 2 — this script's own import-graph scan: no source file imports it by path or name.
 *   The intersection is high-precision. The cost is that a symbol whose NAME still appears as a
 *   word somewhere else (a comment, a doc, a string) is not reported — deliberate: a missed dead
 *   symbol is cheap, a false accusation is not.
 *
 * Two categories, with different verdicts:
 *   deadFile      — knip: unreachable AND nothing imports it → nothing references the file.
 *   unusedExport  — knip: the export is never imported → dead API surface. It may still be used
 *                   INSIDE its own file, in which case the fix is to drop the `export` keyword.
 *
 * Modes:
 *   node scripts/check-dead-code.mjs           compare with the baseline; exit 1 on NEW dead code
 *   node scripts/check-dead-code.mjs --write   record the current findings as the baseline
 *   node scripts/check-dead-code.mjs --list    print every current finding (no gate)
 *
 * The baseline may only SHRINK. New dead code fails the gate; resolved entries are reported so
 * the baseline can be shrunk deliberately.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BASELINE_PATH = path.join(ROOT, "reports", "dead-code-baseline.json")
const WRITE = process.argv.includes("--write")
const LIST = process.argv.includes("--list")

const SRC_ROOTS = ["backend", "frontend/src", "apps", "packages", "connectors", "scripts", "tests"]
const SKIP_DIRS = new Set([
	"node_modules",
	"dist",
	"build",
	"out",
	".turbo",
	".next",
	"coverage",
	".git",
	"DebugMCP",
	"loseless-context",
	"md-todo-mcp",
])

// ── engine 2: our own source index ────────────────────────────────────────────
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
		else if (/\.(ts|tsx|mjs|js|jsx)$/.test(e.name)) out.push(p)
	}
	return out
}

const files = SRC_ROOTS.flatMap((r) => walk(path.join(ROOT, r)))
const rel = (f) => (f.startsWith(`${ROOT}/`) ? f.slice(ROOT.length + 1) : f)

const SPEC_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g
const NAMED_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s*from/g

const specifiers = new Set()
const importedNames = new Set()
const contents = new Map()

for (const f of files) {
	let src
	try {
		src = readFileSync(f, "utf8")
	} catch {
		continue
	}
	contents.set(rel(f), src)
	for (const m of src.matchAll(SPEC_RE)) specifiers.add(m[1])
	for (const m of src.matchAll(NAMED_RE)) {
		for (const part of m[1].split(",")) {
			const name = part.trim().split(/\s+as\s+/).pop()?.trim()
			if (name) importedNames.add(name)
		}
	}
}

// Whole-word index: identifier -> up to 3 distinct files containing it. Two or more
// distinct files means the name is "seen elsewhere" for any single declaring file.
const WORD_RE = /\b[A-Za-z_$][A-Za-z0-9_$]*\b/g
const wordFiles = new Map()
for (const [file, src] of contents) {
	for (const m of src.matchAll(WORD_RE)) {
		const name = m[0]
		let set = wordFiles.get(name)
		if (!set) {
			set = new Set()
			wordFiles.set(name, set)
		}
		if (set.size < 3) set.add(file)
	}
}

/** Does any specifier in the repo point at this file? (alias tail matching) */
function hasImporter(file) {
	const noExt = file.replace(/\.(tsx?|mjs|js|jsx)$/, "")
	const segs = noExt.split("/")
	const tails = [segs.slice(-2).join("/"), segs.slice(-3).join("/")].filter(Boolean)
	for (const s of specifiers) {
		if (tails.some((t) => s === t || s.endsWith(`/${t}`))) return true
	}
	return false
}

/** Does the name still appear as a whole word anywhere outside its own file? */
function nameSeenElsewhere(file, name) {
	if (importedNames.has(name)) return true
	const set = wordFiles.get(name)
	if (!set || set.size === 0) return false
	if (set.size >= 2) return true
	return [...set][0] !== file
}

// ── engine 1: knip ────────────────────────────────────────────────────────────
const knipBin = path.join(ROOT, "node_modules", ".bin", "knip")
if (!existsSync(knipBin)) {
	console.error("check-dead-code: knip is not installed (run pnpm install)")
	process.exit(1)
}

let raw
try {
	raw = execFileSync(
		knipBin,
		["--include", "files,exports,types", "--no-progress", "--reporter", "json"],
		{ cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	)
} catch (err) {
	// knip exits 1 when it finds issues — stdout still holds the report
	raw = err.stdout
	if (!raw) {
		console.error("check-dead-code: knip produced no report")
		console.error(String(err.stderr ?? err).slice(0, 2000))
		process.exit(1)
	}
}

const report = JSON.parse(raw)

const deadFiles = []
for (const entry of report.files ?? []) {
	const file = rel(typeof entry === "string" ? entry : entry.file)
	// engine-2 veto: something imports it → knip simply could not resolve the alias
	if (!hasImporter(file)) deadFiles.push(file)
}

const deadSymbols = []
for (const issue of report.issues ?? []) {
	const file = rel(issue.file)
	for (const kind of ["exports", "types"]) {
		for (const sym of issue[kind] ?? []) {
			if (nameSeenElsewhere(file, sym.name)) continue
			deadSymbols.push(`${file}::${sym.name}`)
		}
	}
}

const findings = {
	deadFile: [...new Set(deadFiles)].sort(),
	unusedExport: [...new Set(deadSymbols)].sort(),
}
const counts = { deadFile: findings.deadFile.length, unusedExport: findings.unusedExport.length }

if (WRITE || !existsSync(BASELINE_PATH)) {
	writeFileSync(BASELINE_PATH, `${JSON.stringify(findings, null, "\t")}\n`)
	console.log(`check-dead-code: baseline written to ${rel(BASELINE_PATH)} (--write)`)
	console.log(`  ${JSON.stringify(counts)}`)
	process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
const regressions = []
const resolved = []
for (const key of Object.keys(findings)) {
	const known = new Set(baseline[key] ?? [])
	for (const f of findings[key]) if (!known.has(f)) regressions.push(`${key}: ${f}`)
	const now = new Set(findings[key])
	for (const f of baseline[key] ?? []) if (!now.has(f)) resolved.push(`${key}: ${f}`)
}

if (LIST) {
	console.log(`dead files (${counts.deadFile}) — nothing references the file:`)
	for (const f of findings.deadFile) console.log(`  ${f}`)
	console.log(`\nunused exports (${counts.unusedExport}) — exported but never imported:`)
	for (const f of findings.unusedExport) console.log(`  ${f}`)
	process.exit(0)
}

if (regressions.length > 0) {
	console.error(`check-dead-code: ${regressions.length} NEW piece(s) of dead code:\n`)
	for (const r of regressions.slice(0, 60)) console.error(`  ✖ ${r}`)
	if (regressions.length > 60) console.error(`  … and ${regressions.length - 60} more`)
	console.error(
		"\nA `deadFile` is referenced by nothing at all. An `unusedExport` is never imported —\n" +
			"knip resolves the whole graph, so this is not a resolution artefact. Fix:\n" +
			"  • used only inside its own file → drop the `export` keyword;\n" +
			"  • used nowhere → delete it;\n" +
			"  • intentional public/served API → mark it `/** @public */` (knip honours the tag).\n" +
			"Exporting a symbol is NOT evidence that it is used. Do not add it to the baseline.",
	)
	process.exit(1)
}

console.log(`check-dead-code: OK — no new dead code (${JSON.stringify(counts)})`)
if (resolved.length > 0) {
	console.log(`  ↓ ${resolved.length} finding(s) resolved — shrink the baseline with --write:`)
	for (const r of resolved.slice(0, 20)) console.log(`      ${r}`)
}
