/**
 * Vitest config for the devtool package.
 *
 * Most tests run in a plain Node environment. Only the React `<Devtool>`
 * component test needs a DOM, so that single file opts into jsdom with a
 * per-file `// @vitest-environment jsdom` pragma.
 *
 * Run with:  pnpm test   (or:  npx vitest run --config vitest.config.ts)
 */
import { defineConfig } from "vitest/config"

export default defineConfig({
	// Match the tsconfig `jsx: react-jsx` so .tsx test files use the
	// automatic JSX runtime (no `import React` required).
	esbuild: {
		jsx: "automatic",
	},
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.test.{ts,tsx}"],
	},
})
