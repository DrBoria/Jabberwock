import { defineConfig } from "vitest/config"
import path from "path"
import { resolveVerbosity } from "./utils/vitest-verbosity"

const { silent, reporters, onConsoleLog } = resolveVerbosity()

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		watch: false,
		reporters,
		silent,
		testTimeout: 20_000,
		hookTimeout: 20_000,
		onConsoleLog,
	},
	resolve: {
		alias: {
			vscode: path.resolve(__dirname, "./__mocks__/vscode.js"),
			// Mirror backend/tsconfig.json `paths` so vitest resolves the same aliases as tsc/esbuild.
			"@features": path.resolve(__dirname, "./features"),
			"@utils": path.resolve(__dirname, "./utils"),
			"@i18n": path.resolve(__dirname, "./i18n"),
			"@shared": path.resolve(__dirname, "./shared"),
			"@services": path.resolve(__dirname, "./services"),
			"@api": path.resolve(__dirname, "./api"),
			"@foundation": path.resolve(__dirname, "./foundation"),
			"@activate": path.resolve(__dirname, "../connectors/vscode/backend/activation"),
			"@integrations": path.resolve(__dirname, "./integrations"),
			"@workers/types": path.resolve(__dirname, "./workers/types.ts"),
			"@packages/types/src/mcp": path.resolve(__dirname, "../packages/types/src/mcp/mcp.ts"),
			"@eventConstants": path.resolve(__dirname, "../packages/types/src/events/constants.ts"),
			"@packageJson": path.resolve(__dirname, "./package.json"),
			"@intentConstants": path.resolve(__dirname, "./features/intents/IntentConstants"),
			"@connectors": path.resolve(__dirname, "../connectors"),
		},
	},
})
