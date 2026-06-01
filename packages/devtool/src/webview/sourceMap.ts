/**
 * Source Map utilities and initializer — merged from sourceMapInitializer.ts
 * and sourceMapUtils.ts for a single-entry import.
 *
 * Provides:
 * - Source map resolution using stacktrace-js
 * - Auto-enhancement of window errors with source maps
 * - Debugging utilities exposed on window for prod builds
 *
 * Originally from webview-ui/src/features/devtools/utils/sourceMapUtils.ts
 * and sourceMapInitializer.ts, moved into @jabberwock/devtool so the package
 * is self-contained.
 */

import * as StackTrace from "stacktrace-js"

// ── Types ─────────────────────────────────────────────────────────────────

export interface EnhancedError extends Error {
	sourceMappedStack?: string
	sourceMappedComponentStack?: string
}

interface ExtendedWindow {
	__ENABLE_SOURCEMAP_PRELOAD__?: boolean
	__applySourceMaps?: (error: Error) => Promise<Error>
	__testSourceMaps?: () => void
	__checkSourceMap?: (scriptUrl: string) => Promise<boolean>
}

// ── Stack trace utilities (was sourceMapUtils.ts) ────────────────────────

/**
 * Apply source maps to a stack trace using StackTrace.js
 * Returns the original stack trace if source maps can't be applied
 */
export async function applySourceMapsToStack(stack: string): Promise<string> {
	if (!stack) {
		console.debug("applySourceMapsToStack: Empty stack trace provided")
		return stack
	}

	console.debug("Original stack trace:", stack)

	try {
		const tempError = new Error()
		tempError.stack = stack

		const errorMessage = stack.split("\n")[0]
		console.debug("Error message:", errorMessage)

		const stackFrames = await StackTrace.fromError(tempError)
		console.debug("StackTrace.js parsed frames:", stackFrames)

		const mappedFrames = stackFrames.map((frame: StackTrace.StackFrame) => {
			const functionName = frame.functionName || "<anonymous>"
			const fileName = frame.fileName || "unknown"
			const lineNumber = frame.lineNumber || 0
			const columnNumber = frame.columnNumber || 0

			return `    at ${functionName} (${fileName}:${lineNumber}:${columnNumber})`
		})

		const result = [errorMessage, ...mappedFrames].join("\n")
		console.debug("Final mapped stack trace:", result)
		return result
	} catch (error) {
		console.error("[devtool] Error applying source maps with StackTrace.js:", error)
		return stack
	}
}

/**
 * Apply source maps to a React component stack trace using StackTrace.js
 */
export async function applySourceMapsToComponentStack(componentStack: string): Promise<string> {
	if (!componentStack) {
		console.debug("applySourceMapsToComponentStack: Empty component stack provided")
		return componentStack
	}

	console.debug("Original component stack:", componentStack)

	try {
		const lines = componentStack.split("\n")
		const mappedLines = await Promise.all(
			lines.map(async (line) => {
				if (!line.trim()) return line

				const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/)
				if (!match) return line

				const [_, componentName, fileName, lineNumber, columnNumber] = match
				console.debug(`Processing component stack line:`, { componentName, fileName, lineNumber, columnNumber })

				try {
					const syntheticError = new Error()
					syntheticError.stack = `Error\n    at ${componentName} (${fileName}:${lineNumber}:${columnNumber})`

					const stackFrames = await StackTrace.fromError(syntheticError)

					if (stackFrames.length > 0) {
						const frame = stackFrames[0]!
						const mappedFileName = frame.fileName || fileName
						const mappedLineNumber = frame.lineNumber || parseInt(lineNumber || "1", 10)
						const mappedColumnNumber = frame.columnNumber || parseInt(columnNumber || "1", 10)

						return `at ${componentName} (${mappedFileName}:${mappedLineNumber}:${mappedColumnNumber})`
					}
				} catch (e) {
					console.debug(`Error processing component stack line with StackTrace.js:`, e)
				}

				return line
			}),
		)

		const result = mappedLines.join("\n")
		console.debug("Final mapped component stack:", result)
		return result
	} catch (error) {
		console.error("[devtool] Error applying source maps to component stack with StackTrace.js:", error)
		return componentStack
	}
}

/**
 * Enhance an Error object with source mapped stack trace and component stack
 */
export function enhanceErrorWithSourceMaps(error: Error, componentStack?: string): Promise<EnhancedError> {
	console.debug("Enhancing error with source maps using StackTrace.js:", error)

	return new Promise<EnhancedError>((resolve) => {
		if (!error.stack) {
			console.debug("Error has no stack trace")
			resolve(error as EnhancedError)
			return
		}

		const stackPromise = applySourceMapsToStack(error.stack)
		const componentStackPromise = componentStack
			? applySourceMapsToComponentStack(componentStack)
			: Promise.resolve(undefined)

		Promise.all([stackPromise, componentStackPromise])
			.then(([sourceMappedStack, sourceMappedComponentStack]) => {
				console.debug("Source mapped stacks applied successfully with StackTrace.js")

				Object.defineProperty(error, "sourceMappedStack", {
					value: sourceMappedStack,
					writable: true,
					configurable: true,
				})

				if (sourceMappedComponentStack) {
					Object.defineProperty(error, "sourceMappedComponentStack", {
						value: sourceMappedComponentStack,
						writable: true,
						configurable: true,
					})
				}

				resolve(error)
			})
			.catch((mapError) => {
				console.error("[devtool] Error applying source maps with StackTrace.js:", mapError)
				resolve(error)
			})
	})
}

/**
 * Parse a stack trace string into structured stack frames
 * This is kept for backward compatibility with tests
 */
export async function parseStackTrace(stack: string): Promise<Record<string, string | number | null | undefined>[]> {
	if (!stack) return []

	try {
		const tempError = new Error()
		tempError.stack = stack

		const frames = await StackTrace.fromError(tempError)
		return frames.map((frame: StackTrace.StackFrame) => ({
			functionName: frame.functionName || "<anonymous>",
			fileName: frame.fileName,
			lineNumber: frame.lineNumber,
			columnNumber: frame.columnNumber,
			source: `at ${frame.functionName || "<anonymous>"} (${frame.fileName}:${frame.lineNumber}:${frame.columnNumber})`,
		}))
	} catch (error) {
		console.error("[devtool] Error parsing stack trace with StackTrace.js:", error)
		return []
	}
}

// ── Source map initializer (was sourceMapInitializer.ts) ─────────────────

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
				const enhancedError = await enhanceErrorWithSourceMaps(event.error)
				console.error("[devtool] Source mapped error:", enhancedError)
			} catch (e) {
				console.error("[devtool] Error enhancing error with source maps:", e)
			}
		}
	})

	window.addEventListener("unhandledrejection", async (event) => {
		if (event.reason && event.reason instanceof Error) {
			try {
				const enhancedError = await enhanceErrorWithSourceMaps(event.reason)
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
			return await enhanceErrorWithSourceMaps(error)
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
