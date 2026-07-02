/**
 * DOM Consumer — iframe-side handler for dom-query and dom-action messages.
 *
 * This file is meant to be imported by iframe content (e.g., md-todo-mcp/ui)
 * to handle postMessage-based DOM queries and actions from the parent webview.
 *
 * Usage in an iframe React app:
 *   import { createDomConsumer } from "@jabberwock/devtool/dom/consumer"
 *   useEffect(() => createDomConsumer(), [])
 *
 * The consumer listens for:
 *   - "dom-query"  → serialize / querySelector commands (read DOM)
 *   - "dom-action" → click / type / scroll / drag commands (interact with DOM)
 *
 * Responses are sent back via event.source.postMessage with type "dom-response".
 */
import { respond, executeUserCommandOnElement } from "./utils.js"
import { handleClick, handleType, handleScroll, handleDrag } from "./actions.js"

// ── dom-query Handlers ────────────────────────────────────────────────────

function handleSerialize(event: MessageEvent, _req: Record<string, unknown>): void {
	const html = document.body ? document.body.innerHTML : ""
	respond(event, { result: { html } })
}

function handleQuerySelector(event: MessageEvent, req: Record<string, unknown>): void {
	const selector = req.selector as string | undefined
	const innerEl = selector ? document.querySelector(selector) : null
	const userCommand = req.userCommand as string | undefined
	if (innerEl) {
		const html = (innerEl as HTMLElement).outerHTML || innerEl.innerHTML || ""
		const result: Record<string, unknown> = { html }
		if (userCommand) {
			Object.assign(result, executeUserCommandOnElement(innerEl, userCommand))
		}
		respond(event, { result })
	} else if (userCommand) {
		const cmdResult = executeUserCommandOnElement(document.body, userCommand)
		respond(event, { result: cmdResult })
	} else {
		respond(event, { result: { html: "" } })
	}
}

// ── Main Handler ──────────────────────────────────────────────────────────

const domQueryHandlers: Record<string, (event: MessageEvent, req: Record<string, unknown>) => void> = {
	serialize: handleSerialize,
	querySelector: handleQuerySelector,
}

const domActionHandlers: Record<string, (event: MessageEvent, req: Record<string, unknown>) => void> = {
	click: handleClick,
	type: handleType,
	scroll: handleScroll,
	drag: handleDrag,
}

function handleMessage(event: MessageEvent): void {
	const data = event.data as Record<string, unknown> | undefined
	if (!data) return

	if (data.type === "dom-query") {
		const command = data.command as string
		const handler = domQueryHandlers[command]
		if (handler) {
			handler(event, data)
		} else {
			respond(event, { error: `Unknown dom-query command: ${command}` })
		}
		return
	}

	if (data.type === "dom-action") {
		const command = data.command as string
		const handler = domActionHandlers[command]
		if (handler) {
			const el = data.selector ? document.querySelector(data.selector as string) : null
			if (!el && data.selector) {
				respond(event, { error: `Element not found: ${data.selector}` })
				return
			}
			handler(event, data)
		} else {
			respond(event, { error: `Unknown dom-action command: ${command}` })
		}
		return
	}
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Create a DOM consumer that listens for dom-query and dom-action messages
 * from the parent webview and responds appropriately.
 *
 * Call this once in a useEffect (or on app mount) in any iframe content
 * that wants to support Devtool DOM interaction.
 *
 * @returns A cleanup function that removes the event listener
 *
 * @example
 * ```tsx
 * useEffect(() => createDomConsumer(), [])
 * ```
 */
export function createDomConsumer(): () => void {
	window.addEventListener("message", handleMessage)
	return () => window.removeEventListener("message", handleMessage)
}
