/**
 * runCommand action handler — execute arbitrary JavaScript in the webview context
 * (like Chrome DevTools console), with acquireVsCodeApi blocked for security.
 */
import type { DomHandlerContext } from "../types.js"

export function handleRunCommand(ctx: DomHandlerContext, req: Record<string, unknown>): void {
	const { postMessage } = ctx
	const requestId = req.requestId as string
	const command = req.command as string

	// Temporarily shadow acquireVsCodeApi to prevent agents from
	// bypassing the message bus to send arbitrary messages to VS Code.
	const win = window as { acquireVsCodeApi?: () => void; vscodeApi?: unknown; __vscodeApi?: unknown }
	const originalAcquire = win.acquireVsCodeApi
	const originalVscodeApi = win.vscodeApi
	const originalVscode = win.__vscodeApi
	try {
		win.acquireVsCodeApi = (): void => {
			throw new Error(
				"acquireVsCodeApi is blocked in run_command for security. Use send_message_to_webview or other MCP tools instead.",
			)
		}
		win.vscodeApi = undefined
		win.__vscodeApi = undefined

		// Use indirect eval to get global scope (needed for document, window, etc.)
		const result = (0, eval)(command)
		const output =
			result === undefined
				? "undefined"
				: result === null
					? "null"
					: result instanceof Element
						? `<${result.tagName.toLowerCase()}>`
						: result instanceof NodeList || result instanceof HTMLCollection
							? `[${Array.from(result)
									.map((el, i) => {
										const tag = (el as Element).tagName?.toLowerCase() || "?"
										return `${i}: <${tag}>${(el as Element).id ? `#${(el as Element).id}` : ""}`
									})
									.join(", ")}] (${result.length} elements)`
							: Array.isArray(result)
								? JSON.stringify(result)
								: typeof result === "object"
									? JSON.stringify(result, null, 2)
									: String(result)
		postMessage({ type: "domResponse", requestId, text: output })
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error executing command: ${err instanceof Error ? err.message : String(err)}`,
		})
	} finally {
		// Restore originals
		win.acquireVsCodeApi = originalAcquire
		win.vscodeApi = originalVscodeApi
		win.__vscodeApi = originalVscode
	}
}
