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
 *                                 (or delete it), then add it to
 *                                 `statelessFeatures` with a reason;
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
 * Sanctioned exceptions (NOT reported) — an EXPLICIT allowlist, never a shape
 * match (same doctrine as no-shadow-store / no-classes):
 *   - `statelessFeatures` : feature names that are genuinely stateless (pure
 *                          utilities, parsers, I/O wrappers) and have been
 *                          reviewed as such. Each entry is a deliberate decision.
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

/** @type {import("eslint").Rule.RuleModule} */
const noFeatureStoreRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A feature-root folder must contain a single store.ts (one MST root store). A feature " +
				"either carries state (→ exactly one store.ts) or it is not a feature (→ break it into " +
				"actions/events/handlers/utilities or delete it, then allowlist it as stateless). An " +
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
					statelessFeatures: {
						type: "array",
						items: { type: "string" },
						description:
							"EXPLICIT allowlist of feature names that are genuinely stateless (pure " +
							"utilities / parsers / I/O wrappers), reviewed and decided. Each entry is a " +
							"deliberate decision — never a shape match.",
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
				"handlers/utilities or delete it, then add it to the rule's statelessFeatures with a " +
				"reason; (c) the state belongs to another feature → move it there. An empty store.ts is " +
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
		const statelessFeatures = new Set(options.statelessFeatures ?? [])

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
				if (statelessFeatures.has(rootName)) return

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
