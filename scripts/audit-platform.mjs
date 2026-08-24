#!/usr/bin/env node
/**
 * audit-platform.mjs — v4 platform-purity audit (G6/G7).
 *
 * Plan: plans/architecture-v4-connector-abstraction.md §8.2, Phase A0 (§11), baselines §2.3/§2.4.
 *
 * What it scans (direct references only; transitive imports are out of scope by design):
 *   backend  (all .ts/.tsx under <backendDir>):
 *     - static:         `import ... from "vscode"` / side-effect `import "vscode"` / re-exports
 *     - require:        dynamic `require("vscode")` — invisible to ESLint no-restricted-imports (plan §8.2)
 *     - dynamic-import: value `import("vscode")` AND type-only `import("vscode").X` references (§2.3 L14)
 *   frontend (all .ts/.tsx under <frontendDir>/src):
 *     - window-listener:  `.addEventListener("message", ...)` (host-transport inbound, §2.4 class A/B split fixed in Phase D)
 *     - postMessage:      raw `.postMessage(` call sites (~90 outbound + DOM-local; inventory per §2.4)
 *     - acquireVsCodeApi: direct global usage outside the connector implementation (§7.3 — only bootstrap may keep it after D1)
 *
 * Modes:
 *   node scripts/audit-platform.mjs                  check mode — compares against committed baseline report;
 *                                                    FAILS (exit 1) on any NEW violation or count increase,
 *                                                    exit 0 when nothing grew. Exit 2 if no baseline exists yet.
 *   node scripts/audit-platform.mjs --write-baseline rewrites the committed artifact with the current inventory
 *                                                    (run at every phase step so git history shows monotonic decrease).
 *
 * Artifact: reports/audit-platform.json — keyed by side|file|kind → count; line numbers are informational only.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const REPORT_REL = "reports/audit-platform.json"
const REPORT_PATH = path.join(ROOT, REPORT_REL)

// ——— directory resolution: stable across the Phase A rename (src→backend, webview-ui→frontend) ———
function resolveDir(preferred, fallback) {
	if (existsSync(path.join(ROOT, preferred))) return preferred
	if (fallback && existsSync(path.join(ROOT, fallback))) return fallback
	return null
}

const backendDir = resolveDir("backend", "src")
const frontendRootDir = resolveDir("frontend", "webview-ui")
if (!backendDir || !frontendRootDir) {
	console.error(`audit-platform: cannot locate backend (tried ${["backend", "src"].join("/")}) or frontend root dir from ${ROOT}`)
	process.exit(2)
}

// ——— scan patterns (§8.2; the require pattern is verbatim from the plan, invisible to static analysis/ESLint) ———
const BACKEND_PATTERNS = [
	{ kind: "static", re: /\bfrom\s+["']vscode["']/ }, // import/export ... from "vscode" (multi-line imports carry `from` on their last line)
	{ kind: "static", re: /^\s*import(?:\s+type)?\s*["']vscode["']/ }, // side-effect / type-only bare import without a from-clause
	{ kind: "require", re: /\brequire\(\s*["']vscode["']\s*\)/ }, // dynamic require — plan §8.2 explicit pattern (e.g. mcp-hub/notifications.ts)
	{ kind: "dynamic-import", re: /(^|[^.\w$])import\(\s*["']vscode["']\s*\)/ }, // value import("vscode") AND type-only import("vscode").X (§2.3 L14)
]

// frontend inventory scope = app-level code under <frontend>/src only (config/build files are not scanned here; §8.2 covers them via ESLint ignores + vite externals)
const FRONTEND_PATTERNS = [
	{ kind: "window-listener", re: /\.addEventListener\(\s*["']message["']/ },
	{ kind: "postMessage", re: /\.postMessage\s*\(/ },
	{ kind: "acquireVsCodeApi", re: /\bacquireVsCodeApi\b/ },
]

const SKIP_DIRS = new Set(["node_modules", "dist", "out", "build", ".turbo", "coverage"])
const TS_EXT_RE = /\.(ts|tsx)$/

function walk(dir, out) {
	let entries
	try {
		entries = readdirSync(dir, { withFileTypes: true })
	} catch {
		return
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) walk(full, out)
		} else if (TS_EXT_RE.test(entry.name)) {
			out.push(full)
		}
	}
}

/** Strip block comments across the whole file; returns array of lines with commented spans blanked. */
function stripBlockComments(source) {
	const out = []
	let inComment = false
	for (const line of source.split(/\r?\n/)) {
		if (!inComment) {
			const start = line.indexOf("/*")
			if (start === -1) {
				out.push(line)
				continue
			}
			const end = line.indexOf("*/", start + 2)
			if (end === -1) {
				inComment = true
				out.push(line.slice(0, start))
			} else {
				out.push(line.slice(0, start) + " ".repeat(end + 2 - start))
			}
		} else {
			const end = line.indexOf("*/")
			if (end === -1) out.push("")
			else {
				inComment = false
				out.push(" ".repeat(end + 2))
			}
		}
	}
	return out
}

