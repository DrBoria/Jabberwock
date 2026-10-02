import fs from "node:fs"
import path from "node:path"
import tseslint from "typescript-eslint"

const parser = tseslint.parser

/**
 * Detects duplicated LOGIC (not just duplicated names) between top-level
 * functions in sibling files of the same folder.
 *
 * How it works:
 *  1. For the linted file, collect top-level functions (function declarations,
 *     exported functions, const arrow/function expressions).
 *  2. Read every sibling .ts/.tsx file in the same directory, parse it, and
 *     collect its top-level functions (cached by mtime+size).
 *  3. Normalize each function BODY: strip comments, replace every non-keyword
 *     identifier with `ID` (length-preserving, so source ranges stay valid).
 *     String/number literals are kept — they are part of the logic.
 *  4. Compare token multisets with the Dice coefficient. A function whose
 *     normalized body is >= `similarity` (default 0.9) to a function in a
 *     sibling file is reported.
 *
 * Because identifiers are normalized, the rule catches "same logic, different
 * variable names" — the case a name-based check can never see. Because string
 * literals are kept, "same shape, different content" (legitimate handler
 * families) is NOT flagged.
 *
 * Scope is deliberately sibling-folder: that is where copy-paste duplication
 * actually lives, and it keeps the rule fast and low-noise.
 */

function isExcluded(filePath) {
	const norm = filePath.replace(/\\/g, "/")
	if (
		norm.includes("/node_modules/") ||
		norm.includes("/dist/") ||
		norm.includes("/.next/") ||
		norm.includes("/build/") ||
		norm.includes("/__mocks__/") ||
		norm.includes("/__tests__/")
	) {
		return true
	}
	const base = path.basename(norm)
	if (base === "index.ts" || base === "index.tsx") return true
	if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(base)) return true
	if (base.endsWith(".d.ts")) return true
	return false
}

/**
 * Strip comments, replacing each with a single space so the result is the same
 * length as the input (source ranges computed on the original AST stay valid).
 */
function stripComments(source, comments) {
	let text = source
	const ranges = (comments ?? []).map((c) => [c.range[0], c.range[1]]).sort((a, b) => a[0] - b[0])
	const parts = []
	let pos = 0
	for (const [s, e] of ranges) {
		if (s > pos) parts.push(text.slice(pos, s))
		parts.push(" ")
		pos = e
	}
	parts.push(text.slice(pos))
	return parts.join("")
}

/**
 * Collect the names a function declares LOCALLY: parameters, function
 * declarations, catch bindings, and let/const/var declarations (recursively,
 * including nested functions/arrows). Only these are "naming" — everything else
 * (property keys, call targets, imported identifiers, string literals) is the
 * actual logic and is preserved.
 */
function collectLocalNames(node, acc) {
	if (!node || typeof node.type !== "string") return
	if (Array.isArray(node)) {
		for (const child of node) collectLocalNames(child, acc)
		return
	}
	switch (node.type) {
		case "Identifier":
			if (node.name) acc.add(node.name)
			break
		case "FunctionDeclaration":
		case "FunctionExpression":
		case "ArrowFunctionExpression":
			for (const p of node.params ?? []) collectLocalNames(p, acc)
			break
		case "CatchClause":
			if (node.param) collectLocalNames(node.param, acc)
			break
		case "VariableDeclarator":
			collectLocalNames(node.id, acc)
			break
	}
	for (const key of Object.keys(node)) {
		if (key === "type" || key === "range" || key === "loc" || key === "parent") continue
		const v = node[key]
		if (v && typeof v.type === "string") collectLocalNames(v, acc)
		else if (Array.isArray(v))
			for (const item of v) if (item && typeof item.type === "string") collectLocalNames(item, acc)
	}
}

/**
 * Normalize a function body for comparison: strip comments, then replace each
 * LOCALLY-declared identifier with `ID` (length-preserving). Property accesses
 * (`foo.bar`), call targets, and imported names are left intact — so two
 * functions that merely share a shape but operate on different fields/calls are
 * NOT flagged, while the same logic under different variable names IS caught.
 */
