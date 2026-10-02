import { config } from "@jabberwock/config-eslint/base"
import { zodDebt } from "@jabberwock/config-eslint/debt/import-debt"
import globals from "globals"

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	{
		files: ["**/*.cjs"],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.commonjs,
			},
			sourceType: "commonjs",
		},
		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},
	// ── v3 plan B6: @jabberwock/types is the shared contract package and must not ──
	// depend on a validation library. Types here are MST-compatible shapes + plain
	// TypeScript guards; runtime validation belongs at the boundary that owns it.
	{
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "zod",
							message:
								"v3 plan B6: @jabberwock/types must not use zod. Replace the schema with an MST type / plain TypeScript type + type guard, or move the validation to the boundary that owns it.",
						},
					],
				},
			],
		},
	},
	// Grandfathered zod users (see debt/zod-debt.js). The ban above applies to every OTHER
	// file, so new zod usage in this package is impossible; the list must only shrink to [].
	...zodDebt.map((file) => ({
		files: [file],
		rules: { "no-restricted-imports": "off" },
	})),
]
