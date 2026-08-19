import path from "node:path"

/** @type {import("eslint").Rule.RuleModule} */
const noReexportRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow re-exports in non-index files. Only index.ts/index.tsx should re-export from other modules.",
		},
		schema: [],
		messages: {
			noReexport:
				"Re-exports are only allowed in index.ts/index.tsx files. Move this export to an index file or import directly.",
		},
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const basename = path.basename(filename)
		const isIndexFile = /^index\.[a-z]+$/.test(basename)

		if (isIndexFile) {
			return {}
		}

		return {
			ExportNamedDeclaration(node) {
				if (!node.source) return
				context.report({ node, messageId: "noReexport" })
			},
			ExportAllDeclaration(node) {
				if (!node.source) return
				context.report({ node, messageId: "noReexport" })
			},
		}
	},
}

export default noReexportRule
