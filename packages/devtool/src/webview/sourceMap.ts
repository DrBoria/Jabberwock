import { enhanceErrorWithSourceMaps as enhanceWithSourceMaps } from "./sourceMap-utils.js"

// ── Source map initializer (was sourceMapInitializer.ts) ─────────────────

interface ExtendedWindow {
	__ENABLE_SOURCEMAP_PRELOAD__?: boolean
	__applySourceMaps?: (error: Error) => Promise<Error>
	__testSourceMaps?: () => void
	__checkSourceMap?: (scriptUrl: string) => Promise<boolean>
}

/**
 * Initialize source map support for production builds
 */
export function initializeSourceMaps(): void {
	if (process.env.NODE_ENV !== "production") {
		return
	}

	console.debug("Initializing CSP-compatible source map support for production build")

	window.addEventListener("error", async (event) => {
		if (event.error && event.error instanceof Error) {
			try {
				const enhancedError = await enhanceWithSourceMaps(event.error)
				console.error("[devtool] Source mapped error:", enhancedError)
			} catch (e) {
				console.error("[devtool] Error enhancing error with source maps:", e)
			}
		}
	})

	window.addEventListener("unhandledrejection", async (event) => {
		if (event.reason && event.reason instanceof Error) {
			try {
				const enhancedError = await enhanceWithSourceMaps(event.reason)
				console.error("[devtool] Source mapped rejection:", enhancedError)
			} catch (e) {
				console.error("[devtool] Error enhancing rejection with source maps:", e)
			}
		}
	})

	try {
		const scripts = document.getElementsByTagName("script")
		for (let i = 0; i < scripts.length; i++) {
			const script = scripts[i]!
			if (script.src) {
				const possibleMapUrls = [
					`${script.src}.map`,
					`${script.src}?source-map=true`,
					script.src.replace(/\.js$/, ".js.map"),
					script.src.replace(/\.js$/, ".map.json"),
					script.src.replace(/\.js$/, ".sourcemap"),
				]

				const shouldPreload =
					process.env.NODE_ENV === "production" && (window as ExtendedWindow).__ENABLE_SOURCEMAP_PRELOAD__

				if (shouldPreload) {
					for (const mapUrl of possibleMapUrls) {
						const link = document.createElement("link")
						link.rel = "preload"
						link.as = "fetch"
						link.href = mapUrl
						link.crossOrigin = "anonymous"
						document.head.appendChild(link)
					}
				}

				fetch(script.src)
					.then((response) => response.text())
					.then((content) => {
						const sourceMappingURLMatch = content.match(/\/\/[#@]\s*sourceMappingURL=([^\s]+)/)
						if (sourceMappingURLMatch && sourceMappingURLMatch[1]) {
							const sourceMappingURL = sourceMappingURLMatch[1]
							if (!sourceMappingURL.startsWith("data:")) {
								const scriptUrlObj = new URL(script.src)
								const baseUrl = scriptUrlObj.href.substring(0, scriptUrlObj.href.lastIndexOf("/") + 1)
								const fullUrl = new URL(sourceMappingURL, baseUrl).href

								const link = document.createElement("link")
								link.rel = "preload"
								link.as = "fetch"
								link.href = fullUrl
								link.crossOrigin = "anonymous"
								document.head.appendChild(link)
							}
						}
					})
					.catch((e) => console.debug("Error checking for inline sourceMappingURL:", e))
			}
		}
	} catch (e) {
		console.error("[devtool] Error preloading source maps:", e)
	}
}

/**
 * Expose source maps on the window object for debugging
 */
export function exposeSourceMapsForDebugging(): void {
	if (process.env.NODE_ENV !== "production") {
		return
	}

	try {
		;(window as ExtendedWindow).__applySourceMaps = async (error: Error) => {
			if (!(error instanceof Error)) {
				console.error("[devtool] Not an Error object:", error)
				return error
			}
			return await enhanceWithSourceMaps(error)
		}
		;(window as ExtendedWindow).__testSourceMaps = () => {
			try {
				const obj: Record<string, unknown> | undefined = undefined
				;(obj! as { nonExistentMethod: () => void }).nonExistentMethod()
			} catch (e) {
				if (e instanceof Error) {
					console.log("Original error:", e)
					const extendedWindow = window as ExtendedWindow
					;(extendedWindow.__applySourceMaps as (err: Error) => Promise<Error>)(e).then((enhanced: Error) => {
						console.log("Enhanced error:", enhanced)

						if ("sourceMappedStack" in enhanced) {
							console.log("Source mapped stack:", enhanced.sourceMappedStack)
						}

						if ("sourceMappedComponentStack" in enhanced) {
							console.log("Source mapped component stack:", enhanced.sourceMappedComponentStack)
						}
					})
				}
			}
		}
		;(window as ExtendedWindow).__checkSourceMap = async (scriptUrl: string) => {
			try {
				const response = await fetch(`${scriptUrl}.map`)
				if (response.ok) {
					const sourceMap = await response.json()
					const originalFileName =
						sourceMap.sources && sourceMap.sources.length > 0 ? sourceMap.sources[0] : "unknown"
					console.log(`Source map found for ${scriptUrl}. Original file: ${originalFileName}`)
					return true
				} else {
					console.log(`No source map found for ${scriptUrl}`)
					return false
				}
			} catch (e) {
				console.error(`[devtool] Error checking source map for ${scriptUrl}:`, e)
				return false
			}
		}

		console.debug("Source map debugging utilities exposed on window object")
	} catch (e) {
		console.error("[devtool] Error exposing source maps for debugging:", e)
	}
}
