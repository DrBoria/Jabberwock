/**
 * Rule: no-direct-store-import
 *
 * User doctrine (2026-09-17): there is ONE sanctioned way to reach a store —
 * the GLOBAL root accessor (`getStore()` on the backend, `rootStore` /
 * `getRootStore()` on the frontend). Never import a store module directly:
 * no `import { TaskModel } from "@features/chat/task/task-store"`, no
 * `import { X } from "./store"`, no importing another store's actions/events.
 *
 * Why: a child store is part of the SAME MST tree. Importing its file couples
 * you to a private module and bypasses the live tree. The idiomatic MST way
 * is to navigate the tree:
 *   - inside an action: `getRoot<RootStore>(self).<feature>.action(...)`
 *     (or `getParent(self)` for the immediate parent), so the whole flow
 *     stays inside MST actions;
 *   - outside the tree: the global root accessor (`getStore()` / `rootStore`).
 *
 * What is flagged (VALUE imports only — type-only imports are erased at
 * compile time and are exempt):
 *   - any import whose resolved target file is a STORE module:
 *       * named `store.ts` / `store.tsx`, or
 *       * defines an MST model with actions (`types.model/compose` + `.actions(`).
 *
 * Sanctioned (NOT flagged):
 *   - type-only imports (`import type` / `import { type X }`) — no runtime
 *     coupling; typing `getRoot<RootStore>(self)` results is the normal way;
 *   - the importing file IS ITSELF a store module (store.ts(x), or a file
 *     defining a model with actions): composing child models at definition
 *     time (`tasks: types.map(TaskModel)`) is building the tree, not reaching
 *     into a live child;
 *   - the global root accessors themselves (`@src/features/store`,
 *     `@src/features/root-store`, `@features/singleton`) — that IS the
 *     sanctioned path;
 *   - `allowedPaths` — explicit, documented exceptions (each entry is a
 *     deliberate decision, never a shape match).
 *
 * Both alias shapes and relative imports are covered: backend
 * `@features/<x>/...`, frontend `@src/features/<x>/...`, and any relative
 * `./store` / `../foo/store` that resolves to a store module.
 */

import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const DEFAULT_EXCLUDE_PATHS = [".test.", ".spec.", "__mocks__", "dist/"]

/** @type {Map<string, boolean>} resolved absolute path -> isStoreModule */
const storeCache = new Map()

/** @type {Set<string>} paths currently being resolved (recursion guard) */
const storeVisiting = new Set()

/**
 * Is this file a STORE module?
 *  - named `store.ts` / `store.tsx`, or
 *  - defines an MST model with actions (`types.model/compose` + `.actions(`).
 * @param {string} absPath
 * @returns {boolean}
 */
/**
 * Strip block and line comments so composition scans don't match comment text.
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
	return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
}

/**
 * Is this file a STORE module?
 *  - named `store.ts` / `store.tsx`, or
 *  - defines an MST model with actions: `types.model/compose` + `.actions(` in the
 *    same file, OR an exported const built via `.actions(...)` (e.g.
 *    `export const TaskModel = TaskModelWithState.actions((self) => ...)`).
 * @param {string} absPath
 * @returns {boolean}
 */
/** @type {Map<string, Set<string>>} barrel path -> re-exported store symbol names */
const barrelStoreSymbolsCache = new Map()

/**
 * Which symbols a barrel (index.ts(x)) re-exports FROM store modules. Follows
 * `export { a, b as c } from "./rel"` / `export * from "./rel"` one level deep.
 * A feature barrel is a MIXED public API (models + helpers + constants) — only
 * the store-symbol subset is a direct store import.
 * @param {string} absPath
 * @returns {Set<string>} local names of re-exported store symbols
 */
