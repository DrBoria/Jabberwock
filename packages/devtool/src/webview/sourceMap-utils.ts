/**
 * Source map utilities — extracted from sourceMap.ts
 * Provides stack trace resolution using stacktrace-js.
 */

import * as StackTrace from "stacktrace-js"

export interface EnhancedError extends Error {
	sourceMappedStack?: string
	sourceMappedComponentStack?: string
}

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
