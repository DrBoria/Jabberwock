/**
 * Rule: no-feature-store
 *
 * Doctrine (user mandate, 2026): "there can't be a feature folder without a
 * store file." A feature is a named domain, and a domain either CARRIES STATE
 * (then it has exactly one `store.ts` — a single MST root store) or it does not
 * (then it is not a feature, it is a bag of utilities/handlers and should be
 * broken up or deleted). An empty `store.ts` is never the answer: a store
 * without data is a lie, and a feature whose state lives in a shadow store
 * (a class with instance fields, a module singleton) must have that shadow
 * store replaced by a real MST `store.ts`.
 *
 * What this rule reports:
 *   - featureMissingStore : a feature-root folder (a direct child of a
 *                           configured feature root, e.g. `backend/services/mdm`)
 *                           that contains NO `store.ts` / `store.tsx`. The fix
 *                           is a review, not a mechanical edit:
 *                             (a) it has state in a shadow store → replace the
 *                                 shadow store with an MST `store.ts`;
 *                             (b) it has no state at all → it is not a feature;
 *                                 break it into actions/events/handlers/utilities
 *                                 (or delete it). The rule DERIVES this from the
 *                                 folder's contents, so there is nothing to
 *                                 allowlist;
 *                             (c) its state belongs to ANOTHER feature → move it
 *                                 there.
 *   - featureStoreEmpty : a feature-root folder whose `store.ts` / `store.tsx`
 *                           has NO exports at all — a store without data is a
 *                           lie (user mandate 2026-09-15: "пустого store.ts или
 *                           без методов, которые РЕАЛЬНО ИСПОЛЬЗУЮТЬСЯ — не
 *                           может быть"). The fix is a review: either the store
 *                           must actually carry the feature's state (merge any
 *                           shadow store INTO it — or into an existing store of
 *                           another feature if that is the real owner), or the
 *                           feature is not a feature and the empty store plus
 *                           the folder must be broken up / deleted / moved.
 *
 * The rule reports ONCE per feature root (anchored on its `index.ts`, or the
 * alphabetically-first `.ts` file when there is no index), so each store-less
 * feature is exactly one finding — a review prompt, not N.
 *
 * Sanctioned exceptions (NOT reported): a feature root whose own files carry NO
 * state anywhere (no MST model/composition, no `.volatile()`, no module-level
 * `let`/`var`) is DERIVED as not-a-feature — stateless utilities, parsers, I/O
 * wrappers and aggregator barrels are therefore never reported. This is computed
 * from the folder's contents, not from a hand-maintained list of names, so it can
 * never go stale.
 */

import fs from "node:fs"
import path from "node:path"

/**
 * Collect all files in a directory (non-recursive).
 * @param {string} dirPath
 * @returns {string[]}
 */
function listFiles(dirPath) {
	try {
		return fs
			.readdirSync(dirPath, { withFileTypes: true })
			.filter((e) => e.isFile())
			.map((e) => e.name)
	} catch {
		return []
	}
}

/**
 * Read a file's contents, or null when unreadable (unreadable ≠ empty —
 * never report on a file we could not read).
 * @param {string} filePath
 * @returns {string | null}
 */
function readStoreContent(filePath) {
	try {
		return fs.readFileSync(filePath, "utf8")
	} catch {
		return null
	}
}

/**
 * Does the file contain at least one export declaration? A store with no
 * exports at all is a store without data — a lie.
 * @param {string} content
 * @returns {boolean}
 */
