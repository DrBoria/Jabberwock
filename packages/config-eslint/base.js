import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import turboPlugin from "eslint-plugin-turbo"
import tseslint from "typescript-eslint"
import eslintComments from "eslint-plugin-eslint-comments"
import noPassthrough from "./rules/no-passthrough.js"
import noReexport from "./rules/no-reexport.js"
import noLogicInIndex from "./rules/no-logic-in-index.js"
import noStoreOutsideStore from "./rules/no-store-outside-store.js"
import noDynamicImports from "./rules/no-dynamic-imports.js"
import noComplexFolderStructure from "./rules/no-complex-folder-structure.js"
import noMisplacedConcern from "./rules/no-misplaced-concern.js"
import noStateOutsideMobx from "./rules/no-state-outside-mobx.js"

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
	js.configs.recommended,
	eslintConfigPrettier,
	...tseslint.configs.recommended,
	{
		plugins: {
			turbo: turboPlugin,
			"eslint-comments": eslintComments,
			local: {
				rules: {
					"no-passthrough": noPassthrough,
					"no-reexport": noReexport,
					"no-logic-in-index": noLogicInIndex,
					"no-store-outside-store": noStoreOutsideStore,
					"no-dynamic-imports": noDynamicImports,
					"no-complex-folder-structure": noComplexFolderStructure,
					"no-misplaced-concern": noMisplacedConcern,
					"no-state-outside-mobx": noStateOutsideMobx,
				},
			},
		},
		rules: {
			"turbo/no-undeclared-env-vars": "off",
			"local/no-passthrough": "error",
			"local/no-reexport": "error",
			"local/no-logic-in-index": "error",
			"local/no-store-outside-store": "error",
			"local/no-dynamic-imports": "error",
			"local/no-complex-folder-structure": [
				"error",
				{
					maxFilesPerFolder: 7,
					noFolderNameInFilename: true,
					noDuplicateBasenamePrefix: true,
					includes: ["*.ts", "*.tsx"],
				},
			],
			"local/no-misplaced-concern": [
				"error",
				{
					includes: ["src/", "webview-ui/src/"],
				},
			],
			"local/no-state-outside-mobx": [
				"error",
				{
					includes: ["src/", "webview-ui/src/", "apps/cli/"],
					excludedFiles: ["useRootStore\\.ts$", "TerminalSizeContext\\.tsx$", "form\\.tsx$", "context\\.ts$"],
				},
			],
			"eslint-comments/no-restricted-disable": [
				"error",
				"max-lines",
				"@typescript-eslint/no-explicit-any",
				"local/no-passthrough",
				"local/no-reexport",
				"local/no-logic-in-index",
				"local/no-store-outside-store",
				"local/no-dynamic-imports",
				"local/no-complex-folder-structure",
				"local/no-misplaced-concern",
				"local/no-state-outside-mobx",
			],
		},
	},
	{
		ignores: ["dist/**"],
	},
	{
		rules: {
			"no-undef": "off",
			complexity: ["error", 10],
			"max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
			"max-len": [
				"error",
				{
					code: 120,
					tabWidth: 4,
					ignoreUrls: true,
					ignoreStrings: true,
					ignoreTemplateLiterals: true,
					ignoreRegExpLiterals: true,
					ignoreComments: true,
				},
			],
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "error",
		},
	},
	{
		files: ["**/*.spec.ts", "**/*.spec.tsx", "**/__tests__/**"],
		rules: {
			"max-lines": "off",
			"max-len": "off",
		},
	},
]