function barrelStoreSymbols(absPath) {
	const cached = barrelStoreSymbolsCache.get(absPath)
	if (cached !== undefined) return cached
	const out = new Set()
	try {
		const src = stripComments(readFileSync(resolve(absPath), "utf8"))
		const dir = absPath.slice(0, absPath.lastIndexOf("/"))
		const reExportRe = /export\s+(\*|\{[^}]*\})\s+from\s+["'](\.[^"']+)["']/g
		let m
		while ((m = reExportRe.exec(src)) !== null) {
			const clause = m[1]
			const rel = m[2]
			for (const p of [rel + ".ts", rel + ".tsx", rel + "/index.ts", rel + "/index.tsx"]) {
				const full = join(dir, p)
				try {
					readFileSync(resolve(full))
				} catch {
					continue // next candidate
				}
				if (!isStoreModuleFile(full)) continue
				if (clause === "*") {
					// `export * from` a store module — every STORE symbol it
					// exports (models + singletons, NOT utility functions).
					for (const name of storeSymbolNames(full)) out.add(name)
				} else {
					// `export { a, b as c } from` — map the local (imported-side)
					// names to the store module's STORE symbols only.
					const inner = clause.slice(1, -1)
					for (const part of inner.split(",")) {
						const trimmed = part.trim()
						if (!trimmed) continue
						const asMatch = trimmed.match(/^(\w+)(?:\s+as\s+(\w+))?$/)
						if (!asMatch) continue
						const exportName = asMatch[2] ?? asMatch[1]
						const originalName = asMatch[1]
						if (storeSymbolNames(full).has(originalName)) out.add(exportName)
					}
				}
				break
			}
		}
	} catch {
		/* unreadable */
	}
	barrelStoreSymbolsCache.set(absPath, out)
	return out
}

/**
 * Which exported const names in a store module are genuine STORE symbols —
 * MST model constructors (`types.model` / `types.compose` / `.actions(`) or
 * singleton instances (`X.create(...)`). Utility functions that merely live in
 * the same file (`getSkillsManager`, `getMstState`, `initSkillsState`) are NOT
 * store symbols: they take `rootStore` as a parameter and are the sanctioned
 * accessor pattern, so importing them is fine.
 * @param {string} absPath
 * @returns {Set<string>}
 */
