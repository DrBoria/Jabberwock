import path from "node:path"

/**
 * Check if a file path contains a segment (e.g., "events/actions" or "events/handlers").
 * @param {string} normalizedPath
 * @param {string} segment
 * @returns {boolean}
 */
function pathContains(normalizedPath, segment) {
	return normalizedPath.includes("/" + segment + "/")
}

/** @type {import("eslint").Rule.RuleModule} */
const noLogicInIndexRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow logic in index.ts/index.tsx files. Index files should only contain import/export statements. " +
				"In events/actions/ and events/handlers/, empty barrel files (export {}) are also forbidden.",
		},
		schema: [],
		messages: {
			logicInIndex: "Index files must not contain logic. Only imports and re-exports are allowed here.",
			emptyBarrelInEvents:
				"Empty barrel file in 'events/actions/' or 'events/handlers/'. This file should be deleted — it has no real exports. " +
				"If events/actions/ directory is unused, remove it entirely.",
		},
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const normalizedPath = filename.replace(/\\/g, "/")
		const basename = path.basename(filename)
		const isIndexFile = /^index\.[a-z]+$/.test(basename)

		if (!isIndexFile) {
			return {}
		}

		const isInEventsActions = pathContains(normalizedPath, "events/actions")
		const isInEventsHandlers = pathContains(normalizedPath, "events/handlers")
		const checkEmptyBarrel = isInEventsActions || isInEventsHandlers

		let hasRealExport = false
		let hasOnlyEmptyExport = true

		return {
			Program(program) {
				for (const node of program.body) {
					if (isAllowedInIndex(node)) {
						// Track if this is a real export or just export {}
						if (
							node.type === "ExportNamedDeclaration" &&
							!node.declaration &&
							!node.source &&
							node.specifiers.length === 0
						) {
							// This is `export {}` — empty barrel marker
							continue
						}
						// Any other export/import is a real export
						if (node.type !== "ImportDeclaration") {
							hasRealExport = true
							hasOnlyEmptyExport = false
						}
						continue
					}

					// If we reach here, there's actual logic in index — always an error
					context.report({ node, messageId: "logicInIndex" })
					hasOnlyEmptyExport = false
				}

				// After checking all nodes, if file is in events/actions/ or events/handlers/
				// and has no real exports, it's an empty barrel — error
				if (checkEmptyBarrel && !hasRealExport && hasOnlyEmptyExport) {
					context.report({
						node: program,
						messageId: "emptyBarrelInEvents",
					})
				}
			},
		}
	},
}

function isAllowedInIndex(node) {
	if (node.type === "ImportDeclaration") return true

	if (node.type === "ExportAllDeclaration") return true

	if (node.type === "ExportNamedDeclaration") {
		if (node.declaration) return false
		return true
	}

	return false
}

export default noLogicInIndexRule
