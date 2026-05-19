import { config } from "@jabberwock/config-eslint/base"

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	{
		rules: {
			// TODO: These should be fixed and the rules re-enabled.
			"no-regex-spaces": "off",
			"no-useless-escape": "off",
			"no-empty": "off",
			"prefer-const": "off",

			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/ban-ts-comment": "off",

			// ——— Strict type hygiene — forcing specific, meaningful types ———
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-empty-object-type": [
				"error",
				{ allowInterfaces: "never", allowObjectTypes: "never" },
			],
			"no-restricted-syntax": [
				"error",
				{
					selector: "TSTypeReference[typeName.name='object']",
					message:
						"Use a specific type instead of 'object'. Prefer Record<string, unknown> or an explicit interface.",
				},
				{
					selector: "TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
					message:
						"Avoid 'as unknown' casts. Use proper type guards, type predicates, or well-defined union types instead.",
				},
			],
		},
	},
	{
		files: ["core/assistant-message/presentAssistantMessage.ts", "core/webview/webviewMessageHandler.ts"],
		rules: {
			"no-case-declarations": "off",
		},
	},
	// ——— Test files are exempt from strict type hygiene (mocks, casts, etc. are normal in tests) ———
	{
		files: ["**/__tests__/**", "**/*.spec.ts", "**/*.test.ts", "**/*.benchmark.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-empty-object-type": "off",
			"no-restricted-syntax": "off",
		},
	},
	{
		files: ["__mocks__/**/*.js", "**/*.cjs"],
		rules: {
			"no-undef": "off",
		},
	},
	{
		ignores: ["webview-ui", "out"],
	},
]