function storeSymbolNames(absPath) {
	const out = new Set()
	try {
		const src = stripComments(readFileSync(resolve(absPath), "utf8"))
		const declRe = /export\s+(?:declare\s+)?const\s+(\w+)\s*=/g
		let m
		while ((m = declRe.exec(src)) !== null) {
			const name = m[1]
			// Capture the initializer window: from the match to the next
			// top-level `export ` keyword (or a bounded slice).
			const start = m.index + m[0].length
			const nextExport = src.indexOf("\nexport ", start)
			const windowEnd = nextExport === -1 ? start + 800 : nextExport
			const init = src.slice(start, windowEnd)
			const isModel = /\btypes\s*\.\s*(model|compose)\s*\(/.test(init) || /\w+\.actions\s*\(/.test(init)
			const isInstance = /\w+\.create\s*\(/.test(init)
			if (isModel || isInstance) out.add(name)
		}
	} catch {
		/* unreadable */
	}
	return out
}

/**
 * Is this file itself an MST store module (not a barrel)?
 *  - named `store.ts` / `store.tsx`, or
 *  - defines an MST model with actions: `types.model/compose` + `.actions(` in
 *    the same file, OR an exported const built via `.actions(...)` (e.g.
 *    `export const TaskModel = TaskModelWithState.actions((self) => ...)`).
 * @param {string} absPath
 * @returns {boolean}
 */
function isStoreModuleFile(absPath) {
	const base = absPath.slice(absPath.lastIndexOf("/") + 1)
	if (base === "store.ts" || base === "store.tsx") return true
	try {
		const src = stripComments(readFileSync(resolve(absPath), "utf8"))
		const hasModel = /types\.(model|compose)\s*\(/.test(src)
		const hasActions = /\.actions\s*\(/.test(src)
		const exportedActionsConst = /export\s+const\s+\w+\s*=\s*\w+\.actions\s*\(/.test(src)
		return (hasModel && hasActions) || exportedActionsConst
	} catch {
		return false
	}
}

/**
 * The set of STORE symbols a resolved import target exposes:
 *  - a store module file → all of its exported names;
 *  - a barrel (index.ts(x)) → only the names it re-exports FROM store modules
 *    (a feature barrel is a mixed public API — helpers/constants are fine);
 *  - anything else → empty.
 * @param {string} absPath
 * @returns {Set<string>}
 */
function storeSymbolsOf(absPath) {
	const cached = storeCache.get(absPath)
	if (cached !== undefined) return cached
	if (storeVisiting.has(absPath)) return new Set() // barrel cycle — break
	storeVisiting.add(absPath)
	let result
	try {
		if (isStoreModuleFile(absPath)) {
			result = storeSymbolNames(absPath)
		} else if (/\/index\.tsx?$/.test(absPath)) {
			result = barrelStoreSymbols(absPath)
		} else {
			result = new Set()
		}
	} finally {
		storeVisiting.delete(absPath)
	}
	storeCache.set(absPath, result)
	return result
}

/**
 * Is an imported symbol used in a COMPOSITION context in the importing file?
 * Composition = building the MST tree at definition time:
 *   - `types.map(Symbol)` — array/map of child models;
 *   - `prop: Symbol` inside a `types.model({...})` / `types.compose({...})` object;
 *   - `Symbol.actions(...)` / `Symbol.views(...)` / `Symbol.compose(...)` —
 *     the MST model-EXTENSION chain (`const TaskModel = TaskModelWithState
 *     .actions(...)`): the symbol is the BASE being extended to build a new
 *     model at definition time.
 * A symbol used as `Symbol.create(...)` or read as `Symbol.someProp` is a LIVE
 * model reference (a singleton or a created instance) — it must be flagged.
 * @param {string} src source text of the importing file (comments stripped)
 * @param {string} symbol the imported symbol name
 * @returns {boolean}
 */
function isUsedInComposition(src, symbol) {
	const esc = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	// types.<method>(Symbol) / types.<method>([Symbol]) — ANY MST model-type
	// constructor wrapping the symbol: types.map, types.optional, types.array,
	// types.maybe, types.refinement, types.compose, ... all build the tree at
	// definition time.
	if (new RegExp(`types\\.[A-Za-z_$][\\w$]*\\s*\\(\\s*(\\[\\s*)?${esc}\\b`).test(src)) return true
	// prop: Symbol — a property value that IS the symbol (composition in types.model object)
	if (new RegExp(`[\\s,{]\\s*\\w+\\s*:\\s*${esc}\\s*[,)}]`).test(src)) return true
	// Symbol.actions( / Symbol.views( / Symbol.compose( — model-extension chain
	// building a new model from this base at definition time.
	if (new RegExp(`${esc}\\s*\\.(?:actions|views|compose)\\s*\\(`).test(src)) return true
	return false
}

/**
 * Is this file a COMPOSITION ROOT — the one place allowed to import child
 * store models to BUILD the tree? The top-level root store definition and its
 * singleton accessor/factory. Everything else must navigate via
 * getRoot/getParent or the global accessor.
 * @param {string} absPath
 * @returns {boolean}
 */
function isCompositionRoot(absPath) {
	const p = absPath.replace(/\\/g, "/")
	return (
		p.endsWith("/features/root-store/store.ts") ||
		p.endsWith("/features/root-store/bootstrap/singleton.ts") ||
		p.endsWith("/features/store.ts")
	)
}

/**
 * Resolve an import source (alias or relative) to a file on disk.
 *
 * Alias map (tsconfig `paths`):
 *   `@features/*`  → `backend/features/*`
 *   `@src/*`       → `frontend/src/*`
 *
 * @param {string} spec the import source
 * @param {string} importerDir absolute dir of the importing file
 * @param {string} root project root
 * @returns {string | null} absolute path of the resolved file, or null
 */
function resolveImport(spec, importerDir, root) {
	let base
	if (spec.startsWith("@src/")) {
		base = join(root, "frontend", "src", spec.slice("@src/".length))
	} else if (spec.startsWith("@features/")) {
		base = join(root, "backend", "features", spec.slice("@features/".length))
	} else if (spec.startsWith(".")) {
		base = resolve(importerDir, spec)
	} else {
		return null // bare module specifier — not a local store import
	}
	for (const p of [base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"]) {
		try {
			readFileSync(resolve(p))
			return p
		} catch {
			/* try the next candidate */
		}
	}
	return null
}

/**
 * Walk up from the file path to find the project root (pnpm-workspace.yaml).
 * @param {import("eslint").Rule.RuleContext} context
 * @returns {string}
 */
function getProjectRoot(context) {
	const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
	let dir = dirname(filename)
	for (let i = 0; i < 16; i++) {
		try {
			readFileSync(join(dir, "pnpm-workspace.yaml"))
			return dir
		} catch {
			const parent = dirname(dir)
			if (parent === dir) break
			dir = parent
		}
	}
	return "."
}

/** @type {import("eslint").Rule.RuleModule} */
const noDirectStoreImportRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"No direct VALUE imports of store modules (models, actions, events). " +
				"Use the global root accessor (`getStore()` / `rootStore`) or navigate the MST tree " +
				"via `getRoot<RootStore>(self)` / `getParent(self)` from inside an action. " +
				"Type-only imports and store-to-store composition are exempt.",
		},
		schema: [
			{
				type: "object",
				properties: {
					allowedPaths: {
						type: "array",
						items: { type: "string" },
						description: "Import-source prefixes that stay allowed (documented exceptions). Default: [].",
						default: [],
					},
					excludePaths: {
						type: "array",
						items: { type: "string" },
						description: "Substrings of file paths excluded from the check.",
						default: DEFAULT_EXCLUDE_PATHS,
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			directStoreImport:
				"Direct store import: '{{importSource}}'. Never import a store module (models, actions, events) directly — " +
				"there is ONE sanctioned path: the global root accessor (`getStore()` on the backend, `rootStore`/`getRootStore()` on the frontend). " +
				"Inside an MST action, navigate the live tree instead: `getRoot<RootStore>(self).<feature>.action(...)` " +
				"(or `getParent(self)` for the immediate parent), so the whole flow stays inside MST actions. " +
				"(User doctrine 2026-09-17; type-only imports and store-to-store composition are exempt.)",
		},
	},
	create(context) {
		const options = context.options[0] ?? {}
		// NOTE: ESLint does NOT apply schema `default` values — always fall back here.
		const allowedPaths = options.allowedPaths ?? []
		const excludePaths = options.excludePaths ?? DEFAULT_EXCLUDE_PATHS

		const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
		if (excludePaths.some((ex) => filename.includes(ex))) return {}

		const root = getProjectRoot(context)
		const importerDir = dirname(filename)
		// Composition scan of the importing file (once per file, comments stripped).
		let importerSrc
		const getImporterSrc = () => {
			if (importerSrc === undefined) {
				try {
					importerSrc = stripComments(readFileSync(resolve(filename), "utf8"))
				} catch {
					importerSrc = ""
				}
			}
			return importerSrc
		}

		/**
		 * Report a VALUE import whose target is a store module, unless every
		 * imported value symbol is used only in a composition context
		 * (`types.map(X)` / `prop: X` in a types.model object) — building the
		 * tree at definition time. `X.create(...)` inside an action is a LIVE
		 * model reference and is flagged even when the importer is itself a store.
		 * @param {object} node the ImportDeclaration
		 */
		function checkImport(node) {
			const sourceNode = node.source
			if (!sourceNode || sourceNode.type !== "Literal" || typeof sourceNode.value !== "string") return
			const source = sourceNode.value
			// The global root accessors ARE the sanctioned path.
			if (
				source === "@src/features/store" ||
				source === "@src/features/root-store" ||
				source === "@features/singleton" ||
				source === "@features/store"
			)
				return
			// The COMPOSITION ROOT files (root-store/store.ts, root-store
			// singleton accessor, backend store.ts) are the ONE place allowed
			// to import child store models in order to BUILD the tree.
			if (isCompositionRoot(filename)) return
			if (allowedPaths.some((allowed) => source.startsWith(allowed))) return
			const resolved = resolveImport(source, importerDir, root)
			if (!resolved) return
			const storeSymbols = storeSymbolsOf(resolved)
			if (storeSymbols.size === 0) return
			const importerSrc = getImporterSrc()
			// Report per VALUE specifier: type-only specifiers create no runtime
			// coupling; a value specifier used ONLY in a composition context
			// (`types.map(X)` / `prop: X` in a types.model object) is building
			// the tree at definition time — exempt. `X.create(...)` inside an
			// action is a LIVE model reference — flagged even in a store file.
			// Declaration-level `import type { ... }` — every specifier is a
			// type (importKind lives on the declaration, not the specifiers).
			if (node.importKind === "type") return
			for (const s of node.specifiers ?? []) {
				if (!s || s.importKind === "type") continue
				const exportedName = s.imported && s.imported.type === "Identifier" ? s.imported.name : s.local.name
				if (!storeSymbols.has(exportedName)) continue
				if (isUsedInComposition(importerSrc, s.local.name)) continue
				context.report({ node: s, messageId: "directStoreImport", data: { importSource: source } })
			}
		}

		return {
			ImportDeclaration(node) {
				checkImport(node)
			},
		}
	},
}

export default noDirectStoreImportRule
