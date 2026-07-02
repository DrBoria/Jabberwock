import { Plugin } from "vite"
import fs from "fs"
import path from "path"

/**
 * Custom Vite plugin to ensure source maps are properly included in the build
 * This plugin copies source maps to the build directory and ensures they're accessible
 */
function getBuildOutDir(): string {
	if (process.env.NODE_ENV === "nightly") {
		return path.resolve("../apps/vscode-nightly/build/webview-ui/build")
	}
	return path.resolve("../src/webview-ui/build")
}

function ensureSourceMapReference(jsPath: string, jsFile: string): void {
	const jsContent = fs.readFileSync(jsPath, "utf8")
	if (jsContent.includes("//# sourceMappingURL=")) return

	const updated = jsContent + `\n//# sourceMappingURL=${jsFile}.map\n`
	fs.writeFileSync(jsPath, updated)
}

function normalizeSourceMap(mapPath: string, _jsFile: string): void {
	const mapContent = JSON.parse(fs.readFileSync(mapPath, "utf8"))

	if (!mapContent.sourceRoot) {
		mapContent.sourceRoot = ""
	}

	if (mapContent.sources) {
		mapContent.sources = mapContent.sources.map((source: string) => source.replace(/^\//, ""))
	}

	fs.writeFileSync(mapPath, JSON.stringify(mapContent, null, 2))
}

function writeSourceMapManifest(outDir: string): void {
	const pkgVersion = process.env.PKG_VERSION || "unknown"
	fs.writeFileSync(
		path.join(outDir, "sourcemap-manifest.json"),
		JSON.stringify({
			enabled: true,
			version: pkgVersion,
			buildTime: new Date().toISOString(),
		}),
	)
}

export function sourcemapPlugin(): Plugin {
	return {
		name: "vite-plugin-sourcemap",
		apply: "build",

		closeBundle: {
			order: "post",
			handler: async () => {
				console.log("Ensuring source maps are included in build...")

				const outDir = getBuildOutDir()
				const assetsDir = path.join(outDir, "assets")

				console.log(`Source map processing in ${outDir}`)

				if (!fs.existsSync(outDir)) {
					console.warn("[jabberwock] Build directory not found:", outDir)
					return
				}

				if (!fs.existsSync(assetsDir)) {
					console.warn("[jabberwock] Assets directory not found:", assetsDir)
					return
				}

				const jsFiles = fs.readdirSync(assetsDir).filter((file) => file.endsWith(".js"))
				console.log(`Found ${jsFiles.length} JS files in assets directory`)

				for (const jsFile of jsFiles) {
					const jsPath = path.join(assetsDir, jsFile)
					const mapPath = jsPath + ".map"

					if (fs.existsSync(mapPath)) {
						console.log(`Source map found for ${jsFile}`)
						ensureSourceMapReference(jsPath, jsFile)

						try {
							normalizeSourceMap(mapPath, jsFile)
							console.log(`Updated source map for ${jsFile}`)
						} catch (error) {
							console.error(`[jabberwock] Error processing source map for ${jsFile}:`, error)
						}
					} else {
						console.log(`No source map found for ${jsFile}`)
					}
				}

				writeSourceMapManifest(outDir)
				console.log("Source map processing complete")
			},
		},
	}
}
