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
 * Sanctioned exceptions (NOT reported) — an EXPLICIT allowlist, never a shape
 * match (same doctrine as no-shadow-store's `exemptions`):
 *   - `exemptClassNames` : class names that are framework-mandated and cannot be
 *                          flattened (e.g. `Error` subclasses are idiomatic TS,
 *                          and some host APIs require a class). Each entry must
 *                          be a deliberate, named decision.
 *   - `exemptPaths`      : file paths (substring/glob) that are exempt in their
 *                          entirety (tests, mocks, dist, connectors = composition
 *                          root, and any file where a class is genuinely
 *                          unavoidable).
 *
 * The point of the rule is to make every class VISIBLE as debt. A class that
 * survives review is added to `exemptClassNames` with a reason — it is never
 * silently allowed.
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

/** @type {import("eslint").Rule.RuleModule} */
const noClassesRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Ban `class` declarations. A class is a shadow store wearing a costume: instance " +
				"fields are module state that belong in the feature's single MST store, and the class " +
				"is the hidden accessor surface. Flatten to plain module functions + an MST model, or " +
				"fold into the feature's store.ts. Survivors are added to an explicit allowlist, never " +
				"silently allowed.",
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
					exemptClassNames: {
						type: "array",
						items: { type: "string" },
						description:
							"EXPLICIT allowlist of class names that are framework-mandated and cannot be " +
							"flattened (e.g. Error subclasses, host-API classes). Each entry is a deliberate, " +
							"named decision — never a shape match.",
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
				"MST action, read from the store). If a class is genuinely unavoidable (Error subclass, " +
				"host API), add its name to the rule's explicit exemptClassNames with a reason — never " +
				"silently allow it.",
		},
	},

	create(context) {
		const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
		const options = context.options[0] ?? {}
		// NOTE: ESLint does NOT apply schema `default` values — always fall back here.
		const includes = options.includes ?? ["backend/", "frontend/src/", "apps/cli/"]
		const exemptPaths = options.exemptPaths ?? [".test.", ".spec.", "__mocks__", "dist/", "connectors/"]
		const exemptClassNames = new Set(options.exemptClassNames ?? [])

		if (!includes.some((p) => filename.includes(p))) return {}
		if (exemptPaths.some((ex) => matchesExemption(ex, filename))) return {}

		/** @param {object} node */
		function reportClass(node) {
			const name =
				(node.id && node.id.name) || (node.parent && node.parent.id && node.parent.id.name) || "(anonymous)"
			if (exemptClassNames.has(name)) return
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
