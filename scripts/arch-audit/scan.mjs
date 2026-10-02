#!/usr/bin/env node
/**
 * scan.mjs — CLI аудита архитектуры v2.
 *
 *   node scripts/arch-audit/scan.mjs backend
 *   node scripts/arch-audit/scan.mjs backend frontend/src
 *   node scripts/arch-audit/scan.mjs backend --top 40 --json reports/arch-audit.json
 *   node scripts/arch-audit/scan.mjs backend --type NO-SLOT,FORWARD-ONLY
 */
import { Project } from "ts-morph"
import { scan } from "./engine.mjs"
import { ROLES } from "./arch.config.mjs"

const VALUE_FLAGS = new Set(["top", "json", "type"])
const argv = process.argv.slice(2)
const opts = Object.create(null)
const roots = []
for (let i = 0; i < argv.length; i++) {
	const a = argv[i]
	if (!a.startsWith("--")) {
		roots.push(a)
		continue
	}
	const body = a.slice(2)
	const eq = body.indexOf("=")
	if (eq !== -1) {
		opts[body.slice(0, eq)] = body.slice(eq + 1)
		continue
	}
	const next = argv[i + 1]
	if (VALUE_FLAGS.has(body) && next && !next.startsWith("--")) {
		opts[body] = next
		i++
	} else {
		opts[body] = true
	}
}
const getFlag = (name, def) => (name in opts ? opts[name] : def)
const top = Number(getFlag("top", 15)) || 15
const jsonOut = typeof getFlag("json", null) === "string" ? getFlag("json", null) : null
const typeFilter = typeof getFlag("type", null) === "string" ? String(getFlag("type", null)).split(",") : null
const silent = Boolean(getFlag("silent", false))

const targets = roots.length ? roots : ["backend"]

const project = new Project({
	skipAddingFilesFromTsConfig: true,
	skipFileDependencyResolution: true,
	compilerOptions: { allowJs: false, target: 99, noResolve: true },
})
const patterns = []
for (const t of targets) {
	patterns.push(`${t}/**/*.ts`)
	patterns.push(`!${t}/**/node_modules/**`)
	patterns.push(`!${t}/**/dist/**`)
	patterns.push(`!${t}/**/build/**`)
	patterns.push(`!${t}/**/.turbo/**`)
}
project.addSourceFilesAtPaths(patterns)

const violations = scan(project, targets.join(" "))
const shown = typeFilter ? violations.filter((v) => typeFilter.includes(v.type)) : violations

/* ── агрегация ──────────────────────────────────────────────────────── */
const byType = new Map()
for (const v of shown) {
	if (!byType.has(v.type)) byType.set(v.type, [])
	byType.get(v.type).push(v)
}
const byFile = new Map()
for (const v of shown) byFile.set(v.file, (byFile.get(v.file) ?? 0) + 1)
const byMove = new Map()
for (const v of shown) {
	if (!v.moveTo) continue
	byMove.set(v.moveTo, (byMove.get(v.moveTo) ?? 0) + 1)
}

const errors = shown.filter((v) => v.severity === "error").length
const warns = shown.length - errors

/* ── вывод ──────────────────────────────────────────────────────────── */
if (!silent) {
	console.log(`\n=== ARCH AUDIT v2: ${targets.join(", ")} ===`)
	console.log(`файлов: ${project.getSourceFiles().length}   нарушений: ${shown.length}   (error: ${errors}, warn: ${warns})`)
	console.log(`типов нарушений: ${byType.size}\n`)

	for (const [type, list] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
		console.log(`\n── ${type} (${list.length}) ${"─".repeat(Math.max(0, 50 - type.length))}`)
		for (const v of list.slice(0, top)) {
			console.log(`  ${v.file}:${v.line}`)
			console.log(`      ${v.symbol}${v.symbol ? " — " : ""}${v.detail}`)
			if (v.moveTo) console.log(`      → КУДА: ${v.moveTo}`)
		}
		if (list.length > top) console.log(`  … +${list.length - top} ещё`)
	}

	console.log(`\n── ТОП ФАЙЛОВ ──────────────────────────────────────`)
	for (const [f, c] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) {
		console.log(`  ${String(c).padStart(4)}  ${f}`)
	}

	console.log(`\n── КУДА ПЕРЕНОСИТЬ (сводка) ────────────────────────`)
	for (const [m, c] of [...byMove.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${String(c).padStart(4)}  → ${m}`)
	}
	console.log()
}

if (jsonOut) {
	const { writeFileSync, mkdirSync } = await import("node:fs")
	const { dirname } = await import("node:path")
	mkdirSync(dirname(jsonOut), { recursive: true })
	writeFileSync(
		jsonOut,
		JSON.stringify({ roots: targets, total: shown.length, errors, warns, byType: Object.fromEntries(byType), byMove: Object.fromEntries(byMove) }, null, 2),
	)
	if (!silent) console.log(`json → ${jsonOut}`)
}

// Справочник ролей — печатается по --roles
if (getFlag("roles", false)) {
	console.log(`\n── РОЛИ (whitelist) ────────────────────────────────`)
	for (const [k, r] of Object.entries(ROLES)) {
		console.log(`  ${k.padEnd(16)} ${r.home}`)
		console.log(`      may:    ${r.may.join("; ")}`)
		console.log(`      mayNot: ${r.mayNot.join("; ")}`)
	}
}

process.exitCode = errors > 0 && !getFlag("no-fail", false) ? 1 : 0
