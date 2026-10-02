/**
 * Rule: no-empty-handlers
 *
 * Catches the two "dead code" shapes that hide real problems:
 *
 *   1. emptyCatch        — a `catch { }` block whose only content is a comment
 *                          (or nothing). Swallowing an error silently means the
 *                          failure is invisible: no log, no toast, no rethrow.
 *                          The user's doctrine: there is ONE error mechanism —
 *                          a swallowed catch defeats it.
 *   2. noopExport        — an exported function whose body is empty or only a
 *                          comment ("No-op — …"). An exported no-op is either
 *                          dead (delete it) or a placeholder that should be
 *                          implemented. Either way it is a trap: callers think
 *                          it does something.
 *
 * Detection is by PATTERN across every file in the checked scopes — it is NOT
 * scoped to a specific folder. A catch is "empty" when its block has no
 * statements (comments do not count). An export is a "noop" when its body block
 * has no statements.
 *
 * Fix:
 *   - emptyCatch  → log through the single logger (jabberwockLog), surface a
 *                   toast via the error mechanism, or rethrow. Never `catch {}`.
 *   - noopExport  → implement it, or delete the export and its call sites.
 */

/**
 * Does a BlockStatement contain any executable statement? Comments and
 * directives are not statements, so a block that is only comments is empty.
 * @param {object} block
 * @returns {boolean}
 */
function blockHasStatements(block) {
	if (!block || !Array.isArray(block.body)) return false
	return block.body.length > 0
}

/** @type {import("eslint").Rule.RuleModule} */
const noEmptyHandlersRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow empty catch blocks (only a comment or nothing) and exported no-op functions " +
				"(empty body / comment-only). A swallowed error defeats the single error mechanism " +
				"(log + toast + rethrow); an exported no-op is dead code or an unimplemented placeholder.",
		},
		schema: [
			{
				type: "object",
				properties: {
					includes: {
						type: "array",
						items: { type: "string" },
						description: "Path prefixes to check. Default: ['backend/', 'frontend/src/', 'apps/'].",
					},
					excludePaths: {
						type: "array",
						items: { type: "string" },
						description: "Substrings of file paths excluded from the check.",
					},
					debt: {
						type: "array",
						items: { type: "string" },
						description:
							"DEBT LEDGER — file paths (relative, or substrings) that are grandfathered. " +
							"The rule stays fully generic; this list only records PRE-EXISTING violations so " +
							"the build stays green while they are migrated. It must shrink over time and end " +
							"empty. New files are NEVER added here.",
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			emptyCatch:
				"Empty catch block: the error is swallowed (no log, no toast, no rethrow). Use the single error mechanism — log via jabberwockLog, surface a toast, or rethrow. A silent catch hides the failure.",
			noopExport:
				"Exported no-op: '{{name}}' has an empty body (comment only). Either implement it or delete the export and its call sites — an exported no-op is a trap.",
		},
	},
	create(context) {
		const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
		const options = context.options[0] ?? {}
		const includes = options.includes ?? ["backend/", "frontend/src/", "apps/"]
		const excludePaths = options.excludePaths ?? [".test.", ".spec.", "__mocks__", "dist/"]
		const debt = options.debt ?? []

		if (!includes.some((p) => filename.includes(p))) return {}
		if (excludePaths.some((ex) => filename.includes(ex))) return {}
		// Debt ledger: pre-existing violations, grandfathered. Shrinks to [].
		if (debt.some((d) => filename.includes(d))) return {}

		return {
			// 1) empty catch blocks
			CatchClause(node) {
				if (!blockHasStatements(node.body)) {
					context.report({ node, messageId: "emptyCatch" })
				}
			},
			// 2) exported no-op functions
			ExportNamedDeclaration(node) {
				const d = node.declaration
				if (!d) return
				const candidates = []
				if (d.type === "FunctionDeclaration" && d.id) {
					candidates.push({ name: d.id.name, body: d.body })
				} else if (d.type === "VariableDeclaration") {
					for (const dec of d.declarations) {
						const init = dec.init
						if (init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
							const name = dec.id && dec.id.type === "Identifier" ? dec.id.name : null
							if (name && init.body && init.body.type === "BlockStatement") {
								candidates.push({ name, body: init.body })
							}
						}
					}
				}
				for (const c of candidates) {
					if (!blockHasStatements(c.body)) {
						context.report({ node: d, messageId: "noopExport", data: { name: c.name } })
					}
				}
			},
		}
	},
}

export default noEmptyHandlersRule
