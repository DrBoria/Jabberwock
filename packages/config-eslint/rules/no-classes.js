/**
 * Rule: no-classes
 *
 * Doctrine (user mandate, 2026): a full ban on `class` declarations. A class in
 * this codebase is almost always a shadow store wearing a costume — instance
 * fields (`private skills: SkillMetadata[] = []`) are module state that should
 * live in the feature's single MST store, and the class is the hidden accessor
 * surface around it. Every class is a "full re-review of the logic" trigger:
 * flatten it to plain module functions + an MST model, or fold it into the
 * feature store.
 *
 * What this rule reports:
 *   - classDeclaration : every `class X { ... }` declaration (concrete,
 *                        abstract, or expression). The fix is the same for all:
 *                        no instance state → plain functions; instance state →
 *                        an MST model on the feature's store.ts.
 *
 * Structural exceptions (NOT reported) — recognised SEMANTICALLY, so a case that does not
 * exist yet is covered without editing any config:
 *   - `extends Error` (and the built-in error family): idiomatic TypeScript error typing —
 *     the `instanceof` / `name` / stack contract requires a real class.
 *   - a React error boundary (`getDerivedStateFromError` / `componentDidCatch`): React has
 *     no function-component equivalent for capturing render errors.
 *   - `exemptPaths`: ROLE patterns only (tests, mocks, dist, the composition root, host
 *     integration adapters). Individual files are NEVER listed there — an instance that
 *     survives review belongs in the auto-generated debt ledger.
 */

/**
 * Does the file path match an exemption pattern? A pattern without `*`/`?`
 * is a substring match; otherwise it is a glob (`*` → any run, `?` → one char).
 * @param {string} pattern
 * @param {string} filename
 * @returns {boolean}
 */
function matchesExemption(pattern, filename) {
	if (!pattern.includes("*") && !pattern.includes("?")) return filename.includes(pattern)
	const re =
		"^" +
		pattern
			.split("")
			.map((c) => (c === "*" ? ".*" : c === "?" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
			.join("") +
		"$"
	try {
		return new RegExp(re).test(filename)
	} catch {
		return false
	}
}

import { applyDebt } from "../debt/debt.js"

/** @type {import("eslint").Rule.RuleModule} */
const noClassesRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Ban `class` declarations. A class is a shadow store wearing a costume: instance " +
				"fields are module state that belong in the feature's single MST store, and the class " +
				"is the hidden accessor surface. Flatten to plain module functions + an MST model, or " +
				"fold into the feature's store.ts. Genuinely framework-mandated shapes are recognised " +
				"SEMANTICALLY (`extends Error`, a React error boundary), never by naming classes.",
		},
		schema: [
			{
				type: "object",
				properties: {
					includes: {
						type: "array",
						items: { type: "string" },
						description: "Path prefixes to check. Default: ['backend/', 'frontend/src/', 'apps/cli/'].",
					},
					exemptPaths: {
						type: "array",
						items: { type: "string" },
						description:
							"File paths (substring/glob) exempt in their entirety (tests, mocks, dist, " +
							"connectors = composition root, or a file where a class is genuinely unavoidable).",
					},
					exemptClassNamePattern: {
						type: "string",
						description:
							"Regex source matched against the class NAME (default 'Error$'). A PATTERN, not a " +
							"list: any class whose name matches is exempt, including ones that do not exist yet.",
					},
					exemptSuperClassPattern: {
						type: "string",
						description:
							"Regex source matched against the SUPERCLASS name (default: the built-in Error " +
							"family, plus any name ending in 'Error'). Semantic — a `class X extends YError`" +
							"is idiomatic TS error typing, so it is covered without naming X.",
					},
					exemptReactLifecycle: {
						type: "boolean",
						description:
							"Exempt React error boundaries: `getDerivedStateFromError` / `componentDidCatch` " +
							"are class-component-only lifecycle hooks — React has no function-component " +
							"equivalent (default true).",
					},
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
			classDeclaration:
				"Class '{{name}}' is a shadow store wearing a costume. Doctrine: no classes — instance " +
				"fields are module state that belong in the feature's single MST store, and the class is " +
				"the hidden accessor surface around them. Flatten it: no instance state → plain module " +
				"functions; instance state → an MST model on the feature's store.ts (mutate through an " +
				"MST action, read from the store). An `extends Error` subclass and a React error " +
				"boundary are recognised as structural exceptions — nothing else is.",
		},
	},

	create(context) {
		const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
		const options = context.options[0] ?? {}
		context = applyDebt(context, options.debt)
		// NOTE: ESLint does NOT apply schema `default` values — always fall back here.
		const includes = options.includes ?? ["backend/", "frontend/src/", "apps/cli/"]
		const exemptPaths = options.exemptPaths ?? [".test.", ".spec.", "__mocks__", "dist/", "connectors/"]
		const exemptClassNamePattern = new RegExp(options.exemptClassNamePattern ?? "Error$")
		// `extends Error` and the built-in error family are idiomatic TypeScript error typing:
		// the `instanceof` / `name` / stack contract requires a real class. Matched on the
		// SUPERCLASS, so a subclass written tomorrow is covered without touching any config.
		const exemptSuperClassPattern = new RegExp(
			options.exemptSuperClassPattern ??
				"^(Error|EvalError|RangeError|ReferenceError|SyntaxError|TypeError|URIError)$|Error$",
		)
		const exemptReactLifecycle = options.exemptReactLifecycle ?? true

		/** Identifier / property name behind a node (`Error`, `React.Component`, …). */
		const nameOf = (n) => {
			if (!n) return null
			if (n.type === "Identifier") return n.name
			if (n.type === "MemberExpression" && n.property) return n.property.name
			return null
		}

		/**
		 * A React error boundary can only be a class: React calls `getDerivedStateFromError` /
		 * `componentDidCatch` on the instance, and there is no function-component equivalent
		 * for capturing render errors.
		 */
		function isReactErrorBoundary(node) {
			for (const member of node.body?.body ?? []) {
				const key = nameOf(member.key)
				if (key === "getDerivedStateFromError" || key === "componentDidCatch") return true
			}
			return false
		}

		if (!includes.some((p) => filename.includes(p))) return {}
		if (exemptPaths.some((ex) => matchesExemption(ex, filename))) return {}

		/** @param {object} node */
		function reportClass(node) {
			const name = node.id?.name ?? node.parent?.id?.name ?? "(anonymous)"
			if (exemptClassNamePattern.test(name)) return
			const superName = nameOf(node.superClass)
			if (superName && exemptSuperClassPattern.test(superName)) return
			if (exemptReactLifecycle && isReactErrorBoundary(node)) return
			context.report({ node, messageId: "classDeclaration", data: { name } })
		}

		return {
			"ClassDeclaration, ClassExpression"(node) {
				reportClass(node)
			},
		}
	},
}

export default noClassesRule