function scanFile(file, patterns) {
	const rel = path.relative(ROOT, file).split(path.sep).join("/")
	let source
	try {
		source = readFileSync(file, "utf8")
	} catch {
		return []
	}
	const lines = stripBlockComments(source)
	const hits = new Map() // kind -> {count, lines[]}
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (!line || /^\s*\/\//.test(line)) continue // skip full-line comments — commented-out imports are not violations
		for (const p of patterns) {
			if (p.re.test(line)) {
				const h = hits.get(p.kind) ?? { count: 0, lines: [] }
				h.count += 1
				if (h.lines.length < 25) h.lines.push(i + 1)
				hits.set(p.kind, h)
			}
		}
	}
	return [...hits.entries()].map(([kind, v]) => ({ file: rel, kind, count: v.count, lines: v.lines }))
}

function gitHead() {
	const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" })
	return r.status === 0 ? r.stdout.trim().slice(0, 12) : null
}

const writeBaselineFlag = process.argv.includes("--write-baseline")

// ——— run scans ———
const currentEntries = []
{
	const backendFiles = []
	walk(path.join(ROOT, backendDir), backendFiles)
	for (const f of backendFiles) {
		for (const e of scanFile(f, BACKEND_PATTERNS)) {
			currentEntries.push({ ...e, side: "backend" })
		}
	}

	const frontendSrc = path.join(ROOT, frontendRootDir, "src")
	if (existsSync(frontendSrc)) {
		const frontendFiles = []
		walk(frontendSrc, frontendFiles)
		for (const f of frontendFiles) {
			for (const e of scanFile(f, FRONTEND_PATTERNS)) {
				currentEntries.push({ ...e, side: "frontend" })
			}
		}
	}
}

currentEntries.sort((a, b) => a.file.localeCompare(b.file) || a.kind.localeCompare(b.kind))

function summarize(entries) {
	const bySide = (side) => entries.filter((e) => e.side === side)
	const filesOf = (list) => new Set(list.map((e) => e.file)).size
	return {
		backendFiles: filesOf(bySide("backend")),
		backendViolations: bySide("backend").reduce((s, e) => s + e.count, 0),
		frontendFiles: filesOf(bySide("frontend")),
		frontendUsages: bySide("frontend").reduce((s, e) => s + e.count, 0),
	}
}

const summary = summarize(currentEntries)
console.log(`\n=== audit-platform — v4 purity inventory (G6/G7) ===`)
console.log(
	`backend dir : ${backendDir}/   (${summary.backendFiles} files with direct vscode references / ${summary.backendViolations} refs; plan baseline ≈168 files §2.3)`
)
const frontendSrcRel = path.relative(ROOT, path.join(frontendRootDir, "src"))
console.log(
	`frontend src: ${frontendSrcRel}/  (${summary.frontendFiles} files with window/postMessage usages / ${summary.frontendUsages} sites; plan baseline ≈55 files §2.4)`
)

if (writeBaselineFlag) {
	const report = {
		note: "v4 platform-purity baseline artifact — committed at every phase step; git history must show monotonic decrease. Plan §8.2/§11 A0.",
		generatedAt: new Date().toISOString(),
		commit: gitHead(),
		backendDir,
		frontendSrcDir: frontendSrcRel,
		summary,
		entries: currentEntries.map(({ side, file, kind, count }) => ({ side, file, kind, count })), // lines omitted from artifact (informational only)
	}
	mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
	writeFileSync(REPORT_PATH, JSON.stringify(report, null, "\t") + "\n", "utf8")
	console.log(`\nwrote baseline → ${REPORT_REL}`)
	process.exit(0)
}

// ——— check mode ———
if (!existsSync(REPORT_PATH)) {
	console.error(`no committed baseline at ${REPORT_REL} — create it with: node scripts/audit-platform.mjs --write-baseline`)
	process.exit(2)
}
const baseline = JSON.parse(readFileSync(REPORT_PATH, "utf8"))
const baseMap = new Map(baseline.entries.map((e) => [`${e.side}|${e.file}|${e.kind}`, e.count]))

let failures = 0
for (const e of currentEntries) {
	const key = `${e.side}|${e.file}|${e.kind}`
	const prev = baseMap.get(key) ?? 0
	if (!baseMap.has(key) || e.count > prev) {
		failures += 1
		console.error(`NEW/GROWN: ${key} — was ${prev}, now ${e.count}${e.lines ? ` (lines ${e.lines.slice(0, 5).join(",")})` : ""}`)
	}
}

// informational: entries that shrank since baseline (expected during migration; re-baseline at the next phase step)
let shrunk = 0
for (const [key, prev] of baseMap) {
	const nowEntry = currentEntries.find((e) => `${e.side}|${e.file}|${e.kind}` === key)
	if (!nowEntry || nowEntry.count < prev) shrunk += 1
}

if (failures > 0) {
	console.error(`\nFAIL: ${failures} new/grown violation(s). Purity list may only shrink — fix or revert. Plan §8.2.`)
	process.exit(1)
}
console.log(shrunk > 0 ? `\nok — no growth; ${shrunk} baseline entr${shrunk === 1 ? "y" : "ies"} shrank (re-baseline at next phase step: --write-baseline)` : "\nok — inventory matches committed baseline")
