/**
 * selectOption action handler — select an option in a dropdown (HTMLSelectElement).
 */
import type { DomHandlerContext } from "../../types.js"
import { findElementById } from "../../lookup.js"

export function handleSelectOption(ctx: DomHandlerContext, req: Record<string, unknown>): void {
	const { postMessage } = ctx
	const requestId = req.requestId as string
	const id = req.id as string
	const value = req.value as string

	try {
		const el = findElementById(id)
		if (!el) {
			postMessage({ type: "domResponse", requestId, text: `Element not found: ${id}` })
			return
		}
		if (el instanceof HTMLSelectElement) {
			el.value = value
			el.dispatchEvent(new Event("change", { bubbles: true }))
		}
		postMessage({ type: "domResponse", requestId, text: `Selected "${value}" in ${id}` })
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error selecting option: ${err instanceof Error ? err.message : String(err)}`,
		})
	}
}
