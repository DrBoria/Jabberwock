import { defineConfig } from "vitest/config"
import path from "path"
import { fileURLToPath } from "url"
import { resolveVerbosity } from "../src/utils/vitest-verbosity"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { silent, reporters, onConsoleLog } = resolveVerbosity()

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		watch: false,
		reporters,
		silent,
		environment: "jsdom",
		include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
		onConsoleLog,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@src": path.resolve(__dirname, "./src"),
			"@jabberwock": path.resolve(__dirname, "../src/shared"),
			"@jabberwock/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
			"@jabberwock/core/browser": path.resolve(__dirname, "../../packages/core/src/browser.ts"),
			"@shared": path.resolve(__dirname, "../src/shared"),
			"@shared/modes": path.resolve(__dirname, "../src/shared/modes.ts"),
			"@shared/api": path.resolve(__dirname, "../src/shared/api.ts"),
			"@shared/core": path.resolve(__dirname, "../src/shared/core.ts"),
			"@shared/array": path.resolve(__dirname, "../src/shared/array.ts"),
			"@shared/package": path.resolve(__dirname, "../src/shared/package.ts"),
			"@shared/context-mentions": path.resolve(__dirname, "../src/shared/context-mentions.ts"),
			"@shared/support-prompt": path.resolve(__dirname, "../src/shared/support-prompt.ts"),
			// Mock the vscode module for tests since it's not available outside
			// VS Code extension context.
			vscode: path.resolve(__dirname, "./src/__mocks__/vscode.ts"),
		},
	},
})