function normalizeBody(source, comments, localNames) {
	const text = stripComments(source, comments)
	if (!localNames.size) return text
	const names = [...localNames].sort((a, b) => b.length - a.length)
	const pattern = new RegExp(
		`(?<![.\\w])(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
		"g",
	)
	return text.replace(pattern, (m) => "ID".padEnd(m.length, " "))
}

function tokenize(text) {
	return text.match(/ID|\d+(?:\.\d+)?|[^\s]/g) ?? []
}

/**
 * Collect top-level function-like nodes from a TS AST.
 * Returns [{ node, name }].
 */
function collectFunctions(ast) {
	const out = []
	// Pure call-wiring functions (dispatchers) are exempt — see isPureCallWiring.
	const push = (node, name) => {
		if (isPureCallWiring(node)) return
		out.push({ node, name })
	}
	for (const stmt of ast.body) {
		if (stmt.type === "FunctionDeclaration") {
			push(stmt, stmt.id?.name)
		} else if (stmt.type === "ExportNamedDeclaration") {
			const decl = stmt.declaration
			if (decl?.type === "FunctionDeclaration") {
				push(decl, decl.id?.name)
			} else if (decl?.type === "VariableDeclaration") {
				for (const d of decl.declarations) {
					if (d.init && isFunctionLike(d.init)) push(d.init, d.id?.name)
				}
			}
		} else if (stmt.type === "ExportDefaultDeclaration") {
			const decl = stmt.declaration
			if (decl?.type === "FunctionDeclaration") push(decl, decl.id?.name)
			else if (isFunctionLike(decl)) push(decl)
		} else if (stmt.type === "VariableDeclaration") {
			for (const d of stmt.declarations) {
				if (d.init && isFunctionLike(d.init)) push(d.init, d.id?.name)
			}
		}
	}
	return out
}

function isFunctionLike(node) {
	return node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression"
}

/**
 * Collect NESTED function fragments (arrows/function expressions inside a
 * top-level function body). Copy-paste often lands INSIDE a function: the same
 * callback/logic block inlined in one file and factored into a named helper in
 * another. Top-level-vs-top-level comparison never sees that.
 *
 * A fragment is only reported when its string literals are a SUBSET of its
 * parent function's strings — the parent already carries the full logic, so
 * reporting both would be double-reporting the same duplication.
 */
function collectFragments(fn) {
	const out = []
	const walk = (node) => {
		if (!node || typeof node.type !== "string") return
		if (Array.isArray(node)) {
			for (const child of node) walk(child)
			return
		}
		if ((node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") && node.body) {
			out.push(node)
		}
		for (const key of Object.keys(node)) {
			if (key === "type" || key === "range" || key === "loc" || key === "parent") continue
			const v = node[key]
			if (v && typeof v.type === "string") walk(v)
			else if (Array.isArray(v)) for (const item of v) if (item && typeof item.type === "string") walk(item)
		}
	}
	walk(fn.node)
	const parentStrings = new Set(fn.strings)
	return out
		.filter((n) => {
			const frStrings = stringFingerprint(n)
			return frStrings.every((s) => parentStrings.has(s))
		})
		.map((n) => ({ node: n, name: null, parent: fn.name, tokens: null, strings: stringFingerprint(n) }))
}

/**
 * Collect the string-literal values a function operates on (recursively).
 * These are the "data" of the logic: two copied functions act on the SAME
 * strings, while two same-shape functions that do DIFFERENT things (e.g. one
 * handler per event, or a text-yielder vs a reasoning-yielder) carry DIFFERENT
 * strings. The fingerprint is used as a hard gate before the token comparison.
 */
function collectStringLiterals(node, acc) {
	if (!node || typeof node.type !== "string") return
	if (Array.isArray(node)) {
		for (const child of node) collectStringLiterals(child, acc)
		return
	}
	if (node.type === "Literal" && typeof node.value === "string") acc.push(node.value)
	// Template literals (`[Refusal] ${delta}`) carry string data in their static
	// quasis — include them so functions that build different strings are not
	// treated as "same data".
	if (node.type === "TemplateLiteral") {
		for (const quasi of node.quasis ?? []) {
			if (typeof quasi?.value?.cooked === "string") acc.push(quasi.value.cooked)
		}
	}
	for (const key of Object.keys(node)) {
		if (key === "type" || key === "range" || key === "loc" || key === "parent") continue
		const v = node[key]
		if (v && typeof v.type === "string") collectStringLiterals(v, acc)
		else if (Array.isArray(v))
			for (const item of v) if (item && typeof item.type === "string") collectStringLiterals(item, acc)
	}
}

/** Canonical, comparable fingerprint of a function's string literals. */
function stringFingerprint(node) {
	const acc = []
	collectStringLiterals(node, acc)
	return [...acc].sort()
}

/**
 * A "pure wiring" function: its body is ONLY call expressions (e.g. a
 * dispatcher that calls one handler per event: `registerXReg0(bus); ...`).
 * This is the mandated one-handler-per-event architecture — the body is
 * wiring, not logic (the logic lives in the callees, which differ by event and
 * are already filtered by the string gate). Such functions are exempt.
 */
function isPureCallWiring(node) {
	const body = node.body
	if (!body || body.type !== "BlockStatement") return false
	if (body.body.length === 0) return false
	return body.body.every((stmt) => stmt.type === "ExpressionStatement" && stmt.expression.type === "CallExpression")
}

/**
 * String gate: two units are comparable when one unit's string literals are a
 * SUBSET of the other's. Exact equality (classic copy-paste) passes; a nested
 * fragment inlined in one file vs the same logic factored into a named helper
 * in another passes (fragment strings ⊆ top-level strings). Same-shape
 * different-data handler families still fail.
 */
function stringsCompatible(a, b) {
	if (a.length === b.length && a.every((s, i) => s === b[i])) return true
	const larger = a.length >= b.length ? a : b
	const smaller = a.length >= b.length ? b : a
	const set = new Set(larger)
	return smaller.every((s) => set.has(s))
}

/** Dice coefficient over token count vectors: 2|A∩B| / (|A|+|B|). */
function dice(tokensA, tokensB) {
	if (!tokensA.length || !tokensB.length) return 0
	const ca = new Map()
	for (const t of tokensA) ca.set(t, (ca.get(t) ?? 0) + 1)
	const cb = new Map()
	for (const t of tokensB) cb.set(t, (cb.get(t) ?? 0) + 1)
	const [small, large] = ca.size <= cb.size ? [ca, cb] : [cb, ca]
	let inter = 0
	for (const [k, v] of small) inter += Math.min(v, large.get(k) ?? 0)
	let sum = 0
	for (const v of ca.values()) sum += v
	for (const v of cb.values()) sum += v
	return (2 * inter) / sum
}

/**
 * Module-level cache so sibling files are parsed at most once per eslint run.
 * Maps absolute path -> { mtimeMs, size, units }.
 */
const siblingCache = new Map()

function getSiblingFunctions(dir, selfPath) {
	const result = new Map()
	let entries
	try {
		entries = fs.readdirSync(dir)
	} catch {
		return result
	}
	for (const entry of entries) {
		if (!/\.(ts|tsx)$/.test(entry)) continue
		const full = path.join(dir, entry)
		if (path.resolve(full) === path.resolve(selfPath)) continue
		if (isExcluded(full)) continue
		let stat
		try {
			stat = fs.statSync(full)
		} catch {
			continue
		}
		if (!stat.isFile()) continue
		const cached = siblingCache.get(full)
		if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
			result.set(entry, { units: cached.units })
			continue
		}
		let source
		try {
			source = fs.readFileSync(full, "utf8")
		} catch {
			continue
		}
		let ast
		let comments
		try {
			const result = parser.parseForESLint(source, {
				filePath: full,
				ecmaVersion: "latest",
				sourceType: "module",
			})
			ast = result.ast
			comments = result.ast.comments
		} catch {
			continue
		}
		const units = collectFunctions(ast).flatMap(({ node, name }) => {
			const make = (fnNode, unitName, parent) => {
				const localNames = new Set()
				collectLocalNames(fnNode, localNames)
				const [s, e] = fnNode.body ? [fnNode.body.range[0], fnNode.body.range[1]] : fnNode.range
				const bodyText = normalizeBody(source, comments, localNames).slice(s, e)
				return {
					node: fnNode,
					name: unitName,
					parent,
					tokens: tokenize(bodyText),
					strings: stringFingerprint(fnNode),
				}
			}
			const top = make(node, name, null)
			return [top, ...collectFragments(top).map((f) => make(f.node, null, top.name))]
		})
		siblingCache.set(full, { mtimeMs: stat.mtimeMs, size: stat.size, units })
		result.set(entry, { units })
	}
	return result
}

/** @type {import("eslint").Rule.RuleModule} */
const noDuplicatedLogicRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow duplicated logic between top-level functions in sibling files. " +
				"Identifiers are normalized before comparison, so the same logic under different names is caught. " +
				"Extract a shared helper (actions/events/handlers/store) instead of copying logic.",
		},
		schema: [
			{
				type: "object",
				properties: {
					minTokens: { type: "integer", minimum: 1 },
					similarity: { type: "number", minimum: 0, maximum: 1 },
				},
				additionalProperties: false,
			},
		],
		messages: {
			duplicatedLogic:
				"Function '{{name}}' duplicates logic from '{{other}}' in './{{file}}' (similarity {{similarity}}). " +
				"Extract a shared helper (actions/events/handlers/store) — do not copy logic.",
		},
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		if (!/\.(ts|tsx)$/.test(filename) || isExcluded(filename)) return {}

		const options = context.options?.[0] ?? {}
		const minTokens = options.minTokens ?? 20
		const threshold = options.similarity ?? 0.9

		const sourceCode = context.sourceCode ?? context.getSourceCode()
		const selfSource = sourceCode.getText()
		const selfComments = sourceCode.getComments?.(sourceCode.ast) ?? []
		const selfUnits = collectFunctions(sourceCode.ast).flatMap(({ node, name }) => {
			const make = (fnNode, unitName, parent) => {
				const localNames = new Set()
				collectLocalNames(fnNode, localNames)
				const [s, e] = fnNode.body ? [fnNode.body.range[0], fnNode.body.range[1]] : fnNode.range
				const bodyText = normalizeBody(selfSource, selfComments, localNames).slice(s, e)
				return {
					node: fnNode,
					name: unitName,
					parent,
					tokens: tokenize(bodyText),
					strings: stringFingerprint(fnNode),
				}
			}
			const top = make(node, name, null)
			return [top, ...collectFragments(top).map((f) => make(f.node, null, top.name))]
		})

		const siblings = getSiblingFunctions(path.dirname(filename), filename)

		return {
			Program() {
				// Pass 1: find the best match for every unit.
				const matches = new Map()
				for (const fn of selfUnits) {
					if (fn.tokens.length < minTokens) continue
					let best = null
					for (const [entry, sib] of siblings) {
						for (const sf of sib.units) {
							if (sf.tokens.length < minTokens) continue
							// Hard gate: copied logic operates on the SAME data —
							// one unit's string literals must be a subset of the
							// other's. Same-shape functions that do different things
							// (one-handler-per-event, text vs reasoning yielders)
							// carry different string literals and are skipped.
							if (!stringsCompatible(fn.strings, sf.strings)) continue
							const sim = dice(fn.tokens, sf.tokens)
							if (sim >= threshold && (!best || sim > best.sim)) {
								best = { sim, entry, other: sf.name, otherParent: sf.parent }
							}
						}
					}
					if (best) matches.set(fn, best)
				}
				// Pass 2: report. A fragment is covered by its parent's report —
				// if the parent top-level function is reported, its fragments are
				// not reported again (same duplication, one finding).
				const reportedTops = new Set()
				for (const fn of selfUnits) {
					if (fn.parent) continue
					const best = matches.get(fn)
					if (!best) continue
					reportedTops.add(fn.name)
					const label = (name, parent) => (name ? name : parent ? `${parent} (nested)` : "<anonymous>")
					context.report({
						node: fn.node,
						messageId: "duplicatedLogic",
						data: {
							name: label(fn.name, fn.parent),
							other: label(best.other, best.otherParent),
							file: best.entry,
							similarity: best.sim.toFixed(2),
						},
					})
				}
				for (const fn of selfUnits) {
					if (!fn.parent || !matches.has(fn) || reportedTops.has(fn.parent)) continue
					const best = matches.get(fn)
					const label = (name, parent) => (name ? name : parent ? `${parent} (nested)` : "<anonymous>")
					context.report({
						node: fn.node,
						messageId: "duplicatedLogic",
						data: {
							name: label(fn.name, fn.parent),
							other: label(best.other, best.otherParent),
							file: best.entry,
							similarity: best.sim.toFixed(2),
						},
					})
				}
			},
		}
	},
}

export default noDuplicatedLogicRule
