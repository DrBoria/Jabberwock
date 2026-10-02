import { applyDebt } from "../debt/debt.js"

/** @type {import("eslint").Rule.RuleModule} */
const noPassthroughRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow exported functions that do nothing except call another function and return its result.",
		},
		fixable: "code",
		schema: [
			{
				type: "object",
				properties: {
					debt: {
						type: "object",
						additionalProperties: { type: "number" },
						description:
							"MACHINE-GENERATED ledger (reports/lint-debt.json): '<file>::<messageId>' → allowed " +
							"count. Never hand-edited, never disables the rule for a whole file, only shrinks.",
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			passthrough:
				"'{{name}}' is an exported passthrough wrapper that only calls '{{target}}'. Extract the file's logic or remove this function.",
		},
	},
	create(context) {
		const options = context.options?.[0] ?? {}
		// Generic debt filter: the rule itself stays total; the machine-generated ledger only
		// silences the exact (file, messageId) findings that predate the rule.
		context = applyDebt(context, options.debt)
		const filename = context.filename ?? context.getFilename()

		/** @type {Array<{node: import("estree").Function, name: string | null}>} */
		const candidates = []

		/** @type {Set<string>} */
		const exportedNames = new Set()

		return {
			// ----- Collect all function candidates -----
			FunctionDeclaration(node) {
				candidates.push({ node, name: node.id?.name ?? null })
			},
			FunctionExpression(node) {
				candidates.push({ node, name: getCandidateName(node) })
			},
			ArrowFunctionExpression(node) {
				candidates.push({ node, name: getCandidateName(node) })
			},

			// ----- Collect all exported names -----
			ExportNamedDeclaration(node) {
				if (node.declaration) {
					if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
						exportedNames.add(node.declaration.id.name)
					} else if (node.declaration.type === "VariableDeclaration") {
						for (const decl of node.declaration.declarations) {
							if (decl.id?.type === "Identifier") {
								exportedNames.add(decl.id.name)
							}
						}
					}
				}
				if (node.specifiers) {
					for (const spec of node.specifiers) {
						exportedNames.add(spec.local.name)
					}
				}
			},

			// ----- Check all candidates after full traversal -----
			"Program:exit"() {
				for (const { node, name } of candidates) {
					const isExported = checkIsExported(node, name, exportedNames)
					if (!isExported) continue

					const returnArg = getReturnExpression(node)
					if (!returnArg || returnArg.type !== "CallExpression") continue

					// Skip if any argument is a lambda (e.g. .map(m => ...), .filter(m => ...)).
					// True passthroughs never pass lambdas — they forward their own params.
					if (returnArg.arguments.some(isLambda)) continue

					const funcName = getFunctionName(node)
					const target = getCallTarget(returnArg)
					// Hook composition is legitimate: a `useX` hook that delegates to
					// another `use*` hook (e.g. `useQuery`) is the standard React
					// pattern for domain-scoped hooks — it is NOT a passthrough smell.
					if (funcName.startsWith("use") && target.startsWith("use")) continue
					context.report({
						node,
						messageId: "passthrough",
						data: { name: funcName, target },
					})
				}
			},
		}
	},
}

/**
 * Get the candidate name for tracking whether the function might be indirectly exported.
 */
function getCandidateName(node) {
	if (node.type === "FunctionDeclaration") {
		return node.id?.name ?? null
	}
	if (node.parent?.type === "VariableDeclarator") {
		return node.parent.id?.type === "Identifier" ? node.parent.id.name : null
	}
	if (node.parent?.type === "AssignmentExpression") {
		return node.parent.left?.type === "Identifier" ? node.parent.left.name : null
	}
	return null
}

/**
 * Check if a function node is exported -- either directly or indirectly.
 *
 * "Directly" means the AST parent chain includes ExportNamedDeclaration/ExportDefaultDeclaration.
 * "Indirectly" means the function/variable name appears in an `export { name }` statement.
 */
