/**
 * Minimal standalone vitest config for the frontend.
 *
 * The main vite.config.ts loads the react + tailwind plugins, which transitively
 * pull in @vite/env — a module that crashes on Node 20 with "Cannot assign to
 * read only property 'platform'". Pure-function unit tests don't need those
 * plugins, so this config only sets up the test environment + path aliases.
 *
 * Run with:  npx vitest run --config vitest-config.ts <file>
 */
import { resolve } from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.test.{ts,tsx}"],
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@src": resolve(__dirname, "./src"),
			"@shared": resolve(__dirname, "../backend/shared"),
			"@intentConstants": resolve(__dirname, "./src/features/intents/IntentConstants"),
			"@eventConstants": resolve(__dirname, "../packages/types/src/events/constants.ts"),
			"@features": resolve(__dirname, "../backend/features"),
			"@services": resolve(__dirname, "../backend/services"),
			"@api": resolve(__dirname, "../backend/api"),
			"@i18n": resolve(__dirname, "../backend/i18n"),
			"@utils": resolve(__dirname, "../backend/utils"),
			"@components": resolve(__dirname, "./src/components"),
			"@sections": resolve(__dirname, "./src/sections"),
			"@packageJson": resolve(__dirname, "../backend/package.json"),
			"@integrations": resolve(__dirname, "../backend/integrations"),
			"json-stream-stringify": resolve(__dirname, "./src/shims/json-stream-stringify.ts"),
		},
	},
})
