import { config } from "@jabberwock/config-eslint/base"
import { providerSdkDebt } from "@jabberwock/config-eslint/debt/import-debt"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

// ——— v4 purity (plan §8.2): backend must not import the "vscode" module outside connectors/vscode/backend ———
// The allowlist below is DERIVED from "the" committed baseline artifact reports/audit-platform.json (Phase A0) and may only
// shrink as phases B/C remove violations: after any step that changes the inventory, re-run `pnpm audit:platform --write-baseline`
// so this list follows automatically. If the report is missing/unreadable we fall back to strict mode (empty allowlist).

function loadVscodeAllowlist() {
	const configDir = path.dirname(fileURLToPath(import.meta.url))
	const reportPath = path.resolve(configDir, "..", "reports", "audit-platform.json")
	if (!existsSync(reportPath)) return []
	try {
		const report = JSON.parse(readFileSync(reportPath, "utf8"))
		return [...new Set(report.entries.filter((e) => e.side === "backend").map((e) => e.file.slice(String(report.backendDir).length + 1)))].sort()
	} catch (err) {
		console.warn(`[eslint] audit-platform report unreadable (${reportPath}); enforcing strict vscode-purity: ${String(err)}`)
		return []
	}
}

const VSCODE_ALLOWLIST = loadVscodeAllowlist() // package-relative globs; regenerated from "reports/audit-platform.json" (A0 baseline, only shrinks per §11)

// shared rule fragments so the relative-import hygiene pattern is defined exactly once:
const RELATIVE_IMPORT_PATTERN = {
	group: ["../**", ".."],
	message: "Use absolute imports (@features/, @utils/, @i18n, etc.) instead of relative parent imports. Only ./ (same-directory) imports are allowed.",
}
const VSCODE_PATH_RESTRICTION = [
	{
		name: "vscode",
		message: 'v4 purity G6 (§8): backend must not import the "vscode" module — host access goes through connectors/vscode/backend. Remove this file from "reports/audit-platform.json" only after its vscode usage is migrated (plan §2.3).',
	},
]

// Per-file overrides for files still carrying baseline vscode debt: keep relative-import hygiene active, allow "vscode" until migrated.
const VSCODE_ALLOWLIST_OVERRIDES = VSCODE_ALLOWLIST.map((glob) => ({
	files: [glob],
	rules: {
		"no-restricted-imports": ["error", { patterns: [RELATIVE_IMPORT_PATTERN] }],
	},
}))

// ——— Provider-SDK purity (v4 §1.3a): the app layer (actions / handlers / events) must be provider-agnostic ———
// Only the provider layer (backend/api/providers/**, backend/api/handler.ts, backend/api/transform/**) may import an
// LLM SDK. Actions, handlers and events must never know about anthropic / lm studio / llama.cpp / openai / … — they
// speak the app's neutral content-block types and the api boundary maps them to the provider's wire format.
const PROVIDER_SDK_RESTRICTION = [
	{ name: "@anthropic-ai/sdk", message: "Provider-SDK purity: actions/handlers/events must be provider-agnostic. Import the app's neutral content-block types, not the Anthropic SDK — the api boundary maps to the provider wire format." },
	{ name: "openai", message: "Provider-SDK purity: actions/handlers/events must be provider-agnostic. Do not import the OpenAI SDK in the app layer." },
	{ name: "@google/genai", message: "Provider-SDK purity: actions/handlers/events must be provider-agnostic. Do not import the Google GenAI SDK in the app layer." },
	{ name: "ollama", message: "Provider-SDK purity: actions/handlers/events must be provider-agnostic. Do not import the Ollama SDK in the app layer." },
	{ name: "@mistralai/mistralai", message: "Provider-SDK purity: actions/handlers/events must be provider-agnostic. Do not import the Mistral SDK in the app layer." },
	{ name: "@aws-sdk/client-bedrock", message: "Provider-SDK purity: actions/handlers/events must be provider-agnostic. Do not import the AWS Bedrock SDK in the app layer." },
	{ name: "@anthropic-ai/vertex", message: "Provider-SDK purity: actions/handlers/events must be provider-agnostic. Do not import the Anthropic Vertex SDK in the app layer." },
]

// Debt allowlist: files still importing a provider SDK in the app layer. MACHINE-GENERATED from the
// source tree by scripts/gen-import-debt.mjs — a hand-maintained list of paths in a config is exactly
// what we are removing: it stops matching as soon as the code moves on. Only shrinks.
const PROVIDER_SDK_DEBT_ALLOWLIST = providerSdkDebt

// Scoped ban: applies to the app layer only. Placed BEFORE VSCODE_ALLOWLIST_OVERRIDES so that a file in the
// intersection (vscode debt AND app layer) keeps its vscode allowance — flat config: later block wins.
const PROVIDER_SDK_BAN = {
	files: ["**/actions/**/*.ts", "**/handlers/**/*.ts", "**/events/**/*.ts"],
	rules: {
		"no-restricted-imports": ["error", { paths: PROVIDER_SDK_RESTRICTION }],
	},
}
const PROVIDER_SDK_DEBT_OVERRIDES = PROVIDER_SDK_DEBT_ALLOWLIST.map((glob) => ({
	files: [glob],
	rules: {
		"no-restricted-imports": ["error", { patterns: [RELATIVE_IMPORT_PATTERN] }],
	},
}))

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	{
		rules: {
			"no-regex-spaces": "off",
			"no-useless-escape": "off",
			"no-empty": "off",
			"prefer-const": "off",

			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-require-imports": "off",
			// AGENTS.md doctrine: `@ts-ignore` and `@ts-nocheck` are forbidden — they
			// switch TypeScript off instead of fixing the type. The sanctioned escape
			// is `@ts-expect-error` WITH a description (it fails loudly once the error
			// disappears, so the suppression cannot rot).
			"@typescript-eslint/ban-ts-comment": [
				"error",
				{
					"ts-ignore": true,
					"ts-nocheck": true,
					"ts-check": false,
					"ts-expect-error": "allow-with-description",
					minimumDescriptionLength: 10,
				},
			],

			// ——— Strict type hygiene — forcing specific, meaningful types ———
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-empty-object-type": [
				"error",
				{ allowInterfaces: "never", allowObjectTypes: "never" },
			],
			"no-restricted-imports": [
				"error",
				{
					patterns: [RELATIVE_IMPORT_PATTERN],
					paths: VSCODE_PATH_RESTRICTION, // v4 G6 purity — allowlist overrides below (only shrinks)
				},
			],

			// ——— Strict type hygiene — forcing specific, meaningful types ———
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
	PROVIDER_SDK_BAN, // provider-SDK purity — app layer (actions/handlers/events) must be provider-agnostic (v4 §1.3a)
	...PROVIDER_SDK_DEBT_OVERRIDES, // debt allowlist — only shrinks; remove an entry once its SDK import is at the api boundary
	...VSCODE_ALLOWLIST_OVERRIDES, // v4 A0 baseline allowlist — regenerated from "reports/audit-platform.json"; must only shrink (plan §8.2)
	{
		files: ["core/assistant-message/presentAssistantMessage.ts", "core/webview/webviewMessageHandler.ts"],
		rules: {
			"no-case-declarations": "off",
		},
	},
	// ——— Test files are exempt from "strict" type hygiene (mocks, casts, etc. are normal in tests) ———
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
		ignores: ["out", "dist", "frontend/build"],
	},
]
