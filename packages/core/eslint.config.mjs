import { config } from "@jabberwock/config-eslint/base"

/** @type {import("eslint").Linter.Config[]} */
export default [
	...config,
	{
		files: ["src/custom-tools/importer.ts"],
		rules: {
			"local/no-dynamic-imports": "off",
		},
	},
]
