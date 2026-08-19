/**
 * LocatorBridge allows Alt+Click navigation from the Webview UI to the source code.
 *
 * It captures clicks in the capture phase, checks for the Alt key, and looks for
 * [data-locatorjs-id] attributes injected by @locator/babel-jsx during development.
 * If found, it sends a LOCATOR_OPEN_FILE message to the extension host.
 *
 * Originally from webview-ui/src/features/devtools/utils/LocatorBridge.tsx,
 * moved into @jabberwock/devtool so the package is self-contained.
 */

import { useEffect } from "react"
import { vscode } from "./vscode.js"

function sanitizeNum(value: number, fallback: number): number {
	return isNaN(value) ? fallback : value
}

function parsePathMode(locatorId: string): { filePath: string; line: number; column: number } {
	const parts = locatorId.split(":")
	if (parts.length >= 3) {
		const col = parseInt(parts.pop() || "1", 10)
		const ln = parseInt(parts.pop() || "1", 10)
		return { filePath: parts.join(":"), line: sanitizeNum(ln, 1), column: sanitizeNum(col, 1) }
	}
	if (parts.length === 2) {
		const ln = parseInt(parts.pop() || "1", 10)
		return { filePath: parts[0] || "", line: sanitizeNum(ln, 1), column: 1 }
	}
	return { filePath: "", line: 1, column: 1 }
}

function parseIdMode(locatorId: string): { filePath: string; line: number; column: number } {
	const parts = locatorId.split("::")
	const filePath = parts[0] || ""
	const line = parseInt(parts[1] || "1", 10)
	const column = parts[2] ? parseInt(parts[2], 10) : 1
	return { filePath, line: sanitizeNum(line, 1), column: sanitizeNum(column, 1) }
}

function parseLocatorId(locatorId: string, isPathMode: boolean): { filePath: string; line: number; column: number } {
	return isPathMode ? parsePathMode(locatorId) : parseIdMode(locatorId)
}

/**
 * LocatorBridge component — renders nothing, but sets up Alt+Click listeners.
 */
export function LocatorBridge() {
	useEffect(() => {
		console.log("[LocatorBridge] Component mounted and listening for Alt+Click")
		const handleAltClick = (e: MouseEvent) => {
			if (!e.altKey) {
				return
			}

			console.log("[LocatorBridge] Alt+Click detected", e.target)

			if (e.target instanceof HTMLElement) {
				const attrs = Array.from(e.target.attributes).map((a) => `${a.name}=${a.value}`)
				console.log("[LocatorBridge] Clicked element attributes:", attrs)
			}

			const target = e.target as HTMLElement
			const locatorNode = target.closest("[data-locatorjs-id], [data-locatorjs]")

			if (locatorNode) {
				console.log("[LocatorBridge] Found locator node", locatorNode)
				e.preventDefault()
				e.stopPropagation()

				const locatorId =
					locatorNode.getAttribute("data-locatorjs") || locatorNode.getAttribute("data-locatorjs-id")
				if (locatorId) {
					console.log("[LocatorBridge] Raw locatorId:", locatorId)

					const isPathMode = locatorNode.hasAttribute("data-locatorjs")
					const { filePath, line, column } = parseLocatorId(locatorId, isPathMode)

					console.log(
						`[LocatorBridge] Parsed (${isPathMode ? "path" : "id"} mode): ${filePath} at ${line}:${column}`,
					)

					vscode.postMessage({
						type: "LOCATOR_OPEN_FILE",
						locatorPayload: { filePath, line, column },
					} as never)
				}
			}
		}

		document.addEventListener("click", handleAltClick, true)

		return () => {
			document.removeEventListener("click", handleAltClick, true)
		}
	}, [])

	return null
}
