import fs from "fs"
import path from "path"
import { createHash } from "crypto"

import type { CustomToolDefinition } from "@jabberwock/types"

import { copyEnvFilesFn } from "./custom-tool-registry-helpers.ts"
import { runEsbuild, NODE_BUILTIN_MODULES, COMMONJS_REQUIRE_BANNER } from "./esbuild-runner.ts"

export async function importToolFile(
	filePath: string,
	cacheDir: string,
	nodePaths: string[],
	extensionPath: string | undefined,
	tsCache: Map<string, string>,
): Promise<Record<string, CustomToolDefinition>> {
	const absolutePath = path.resolve(filePath)
	const ext = path.extname(absolutePath)

	if (ext === ".ts" || ext === ".mjs") {
		return import(`file://${absolutePath}`)
	}

	const stat = fs.statSync(absolutePath)
	const cacheKey = `${absolutePath}:${stat.mtimeMs}`

	if (tsCache.has(cacheKey)) {
		const cachedPath = tsCache.get(cacheKey)!
		return import(`file://${cachedPath}`)
	}

	const hash = createHash("sha256").update(cacheKey).digest("hex").slice(0, 16)

	const toolCacheDir = path.join(cacheDir, hash)
	fs.mkdirSync(toolCacheDir, { recursive: true })

	const tempFile = path.join(toolCacheDir, "bundle.mjs")

	if (fs.existsSync(tempFile)) {
		tsCache.set(cacheKey, tempFile)
		return import(`file://${tempFile}`)
	}

	const toolDir = path.dirname(absolutePath)
	const toolNodeModules = path.join(toolDir, "node_modules")

	const resolvedNodePaths = fs.existsSync(toolNodeModules) ? [toolNodeModules, ...nodePaths] : nodePaths

	await runEsbuild(
		{
			entryPoint: absolutePath,
			outfile: tempFile,
			format: "esm",
			platform: "node",
			target: "node18",
			bundle: true,
			sourcemap: "inline",
			packages: "bundle",
			nodePaths: resolvedNodePaths,
			external: NODE_BUILTIN_MODULES,
			banner: COMMONJS_REQUIRE_BANNER,
		},
		extensionPath,
	)

	copyEnvFilesFn(toolDir, toolCacheDir)

	tsCache.set(cacheKey, tempFile)
	return import(`file://${tempFile}`)
}