function hasAnyExport(content) {
	return /(^|\n)\s*export\s+(const|let|var|function|class|type|interface|enum|default|\{|\*)/.test(content)
}

import { applyDebt } from "../debt/debt.js"

/**
 * Does this feature root carry state ANYWHERE? Derived from the folder's own contents — an MST
 * model / composition, a `.volatile()` surface, or module-level mutable state. A folder with none
 * of those is not a feature (a stateless utility, parser, I/O wrapper or aggregator barrel), so
 * demanding a `store.ts` from it would be wrong.
 *
 * This DERIVES what used to be a hand-maintained `statelessFeatures` name list: the list had to be
 * extended by hand for every new stateless folder, and it silently mis-classified the day a folder
 * started carrying state.
 *
 * @param {string} dirPath
 * @param {string[]} files
 * @returns {boolean}
 */
function carriesState(dirPath, files) {
	for (const f of files) {
		if (!/\.tsx?$/.test(f)) continue
		const src = readStoreContent(path.join(dirPath, f))
		if (src === null) continue
		if (/\btypes\s*\.\s*(model|compose)\s*\(/.test(src)) return true
		if (/\.volatile\s*\(/.test(src)) return true
		// Module-level MUTABLE state only — the declaration must start at column 0. A `let` inside a
		// function body (or an indented block) is local state, not feature state.
		if (/(^|\n)(export\s+)?(let|var)\s+[A-Za-z_$]/.test(src)) return true
	}
	return false
}

/** @type {import("eslint").Rule.RuleModule} */
const noFeatureStoreRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A feature-root folder must contain a single store.ts (one MST root store). A feature " +
				"either carries state (→ exactly one store.ts) or it carries no state and is therefore " +
				"not a feature (→ break it into actions/events/handlers/utilities, or delete it) — the " +
				"rule derives which, it is not a list. An " +
				"empty store.ts is never the answer, and a shadow store (class/module singleton) must be " +
				"replaced by a real MST store.ts. Reports once per feature root.",
		},
		schema: [
			{
				type: "object",
				properties: {
					roots: {
						type: "array",
						items: { type: "string" },
						description:
							"Feature-root path prefixes. A direct child of one of these is a feature root. " +
							"Default: ['backend/features/', 'backend/services/', 'frontend/src/features/'].",
					},
					debt: {
						type: "object",
						description:
							"Machine-generated grandfather ledger: { '<file>::<messageId>': count }. The rule is total; " +
							"only findings recorded in the ledger are silenced (see the repo lint-debt generator).",
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			featureMissingStore:
				"Feature root '{{root}}' has NO store.ts. A feature either carries state (→ exactly one " +
				"store.ts, a single MST root store) or it is not a feature. Review: (a) state hidden in a " +
				"shadow store (class with instance fields / module singleton) → replace it with an MST " +
				"store.ts; (b) no state at all → it is not a feature — break it into actions/events/" +
				"handlers/utilities, or delete it — a folder carrying no state anywhere is DERIVED as " +
				"not-a-feature and is never reported (no list to update); (c) the state belongs to " +
				"another feature → move it there. An empty store.ts is " +
				"never the answer — a store without data is a lie.",
			featureStoreEmpty:
				"Feature root '{{root}}' has a store.ts with NO exports — a store without data is a lie. " +
				"Review: either this store must actually carry the feature's state (merge any shadow " +
				"store INTO it — or into the existing store of the feature that truly owns that state, " +
				"re-pointing all usage through getStore), or this is not a feature: break the folder into " +
				"actions/events/handlers/utilities, or delete it, or move it where it belongs.",
		},
	},

	create(context) {
		const options = context.options[0] ?? {}
		// NOTE: ESLint does NOT apply schema `default` values — always fall back here.
		const roots = options.roots ?? ["backend/features/", "backend/services/", "frontend/src/features/"]
		// Generic debt filter: the rule itself stays total; the machine-generated ledger only
		// silences the exact (file, messageId) findings that predate the rule.
		context = applyDebt(context, options.debt)

		/**
		 * If the given directory IS a feature root (a direct child of a
		 * configured feature-root prefix), return its name; otherwise null.
		 * Only the feature root's OWN directory matches — subfolders do not.
		 * @param {string} dirname
		 * @returns {string | null}
		 */
		function featureRootName(dirname) {
			const norm = dirname.replace(/\\/g, "/")
			// CWD-INDEPENDENT: eslint may be run from the repo root
			// (filename "backend/services/x/...") or from inside a package
			// (filename "services/x/..."), so each root is matched both as-is
			// and with its leading package segment (e.g. "backend/") stripped.
			// The rightmost match wins so "frontend/src/features/" beats "features/".
			let best = null
			let bestIdx = -1
			for (const root of roots) {
				const matchers = [root]
				const firstSeg = root.indexOf("/")
				if (firstSeg > 0) matchers.push(root.slice(firstSeg + 1))
				for (const m of matchers) {
					const idx = norm.lastIndexOf(m)
					if (idx < 0) continue
					const rest = norm.slice(idx + m.length)
					if (rest.includes("/")) continue // a subfolder (or deeper) of the feature root
					if (rest === "") continue // the feature root itself, not a child
					if (idx > bestIdx) {
						bestIdx = idx
						best = rest
					}
				}
			}
			return best
		}

		return {
			Program(node) {
				const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
				const dirname = path.dirname(filename)
				const basename = path.basename(filename)

				const rootName = featureRootName(dirname)
				if (!rootName) return

				const files = listFiles(dirname)
				// Already has a store file? Then it must not be EMPTY (no exports
				// at all) — a store without data is a lie (user mandate 2026-09-15).
				const storeFile = files.includes("store.ts")
					? "store.ts"
					: files.includes("store.tsx")
						? "store.tsx"
						: null
				if (storeFile) {
					// Report the empty-store finding exactly ONCE, anchored on the
					// store file itself.
					if (basename === storeFile) {
						const content = readStoreContent(path.join(dirname, storeFile))
						if (content !== null && !hasAnyExport(content)) {
							context.report({
								node,
								messageId: "featureStoreEmpty",
								data: { root: rootName },
							})
						}
					}
					return
				}
				// No store.ts. Whether that is a violation depends on what the folder actually
				// CONTAINS: a folder carrying no state at all is not a feature — not a finding.
				if (!carriesState(dirname, files)) return
				// Report exactly ONCE per feature root: anchor on the index.ts
				// (the public API entry point) when present, else the
				// alphabetically-first .ts file.
				const hasIndex = files.includes("index.ts") || files.includes("index.tsx")
				let isAnchor = false
				if (hasIndex) {
					isAnchor = basename === "index.ts" || basename === "index.tsx"
				} else {
					const tsFiles = files.filter((f) => f.endsWith(".ts")).sort()
					isAnchor = tsFiles.length > 0 && basename === tsFiles[0]
				}
				if (!isAnchor) return

				context.report({
					node,
					messageId: "featureMissingStore",
					data: { root: rootName },
				})
			},
		}
	},
}

export default noFeatureStoreRule
