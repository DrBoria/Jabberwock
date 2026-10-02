/**
 * D51 finding (refactor.md): cross-feature module imports — the rule is about
 * the ACTION, not the path length.
 *
 * v2 plan (architectural-restructure-v2.md, P18): a feature's public API is
 * its barrel (`@features/<x>`). Importing another feature's internal module
 * (`@features/<x>/a/b`) is the WRONG ACTION: it couples to a private file
 * instead of the public API or the live MST tree — it is not a matter of the
 * import being "too long".
 *
 * Target-aware classification (D52 deep research, "Shadow stores (P4)"):
 *
 *  - `import type ...` (type-only) is EXEMPT — types are erased at compile
 *    time, there is no runtime action. (Cross-feature `Instance<T>` types are
 *    the normal way to type `getRoot<RootStore>(self)` results.)
 *  - a VALUE import whose target is the feature's MST STORE (a `store.ts(x)`
 *    file, or a file defining `types.model(...)` + `.actions(...)`) →
 *    `storeImport`: a child store is part of the SAME MST tree — do not
 *    import its file; navigate the live tree with `getRoot`/`getParent`, from
 *    inside an action so the whole flow stays in MST actions:
 *    `getRoot<RootStore>(self).<feature>.<child>.action(...)`.
 *  - a VALUE import whose target is a SHADOW-STORE module (module-level
 *    `let` state + an accessor closure, e.g. `registry.ts`, `context.ts`,
 *    `storeSingleton.ts`) → `shadowStoreTarget`: completing the barrel is the
 *    WRONG fix (v2 rule #4) — migrate the state into the feature's single
 *    store.ts, then read it via the root store.
 *  - any other deep VALUE import (a plain internal module of another feature)
 *    → `deepImport`: use the feature's barrel (complete it if the symbol is
 *    not re-exported yet).
 *
 * Scope — ONE feature is ONE module. A deep import that stays INSIDE the
 * importing file's own feature is not the wrong action (there is no other
 * feature's public API to go through): only `store` and `shadow` targets are
 * reported there. The React bridge is exempt too — a `.tsx` component reads a
 * child store through its hook (rendering the tree is not an action) — and a
 * store.ts composing child models at definition time is composing the tree,
 * not reaching into a live child.
 *
 * Both alias shapes are covered: backend `@features/<x>/...` and frontend
 * `@src/features/<x>/...`. A top-level (no-slash) import is a feature
 * entrypoint, not a deep import. `allowedPaths` lists import-source prefixes
 * that stay whitelisted (documented exceptions); test/mock files are
 * excluded by default.
 */

import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const FEATURES_PREFIX = "@features/"
const DEFAULT_EXCLUDE_PATHS = [".test.", ".spec.", "__mocks__", "dist/"]

// ─── Target classification (D52: "wrong action", not "too long") ──────────
//
// A deep VALUE import is classified by the NATURE of the resolved target file
// (read once, cached per import source):
//   "store"      — the feature's MST store: a `store.ts(x)` file, or a file
//                  defining `types.model(...)` + `.actions(...)`. Fix: navigate
//                  the live tree (`getRoot`/`getParent`), don't import the file.
//   "shadow"     — a shadow store: module-level `let`/`var` state (see the
//                  no-shadow-store rule). Fix: migrate into the MST store.
//   "other"      — a plain internal module (pure helper) or unresolvable.
//                  Fix: the feature's barrel.

/** @type {Map<string, "store" | "shadow" | "other">} import source -> target kind */
const targetCache = new Map()

/** @type {Map<string, boolean>} import source -> isBarrel (index.ts(x) exists) */
const barrelCache = new Map()

/**
 * Resolve `@features/<x>/...` (backend) or `@src/features/<x>/...` (frontend)
 * to a file on disk: `<root>/<aliasDir>/<rel>.ts | .tsx | /index.ts | /index.tsx`.
 *
 * Alias map (tsconfig `paths`):
 *   `@features/*`        → `backend/features/*`
 *   `@src/*`             → `frontend/src/*`   (so `@src/features/*` → `frontend/src/features/*`)
 *
 * @param {string} spec the full import source
 * @param {string} root project root
 * @returns {string | null} absolute path of the resolved file, or null
 */
function resolveFeatureModule(spec, root) {
	let aliasDir
	let rel
	if (spec.startsWith("@src/")) {
		aliasDir = join("frontend", "src")
		rel = spec.slice("@src/".length)
	} else {
		aliasDir = join("backend", "features")
		rel = spec.slice(FEATURES_PREFIX.length)
	}
	const candidate = join(root, aliasDir, rel)
	for (const p of [candidate + ".ts", candidate + ".tsx", candidate + "/index.ts", candidate + "/index.tsx"]) {
		try {
			readFileSync(resolve(p))
			return p
		} catch {
			/* try the next candidate */
		}
	}
	return null
}

