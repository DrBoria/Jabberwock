import path from "node:path"

/** @type {import("eslint").Rule.RuleModule} */
const noStoreOutsideStoreRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow MST model creation (types.model(...)) outside of store.ts / store.tsx files. " +
				"Store files must be at the feature root (e.g. features/<feature>/store.ts), not nested " +
				"inside subdirectories or inside a folder named 'store'.",
		},
		schema: [],
		messages: {
			storeOutsideStore:
				"MST model creation via 'types.model()' is only allowed in files named 'store.ts' or 'store.tsx'. " +
				"Move this model definition to the appropriate 'store.ts' file.",
			storeInStoreFolder:
				"Store file (store.ts) must not be inside a folder named 'store'. " +
				"The store belongs at the feature root, e.g. 'features/chat/store.ts', not 'features/chat/store/store.ts'.",
			nestedStore:
				"Store file (store.ts) is too deeply nested. Stores must be at most 2 levels deep from the 'features/' directory. " +
				"Move this model definition to the feature's root store.ts, e.g. 'features/{{feature}}/store.ts'.",
			modelFolderMismatch:
				"MST model '{{modelName}}' has no parent folder containing '{{modelName}}' (case-insensitive). " +
				"Move this store to a folder whose name relates to the model.",
		},
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const basename = path.basename(filename)
		const dirname = path.dirname(filename)
		const parentDirName = path.basename(dirname)

		/**
		 * @param {import("estree").Node} node
		 * @returns {boolean}
		 */
		function isTypesModelCall(node) {
			if (node.callee.type !== "MemberExpression") return false
			const object = node.callee.object
			const property = node.callee.property
			return (
				object.type === "Identifier" &&
				object.name === "types" &&
				property.type === "Identifier" &&
				property.name === "model"
			)
		}

		/**
		 * Extract the model name from a types.model("ModelName", {...}) call.
		 * @param {import("estree").CallExpression} node
		 * @returns {string | null}
		 */
		function getModelName(node) {
			const firstArg = node.arguments[0]
			if (firstArg && firstArg.type === "Literal" && typeof firstArg.value === "string") {
				return firstArg.value
			}
			return null
		}

		/**
		 * Normalize a name by removing hyphens, underscores, and trailing 's'.
		 * @param {string} name
		 * @returns {string}
		 */
		function normalize(name) {
			return name.replace(/[-_]/g, "").replace(/s$/, "")
		}

		/**
		 * Check if any parent directory name matches the model name (case-insensitive, partial match).
		 * The model name should contain the folder name (not the other way around)
		 * since model names like "ChatStore" are longer than folder names like "chat".
		 * @param {string} dirPath
		 * @param {string} modelName
		 * @returns {boolean}
		 */
		function parentFolderContainsModelName(dirPath, modelName) {
			const modelLower = modelName.toLowerCase()
			let current = dirPath
			while (current !== path.dirname(current)) {
				const folderName = path.basename(current).toLowerCase()
				// Check if model name contains the folder name (normalized for plurals and separators)
				if (modelLower.includes(folderName) || normalize(modelLower).includes(normalize(folderName))) {
					return true
				}
				current = path.dirname(current)
			}
			return false
		}

		// ── Non-store files: types.model(...) is forbidden ──────────────
		if (basename !== "store.ts" && basename !== "store.tsx") {
			return {
				CallExpression(node) {
					if (isTypesModelCall(node)) {
						context.report({
							node,
							messageId: "storeOutsideStore",
						})
					}
				},
			}
		}

		// ── We are in a store.ts / store.tsx ────────────────────────────

		return {
			CallExpression(node) {
				if (!isTypesModelCall(node)) return

				// Rule 1: store.ts must not be inside a folder named "store"
				if (parentDirName === "store") {
					context.report({
						node,
						messageId: "storeInStoreFolder",
					})
					return
				}

				// Rule 2 & 3: store.ts must be at the feature root
				// Expected path: .../features/<feature-name>/store.ts
				// The "features" directory marks the root of all features.
				// The store must be exactly 1 directory level below "features"
				// (i.e., features/<feature>/store.ts, NOT features/<feature>/sub/store.ts)
				const featuresIndex = dirname.lastIndexOf(path.sep + "features" + path.sep)
				let depth = 0

				if (featuresIndex !== -1) {
					const afterFeatures = dirname.substring(featuresIndex + "features".length + 2) // +2 for both path separators
					depth = afterFeatures.split(path.sep).filter(Boolean).length

					if (depth > 2) {
						// Extract the feature name (the first directory after "features/")
						const featureName = afterFeatures.split(path.sep)[0]

						context.report({
							node,
							messageId: "nestedStore",
							data: { feature: featureName },
						})
					}
				}

				// Rule 4: Model name should match a parent folder name
				// Skip this check for stores at depth >= 2 (e.g., features/settings/agents/store.ts)
				// since they're already at max nesting and can't create subfolders
				const modelName = getModelName(node)
				if (modelName && depth < 2) {
					const hasMatchingFolder = parentFolderContainsModelName(dirname, modelName)
					if (!hasMatchingFolder) {
						context.report({
							node,
							messageId: "modelFolderMismatch",
							data: { modelName },
						})
					}
				}
			},
		}
	},
}

export default noStoreOutsideStoreRule
