import * as fs from "fs"
import * as path from "path"

import { copyDir, rmDir } from "./fs-helpers.js"

type CopyPathOptions = {
	optional?: boolean
}

export function copyPaths(copyPaths: [string, string, CopyPathOptions?][], srcDir: string, dstDir: string) {
	copyPaths.forEach(([srcRelPath, dstRelPath, options = {}]) => {
		try {
			const stats = fs.lstatSync(path.join(srcDir, srcRelPath))

			if (stats.isDirectory()) {
				if (fs.existsSync(path.join(dstDir, dstRelPath))) {
					rmDir(path.join(dstDir, dstRelPath))
				}

				fs.mkdirSync(path.join(dstDir, dstRelPath), { recursive: true })

				const count = copyDir(path.join(srcDir, srcRelPath), path.join(dstDir, dstRelPath), 0)
				console.log(`[copyPaths] Copied ${count} files from ${srcRelPath} to ${dstRelPath}`)
			} else {
				fs.copyFileSync(path.join(srcDir, srcRelPath), path.join(dstDir, dstRelPath))
				console.log(`[copyPaths] Copied ${srcRelPath} to ${dstRelPath}`)
			}
		} catch (error) {
			if (options.optional) {
				console.warn(`[copyPaths] Optional file not found: ${srcRelPath}`)
			} else {
				throw error
			}
		}
	})
}

export function copyWasms(srcDir: string, distDir: string): void {
	const nodeModulesDir = path.join(srcDir, "node_modules")

	fs.mkdirSync(distDir, { recursive: true })

	// Tiktoken WASM file.
	fs.copyFileSync(
		path.join(nodeModulesDir, "tiktoken", "lite", "tiktoken_bg.wasm"),
		path.join(distDir, "tiktoken_bg.wasm"),
	)

	console.log(`[copyWasms] Copied tiktoken WASMs to ${distDir}`)

	// Also copy Tiktoken WASMs to the workers directory.
	const workersDir = path.join(distDir, "workers")
	fs.mkdirSync(workersDir, { recursive: true })

	fs.copyFileSync(
		path.join(nodeModulesDir, "tiktoken", "lite", "tiktoken_bg.wasm"),
		path.join(workersDir, "tiktoken_bg.wasm"),
	)

	console.log(`[copyWasms] Copied tiktoken WASMs to ${workersDir}`)

	// Main tree-sitter WASM file.
	fs.copyFileSync(
		path.join(nodeModulesDir, "web-tree-sitter", "tree-sitter.wasm"),
		path.join(distDir, "tree-sitter.wasm"),
	)

	console.log(`[copyWasms] Copied tree-sitter.wasm to ${distDir}`)

	// Copy language-specific WASM files.
	const languageWasmDir = path.join(nodeModulesDir, "tree-sitter-wasms", "out")

	if (!fs.existsSync(languageWasmDir)) {
		throw new Error(`Directory does not exist: ${languageWasmDir}`)
	}

	// Dynamically read all WASM files from the directory instead of using a hardcoded list.
	const wasmFiles = fs.readdirSync(languageWasmDir).filter((file) => file.endsWith(".wasm"))

	wasmFiles.forEach((filename) => {
		fs.copyFileSync(path.join(languageWasmDir, filename), path.join(distDir, filename))
	})

	console.log(`[copyWasms] Copied ${wasmFiles.length} tree-sitter language wasms to ${distDir}`)

	// Copy esbuild-wasm files for custom tool transpilation (cross-platform).
	copyEsbuildWasmFiles(nodeModulesDir, distDir)
}

/**
 * Copy esbuild-wasm files to the dist/bin directory.
 *
 * This function copies the esbuild-wasm CLI and WASM binary, which provides
 * a cross-platform esbuild implementation that works on all platforms.
 *
 * Files copied:
 * - bin/esbuild (Node.js CLI script)
 * - esbuild.wasm (WASM binary)
 * - wasm_exec_node.js (Go WASM runtime for Node.js)
 * - wasm_exec.js (Go WASM runtime dependency)
 */
function copyEsbuildWasmFiles(nodeModulesDir: string, distDir: string): void {
	const esbuildWasmDir = path.join(nodeModulesDir, "esbuild-wasm")

	if (!fs.existsSync(esbuildWasmDir)) {
		throw new Error(`Directory does not exist: ${esbuildWasmDir}`)
	}

	// Create bin directory in dist.
	const binDir = path.join(distDir, "bin")
	fs.mkdirSync(binDir, { recursive: true })

	// Files to copy - the esbuild CLI script expects wasm_exec_node.js and esbuild.wasm
	// to be one directory level up from the bin directory (i.e., in distDir directly).
	// wasm_exec_node.js requires wasm_exec.js, so we need to copy that too.
	const filesToCopy = [
		{ src: path.join(esbuildWasmDir, "bin", "esbuild"), dest: path.join(binDir, "esbuild") },
		{ src: path.join(esbuildWasmDir, "esbuild.wasm"), dest: path.join(distDir, "esbuild.wasm") },
		{ src: path.join(esbuildWasmDir, "wasm_exec_node.js"), dest: path.join(distDir, "wasm_exec_node.js") },
		{ src: path.join(esbuildWasmDir, "wasm_exec.js"), dest: path.join(distDir, "wasm_exec.js") },
	]

	for (const { src, dest } of filesToCopy) {
		fs.copyFileSync(src, dest)

		// Make CLI executable.
		if (src.endsWith("esbuild")) {
			try {
				fs.chmodSync(dest, 0o755)
			} catch {
				// Ignore chmod errors on Windows.
			}
		}
	}

	console.log(`[copyWasms] Copied ${filesToCopy.length} esbuild-wasm files to ${distDir}`)
}

export function copyLocales(srcDir: string, distDir: string): void {
	const destDir = path.join(distDir, "i18n", "locales")
	fs.mkdirSync(destDir, { recursive: true })
	const count = copyDir(path.join(srcDir, "i18n", "locales"), destDir, 0)
	console.log(`[copyLocales] Copied ${count} locale files to ${destDir}`)
}

export function setupLocaleWatcher(srcDir: string, distDir: string) {
	const localesDir = path.join(srcDir, "i18n", "locales")

	if (!fs.existsSync(localesDir)) {
		console.warn(`Cannot set up watcher: Source locales directory does not exist: ${localesDir}`)
		return
	}

	console.log(`Setting up watcher for locale files in ${localesDir}`)

	let debounceTimer: NodeJS.Timeout | null = null

	const debouncedCopy = () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer)
		}

		// Wait 300ms after last change before copying.
		debounceTimer = setTimeout(() => {
			console.log("Locale files changed, copying...")
			copyLocales(srcDir, distDir)
		}, 300)
	}

	try {
		fs.watch(localesDir, { recursive: true }, (_eventType, filename) => {
			if (filename && filename.endsWith(".json")) {
				console.log(`Locale file ${filename} changed, triggering copy...`)
				debouncedCopy()
			}
		})
		console.log("Watcher for locale files is set up")
	} catch (error) {
		console.error(
			`Error setting up watcher for ${localesDir}:`,
			error instanceof Error ? error.message : "Unknown error",
		)
	}
}
