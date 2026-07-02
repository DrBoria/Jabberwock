/** @type {import("eslint").Rule.RuleModule} */
const noDynamicImportsRule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow dynamic import() expressions and require() calls with non-literal arguments.",
		},
		schema: [],
		messages: {
			dynamicImport: "Dynamic imports are forbidden. Use static top-level imports instead.",
		},
	},
	create(context) {
		return {
			ImportExpression(node) {
				context.report({
					node,
					messageId: "dynamicImport",
				})
			},
			CallExpression(node) {
				if (
					node.callee.type === "Identifier" &&
					node.callee.name === "require" &&
					(node.arguments.length === 0 ||
						node.arguments[0].type !== "Literal" ||
						typeof node.arguments[0].value !== "string")
				) {
					context.report({
						node,
						messageId: "dynamicImport",
					})
				}
			},
		}
	},
}

export default noDynamicImportsRule
