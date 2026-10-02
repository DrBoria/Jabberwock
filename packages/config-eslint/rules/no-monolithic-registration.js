/**
 * D51 finding (refactor.md): P10 monolithic registration.
 *
 * v2 plan (architectural-restructure-v2.md, P5/P10): one handler file registers
 * ONE intent — the filename IS the event. A function body that registers many
 * intents (`bus.register(...)` / `provider.onWebviewMessage(...)`) is a
 * monolithic registration: it hides the event→handler mapping, makes
 * per-event unit testing impossible and couples unrelated events.
 *
 * The rule counts registration calls inside each function body and reports the
 * function when the count exceeds `maxRegistrations` (default 1). Registration
 * *wiring* files (a per-event file's `export function register() { bus.register
 * (ONE) }`) stay clean; the violation is N registrations in one function, e.g.
 * `on-cloud.ts` (~10 `bus.register`) or `register-on-window-manager-intents.ts`
 * (8 inline `onWebviewMessage`).
 */

const DEFAULT_REGISTRATION_NAMES = ["register", "onWebviewMessage", "onMessage"]

/** @type {import("eslint").Rule.RuleModule} */
const noMonolithicRegistrationRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Ban monolithic registration: one function body must register at most N intents (v2 plan P10).",
		},
		schema: [
			{
				type: "object",
				properties: {
					maxRegistrations: {
						type: "number",
						description: "Max registration calls per function body (default 1).",
						default: 1,
					},
					registrationNames: {
						type: "array",
						items: { type: "string" },
						description:
							"Method names counted as registrations (default: register, onWebviewMessage, onMessage).",
						default: DEFAULT_REGISTRATION_NAMES,
					},
					excludePaths: {
						type: "array",
						items: { type: "string" },
						description: "Substrings of file paths excluded from the check.",
						default: [],
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			monolithicRegistration:
				"Function '{{name}}' contains {{count}} intent registrations (max {{max}}). " +
				"v2 plan (architectural-restructure-v2.md, P5/P10): one handler file registers ONE intent — " +
				"the filename IS the event. Split each registration into its own on-<event>.ts handler file " +
				"and keep the aggregate file a thin re-export of the per-event register functions.",
		},
	},
	create(context) {
		const options = context.options[0] ?? {}
		// NOTE: ESLint does NOT apply schema `default` values — always fall back here.
		const maxRegistrations = options.maxRegistrations ?? 1
		const registrationNames = new Set(options.registrationNames ?? DEFAULT_REGISTRATION_NAMES)
		const excludePaths = options.excludePaths ?? []

		const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
		if (excludePaths.some((ex) => filename.includes(ex))) return {}

		/**
		 * Whether the call expression is a registration call.
		 * @param {import("estree").Node} node
		 * @returns {boolean}
		 */
		function isRegistration(node) {
			if (node.type !== "CallExpression") return false
			const callee = node.callee
			if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
				return registrationNames.has(callee.property.name)
			}
			if (callee.type === "Identifier") return registrationNames.has(callee.name)
			return false
		}

		/**
		 * Count registrations at the top level of a function body (a
		 * registration may be a plain expression, awaited, returned or
		 * assigned to a variable).
		 * @param {import("estree").Node} funcNode
		 * @param {import("estree").BlockStatement} body
		 * @param {string} name
		 */
		function checkBody(funcNode, body, name) {
			let total = 0
			for (const stmt of body.body) {
				total += count(stmt)
			}
			if (total > maxRegistrations) {
				context.report({
					node: funcNode,
					messageId: "monolithicRegistration",
					data: { name, count: total, max: maxRegistrations },
				})
			}
		}

		/**
		 * Shallow count (0..n) of registration calls in one top-level
		 * statement, unwrapping ExpressionStatement / AwaitExpression /
		 * ReturnStatement / VariableDeclaration wrappers.
		 * @param {import("estree").Node} stmt
		 * @returns {number}
		 */
		function count(stmt) {
			if (stmt.type === "ExpressionStatement") {
				let expr = stmt.expression
				if (expr.type === "AwaitExpression") expr = expr.argument
				return isRegistration(expr) ? 1 : 0
			}
			if (stmt.type === "ReturnStatement") {
				return stmt.argument && isRegistration(stmt.argument) ? 1 : 0
			}
			if (stmt.type === "VariableDeclaration") {
				let n = 0
				for (const decl of stmt.declarations) {
					if (decl.init && isRegistration(decl.init)) n += 1
				}
				return n
			}
			return 0
		}

		/** @param {import("estree").Node} node */
		function visitFunction(node, name) {
			if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
				// A nested function's registrations belong to that function;
				// skip nodes whose body is a BlockStatement we visit separately.
				if (node.body.type === "BlockStatement") checkBody(node, node.body, name)
			}
		}

		return {
			FunctionDeclaration(node) {
				if (node.body.type === "BlockStatement") {
					checkBody(node, node.body, node.id?.name ?? "<anonymous>")
				}
			},
			FunctionExpression(node) {
				visitFunction(node, node.id?.name ?? "<anonymous>")
			},
			ArrowFunctionExpression(node) {
				if (node.body.type === "BlockStatement") {
					const name =
						node.parent?.type === "VariableDeclarator" && node.parent.id
							? node.parent.id.name
							: "<anonymous>"
					checkBody(node, node.body, name)
				}
			},
		}
	},
}

export default noMonolithicRegistrationRule
