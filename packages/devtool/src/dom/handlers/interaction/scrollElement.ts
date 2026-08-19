/**
 * scrollElement action handler — scroll a DOM element in a given direction.
 */
import type { DomHandlerContext } from "../../types.js"
import { findElementById, findElementBySelector } from "../../lookup.js"

async function scrollInIframe(
	ctx: DomHandlerContext,
	selector: string,
	direction: string,
	requestId: string,
): Promise<boolean> {
	const { postMessage, queryIframe, resolveSelectorInIframe } = ctx
	const iframeTarget = await resolveSelectorInIframe(selector)
	if (!iframeTarget) return false

	try {
		await queryIframe(iframeTarget.iframe, {
			type: "dom-action",
			command: "scroll",
			selector: iframeTarget.innerSelector,
			direction,
		})
		postMessage({
			type: "domResponse",
			requestId,
			text: `Scrolled ${direction} inside iframe via postMessage`,
		})
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error scrolling inside iframe: ${err instanceof Error ? err.message : String(err)}`,
		})
	}
	return true
}

function applyScrollByDirection(el: Element, direction: string): void {
	const scrollAmount = 300
	switch (direction) {
		case "up":
			el.scrollBy({ top: -scrollAmount, behavior: "smooth" })
			break
		case "down":
			el.scrollBy({ top: scrollAmount, behavior: "smooth" })
			break
		case "left":
			el.scrollBy({ left: -scrollAmount, behavior: "smooth" })
			break
		case "right":
			el.scrollBy({ left: scrollAmount, behavior: "smooth" })
			break
	}
}

export async function handleScrollElement(ctx: DomHandlerContext, req: Record<string, unknown>): Promise<void> {
	const { postMessage } = ctx
	const requestId = req.requestId as string
	const id = req.id as string | undefined
	const selector = req.selector as string | undefined
	const direction = req.direction as string

	try {
		if (selector) {
			const handled = await scrollInIframe(ctx, selector, direction, requestId)
			if (handled) return
		}

		const el = selector ? findElementBySelector(selector) : id ? findElementById(id) : null
		if (!el) {
			const hint = selector || id || "?"
			postMessage({ type: "domResponse", requestId, text: `Element not found: ${hint}` })
			return
		}
		applyScrollByDirection(el, direction)
		postMessage({ type: "domResponse", requestId, text: `Scrolled ${direction}` })
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error scrolling element: ${err instanceof Error ? err.message : String(err)}`,
		})
	}
}
