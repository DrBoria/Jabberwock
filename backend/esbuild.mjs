import * as esbuild from "esbuild"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import process from "node:process"
import * as console from "node:console"

import { copyPaths, copyWasms, copyLocales, setupLocaleWatcher } from "@jabberwock/build"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
	const name = "extension"
	const production = process.argv.includes("--production")
	const watch = process.argv.includes("--watch")
	const minify = production
	const sourcemap = true // Always generate source maps for error handling.

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const buildOptions = {
		bundle: true,
		minify,
		sourcemap,
		logLevel: "silent",
		format: "cjs",
		sourcesContent: false,
		platform: "node",
		// v4 B4: resolve aliases (@features/*, @shared/*, ...) from backend/tsconfig.json for the whole
		// bundle — esbuild otherwise discovers connectors/vscode/tsconfig.json (skeleton, no paths) from
		// the connector entry point and the extension build fails to resolve backend code.
		tsconfig: path.resolve(__dirname, "tsconfig.json"),
	}

	const srcDir = __dirname
	const buildDir = __dirname
	const distDir = path.join(buildDir, "dist")

	if (fs.existsSync(distDir)) {
		console.log(`[${name}] Cleaning dist directory: ${distDir}`)
		fs.rmSync(distDir, { recursive: true, force: true })
	}

	/**
	 * @type {import('esbuild').Plugin[]}
	 */
	const plugins = [
		{
			name: "copyFiles",
			setup(build) {
				build.onEnd(() => {
					copyPaths(
						[
							["../README.md", "README.md"],
							["../CHANGELOG.md", "CHANGELOG.md"],
							["../LICENSE", "LICENSE"],
							["../.env", ".env", { optional: true }],
							["node_modules/vscode-material-icons/generated", "assets/vscode-material-icons", { optional: true }],
							["../frontend/audio", "frontend/audio"],
							// v4 layout (§3.3/R1): vite outputs to <repo>/frontend/build; vsce packages from the extension root, so copy it in here (restored — lost during monorepo migration)
							["../frontend/build", "frontend/build"],
						],
						srcDir,
						buildDir,
					)
				})
			},
		},
		{
			name: "copyWasms",
			setup(build) {
				build.onEnd(() => copyWasms(srcDir, distDir))
			},
		},
		{
			name: "copyLocales",
			setup(build) {
				build.onEnd(() => copyLocales(srcDir, distDir))
			},
		},
		{
			name: "esbuild-problem-matcher",
			setup(build) {
				build.onStart(() => console.log("[esbuild-problem-matcher#onStart]"))
				build.onEnd((result) => {
					result.errors.forEach(({ text, location }) => {
						console.error(`✘ [ERROR] ${text}`)
						if (location && location.file) {
							console.error(`    ${location.file}:${location.line}:${location.column}:`)
						}
					})

					console.log("[esbuild-problem-matcher#onEnd]")
				})
			},
		},
	]

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const extensionConfig = {
		...buildOptions,
		plugins,
		entryPoints: ["../connectors/vscode/backend/main.ts"],
		outfile: "dist/extension.js",
		// global-agent must be external because it dynamically patches Node.js http/https modules
		// which breaks when bundled. It needs access to the actual Node.js module instances.
		// undici must be bundled because our VSIX is packaged with `--no-dependencies`.
		external: ["vscode", "esbuild", "global-agent"],
	}

	/**
	 * v4 Phase C1 (§7.2 / §8.3 criterion C-2): standalone server bundle.
	 *
	 * Entry = the web connector backend main. Deliberately NO external "vscode" and no
	 * vscode-shim alias: if any transitive import in the server-reachable graph reaches
	 * the "vscode" module, esbuild fails with an unresolved-module error — the automatic
	 * purity proof that the server mode never depends on the host API.
	 *
	 * @type {import('esbuild').BuildOptions}
	 */
	const serverConfig = {
		...buildOptions,
		entryPoints: ["../connectors/web/backend/main.ts"],
		outfile: "dist/server.js",
		// global-agent must stay external (it patches Node http/https at runtime).
		external: ["esbuild", "global-agent"],
	}

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const workerConfig = {
		...buildOptions,
		entryPoints: ["workers/countTokens.ts"],
		outdir: "dist/workers",
	}

	const [extensionCtx, workerCtx, serverCtx] = await Promise.all([
		esbuild.context(extensionConfig),
		esbuild.context(workerConfig),
		esbuild.context(serverConfig),
	])

	if (watch) {
		await Promise.all([extensionCtx.watch(), workerCtx.watch(), serverCtx.watch()])
		copyLocales(srcDir, distDir)
		setupLocaleWatcher(srcDir, distDir)
	} else {
		await Promise.all([extensionCtx.rebuild(), workerCtx.rebuild(), serverCtx.rebuild()])
		await Promise.all([extensionCtx.dispose(), workerCtx.dispose(), serverCtx.dispose()])
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