function checkIsExported(node, name, exportedNames) {
	if (node.parent?.type === "ExportNamedDeclaration" || node.parent?.type === "ExportDefaultDeclaration") {
		return true
	}

	if (node.parent?.type === "VariableDeclarator") {
		if (
			node.parent.parent?.type === "VariableDeclaration" &&
			node.parent.parent.parent?.type === "ExportNamedDeclaration"
		) {
			return true
		}
		if (name && exportedNames.has(name)) {
			return true
		}
	}

	if (name && exportedNames.has(name)) {
		return true
	}

	return false
}

/**
 * Extract the return expression from a function node.
 *
 * Two shapes count as a passthrough return:
 *   1. a single-statement body whose only statement is `return <call>`;
 *   2. a multi-statement body where the LAST statement is `return <call>` and
 *      every earlier statement is a `const` initializer that contains NO call
 *      (e.g. `const intent = IntentConstants.messages.AGENT_BROADCAST`).
 *
 * Shape 2 was the gap that let `agentBroadcast` / `mcpBroadcast` / etc. pass:
 * `const intent = <constant>; return emitBroadcast(taskId, intent, …)` is a
 * passthrough wrapper even though the body has two statements. The "no call in
 * the earlier initializers" requirement keeps genuine logic (which computes via
 * a call) out of scope.
 */
function getReturnExpression(node) {
	if (node.body.type === "BlockStatement") {
		const stmts = node.body.body
		if (stmts.length === 1) {
			const first = stmts[0]
			if (first.type !== "ReturnStatement" || !first.argument) return null
			return first.argument
		}
		// Multi-statement: last statement must be `return <call>`, and every
		// earlier statement must be a call-free `const` initializer.
		const last = stmts[stmts.length - 1]
		if (!last || last.type !== "ReturnStatement" || !last.argument) return null
		if (last.argument.type !== "CallExpression") return null
		for (let i = 0; i < stmts.length - 1; i++) {
			const s = stmts[i]
			if (!s || s.type !== "VariableDeclaration" || s.kind !== "const") return null
			for (const dec of s.declarations) {
				if (!dec.init || containsCallExpression(dec.init)) return null
			}
		}
		return last.argument
	}
	if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement") {
		return node.body
	}
	return null
}

/** True if the expression subtree contains any CallExpression (a real computation). */
function containsCallExpression(node) {
	if (!node || typeof node.type !== "string") return false
	if (node.type === "CallExpression" || node.type === "NewExpression") return true
	for (const key of Object.keys(node)) {
		if (key === "parent") continue
		const child = node[key]
		if (Array.isArray(child)) {
			for (const c of child) if (c && typeof c.type === "string" && containsCallExpression(c)) return true
		} else if (child && typeof child.type === "string" && containsCallExpression(child)) {
			return true
		}
	}
	return false
}

/** Check if an AST node is a function expression or arrow function. */
function isLambda(node) {
	return node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression"
}

function getFunctionName(node) {
	if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
		return node.id?.name || "(anonymous)"
	}
	const parent = node.parent
	if (!parent) return "(anonymous)"

	if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
		return parent.id.name
	}
	if (parent.type === "Property" && parent.key.type === "Identifier") {
		return parent.key.name
	}
	if (parent.type === "AssignmentExpression" && parent.left.type === "Identifier") {
		return parent.left.name
	}
	return "(anonymous)"
}

function getCallTarget(expr) {
	const callee = expr.callee
	if (callee.type === "Identifier") return callee.name
	if (callee.type === "MemberExpression") {
		const object =
			callee.object.type === "ThisExpression"
				? "this"
				: callee.object.type === "Identifier"
					? callee.object.name
					: "?"
		const prop = callee.property.type === "Identifier" ? callee.property.name : "?"
		return `${object}.${prop}`
	}
	return "(expression)"
}

export default noPassthroughRule