/** @param {string} spec @param {string} root @returns {"store" | "shadow" | "other"} */
function classifyTargetUncached(spec, root) {
	const p = resolveFeatureModule(spec, root)
	if (!p) return "other"
	try {
		const src = readFileSync(resolve(p), "utf8")
		const base = p.slice(p.lastIndexOf("/") + 1)
		// The feature's single MST store file.
		if (base === "store.ts" || base === "store.tsx") return "store"
		// A file that DEFINES an MST model with actions.
		if (/types\.(model|compose)\s*\(/.test(src) && /\.actions\s*\(/.test(src)) return "store"
		// A shadow store: a top-level (COLUMN-0) `let`/`var`, optionally
		// `export let`. This repo indents with tabs, so requiring column 0 keeps
		// class-method / function-body `let`s (e.g. `\t\tlet burstCount = 0`) out
		// — only genuine module-scope state matches. Mirrors no-shadow-store's
		// AST program.body check.
		if (/(^|\n)(export\s+)?(let|var)\s+[A-Za-z_$]/.test(src)) return "shadow"
		return "other"
	} catch {
		return "other"
	}
}

/**
 * Classify the resolved target of a deep import (cached per source).
 * @param {string} spec the full import source
 * @param {string} root project root
 * @returns {"store" | "shadow" | "other"}
 */
function classifyTarget(spec, root) {
	const cached = targetCache.get(spec)
	if (cached !== undefined) return cached
	const kind = classifyTargetUncached(spec, root)
	targetCache.set(spec, kind)
	return kind
}

/**
 * Is this import source a feature barrel, i.e. does an `index.ts(x)` exist at
 * the resolved feature path (any nesting depth, e.g.
 * `@features/foundation/capabilities`)? Cached per source.
 *
 * @param {string} spec the full import source
 * @param {string} root project root
 * @returns {boolean}
 */
function isFeatureBarrel(spec, root) {
	const cached = barrelCache.get(spec)
	if (cached !== undefined) return cached
	const resolved = resolveFeatureModule(spec, root)
	const result = resolved !== null && /\/index\.tsx?$/.test(resolved)
	barrelCache.set(spec, result)
	return result
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

/**
 * Which feature a file belongs to, as `<tree>:<first segment under features/>`:
 * `backend/features/chat/...` → `backend:chat`,
 * `frontend/src/features/chat/...` → `frontend:chat`. Returns null for files
 * that live outside any feature tree (connectors, packages, apps).
 * @param {string} filePath
 * @param {string} root project root
 * @returns {string | null}
 */
function featureOfPath(filePath, root) {
	const rel = filePath.startsWith(root + "/") ? filePath.slice(root.length + 1) : filePath
	const backendMatch = rel.match(/^backend\/features\/([^/]+)\//)
	if (backendMatch) return `backend:${backendMatch[1]}`
	const frontendMatch = rel.match(/^frontend\/src\/features\/([^/]+)\//)
	if (frontendMatch) return `frontend:${frontendMatch[1]}`
	return null
}

/**
 * Is this the feature's single MST store file (store.ts / store.tsx)? Such a
 * file composes child models at definition time — that is not a "wrong action".
 * @param {string} filePath
 * @returns {boolean}
 */
function isStoreModule(filePath) {
	const base = filePath.slice(filePath.lastIndexOf("/") + 1)
	return base === "store.ts" || base === "store.tsx"
}

/** @type {import("eslint").Rule.RuleModule} */
const noDeepFeatureImportRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"No deep VALUE imports into a feature's internals (v2 plan P18): the wrong action is importing another feature's module — use the barrel, the feature's public API, or navigate the MST tree via getRoot/getParent (store targets). Type-only imports exempt.",
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
			storeImport:
				"Importing another feature's STORE as a module: '{{importSource}}'. " +
				"Wrong action — a child store is part of the SAME MST tree; do not import its file. " +
				"Navigate the live tree instead, from inside an action (so the whole flow stays in MST actions): " +
				"`getRoot<RootStore>(self).<feature>.<child>.action(...)` — or `getParent(self)` for the immediate parent. " +
				'(v2 rule #4, D52; see plans/refactor.md "Shadow stores (P4)".)',
			shadowStoreTarget:
				"Deep feature import into a SHADOW-STORE module: '{{importSource}}'. " +
				"This file holds module-level state (a shadow store) — completing the barrel is the WRONG fix here (v2 rule #4). " +
				"Migrate the state into the feature's single store.ts (an MST model on the root store), read it via the root store " +
				"(`getRoot<RootStore>(self)`), then delete the module-level holder and its accessor closure. " +
				'See the no-shadow-store rule and plans/refactor.md "Shadow stores (P4)".',
			deepImport:
				"Deep feature import: '{{importSource}}'. The issue is not the path length — it is the action: " +
				"you are importing another feature's internal module directly. A feature's public API is its barrel — " +
				"import '{{barrel}}' instead (complete the barrel if the symbol is not re-exported yet). " +
				"If what you need is the feature's store functionality, it should be an MST action reachable via " +
				"getRoot/getParent, not an import (v2 plan P18, rule #4).",
			relativeUpImport:
				"Relative import above the current directory: '{{importSource}}'. Only `./` imports are allowed — " +
				"`../` and deeper are forbidden: they silently cross folder boundaries. Stay within the current folder " +
				"(`./`), use the feature's barrel, or navigate the MST tree via getRoot/getParent.",
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
		const ownFeature = featureOfPath(filename, root)

		/**
		 * Report a deep @features/<x>/... (or @src/features/<x>/...) VALUE import.
		 * Type-only imports are exempt; the message depends on the nature of the
		 * resolved target (store → getRoot/getParent, shadow → migrate, other → barrel).
		 * @param {object} node the ImportDeclaration
		 */
		function checkImport(node) {
			const sourceNode = node.source
			if (!sourceNode || sourceNode.type !== "Literal" || typeof sourceNode.value !== "string") return
			const source = sourceNode.value
			// Type-only imports (import type / every specifier typed) create no
			// runtime coupling — there is no "action" to fix.
			const specifiers = node.specifiers ?? []
			const typeOnly =
				node.importKind === "type" ||
				(specifiers.length > 0 && specifiers.every((s) => s && s.importKind === "type"))
			if (typeOnly) return
			// User doctrine (folder = domain): inside feature trees, only `./`
			// imports are allowed — `../` crosses domain boundaries. Outside
			// feature trees (packages, connectors, apps, shared) `../` is normal.
			if (source.startsWith("..") && ownFeature !== null) {
				if (!allowedPaths.some((allowed) => source.startsWith(allowed))) {
					context.report({ node: sourceNode, messageId: "relativeUpImport", data: { importSource: source } })
				}
				return
			}
			if (!source.startsWith(FEATURES_PREFIX) && !source.startsWith("@src/features/")) return
			const rest = source.replace(/^@(?:features|src\/features)\//, "")
			const slash = rest.indexOf("/")
			if (slash === -1) return // top-level feature import — not a deep import
			const feature = rest.slice(0, slash)
			// Explicit index import IS the barrel.
			if (rest === `${feature}/index` || rest === `${feature}/index.ts` || rest === `${feature}/index.tsx`) return
			// The import resolves to a real barrel (index.ts(x) exists) — allowed,
			// whatever the nesting depth (e.g. @features/foundation/capabilities).
			if (isFeatureBarrel(source, root)) return
			if (allowedPaths.some((allowed) => source.startsWith(allowed))) return
			const kind = classifyTarget(source, root)
			// One feature is one module: a deep import that stays inside the importing
			// file's OWN feature crosses no API boundary — nothing to fix (there is no
			// other feature's barrel to route through, and no tree to navigate to).
			const ownAliasKey = `${source.startsWith("@src/") ? "frontend:" : "backend:"}${feature}`
			if (kind === "other" && ownFeature !== null && ownFeature === ownAliasKey) return
			// React bridge (`.tsx` reads a child store via its hook) and store
			// composition (a store.ts composing child models at definition time) are
			// the tree being BUILT/render, not an action reaching into a child.
			if (kind === "store" && (filename.endsWith(".tsx") || isStoreModule(filename))) return
			// Same-feature store composition: a file inside feature X importing feature
			// X's own store module to BUILD that store (e.g. root-store/bootstrap/
			// singleton.ts composing RootStore from root-store/store). No API boundary
			// is crossed — it is the tree being assembled, not an action reaching in.
			if (kind === "store" && ownFeature !== null && ownFeature === ownAliasKey) return
			const messageId = kind === "store" ? "storeImport" : kind === "shadow" ? "shadowStoreTarget" : "deepImport"
			const barrelAlias = source.startsWith("@src/") ? "@src/features/" : "@features/"
			context.report({
				node: sourceNode,
				messageId,
				data: { importSource: source, barrel: `${barrelAlias}${feature}` },
			})
		}

		return {
			ImportDeclaration(node) {
				checkImport(node)
			},
		}
	},
}

export default noDeepFeatureImportRule
