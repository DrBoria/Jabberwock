/**
 * clickElement action handler — click an element using a 3-strategy approach:
 * 1. Native .click() for standard interactive elements (button, a, input, select, etc.)
 * 2. Full pointer event chain for Radix UI / ShadCN components
 * 3. aria-controls popover toggling for popover triggers
 */
import type { DomHandlerContext } from "../types.js"
import { findElementById, findElementBySelector } from "../lookup.js"

export async function handleClickElement(ctx: DomHandlerContext, req: Record<string, unknown>): Promise<void> {
	const { postMessage, queryIframe, resolveSelectorInIframe } = ctx
	const requestId = req.requestId as string
	const selector = req.selector as string | undefined
	const id = req.id as string | undefined

	try {
		// Check if selector targets an iframe
		if (selector) {
			const iframeTarget = await resolveSelectorInIframe(selector)
			if (iframeTarget) {
				try {
					await queryIframe(iframeTarget.iframe, {
						type: "dom-action",
						command: "click",
						selector: iframeTarget.innerSelector,
					})
					postMessage({
						type: "domResponse",
						requestId,
						text: `Clicked ${iframeTarget.innerSelector} inside iframe via postMessage`,
					})
				} catch (err) {
					postMessage({
						type: "domResponse",
						requestId,
						text: `Error clicking inside iframe: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
				return
			}
		}

		// Standard document click
		const el = selector ? findElementBySelector(selector) : id ? findElementById(id) : null
		if (!el) {
			const hint = selector || id || "?"
			postMessage({ type: "domResponse", requestId, text: `Element not found: ${hint}` })
			return
		}
		const targetId = selector || id || "?"

		const tag = el.tagName.toLowerCase()

		// Strategy 1: For standard interactive elements, use native .click()
		if (
			tag === "button" ||
			tag === "a" ||
			tag === "input" ||
			tag === "select" ||
			tag === "option" ||
			tag === "summary" ||
			tag === "label"
		) {
			;(el as HTMLElement).click()
			postMessage({ type: "domResponse", requestId, text: `Clicked ${targetId} via .click()` })
			return
		}

		// Strategy 2: Dispatch full pointer event chain (for Radix UI / ShadCN components)
		const rect = el.getBoundingClientRect()
		const cx = rect.left + rect.width / 2
		const cy = rect.top + rect.height / 2
		const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy }
		el.dispatchEvent(new PointerEvent("pointerdown", opts))
		el.dispatchEvent(new PointerEvent("pointerup", opts))
		el.dispatchEvent(new MouseEvent("mousedown", opts))
		el.dispatchEvent(new MouseEvent("mouseup", opts))
		el.dispatchEvent(new MouseEvent("click", opts))

		// Strategy 3: For Radix UI Popover triggers — also toggle via aria-controls
		const ariaControls = el.getAttribute("aria-controls")
		if (ariaControls) {
			const content = document.getElementById(ariaControls)
			if (content) {
				const isExpanded = el.getAttribute("aria-expanded") === "true"
				content.setAttribute("data-state", isExpanded ? "closed" : "open")
				el.setAttribute("aria-expanded", String(!isExpanded))
				postMessage({
					type: "domResponse",
					requestId,
					text: `Clicked ${targetId}: dispatched pointer events + toggled popover "${ariaControls}"`,
				})
				return
			}
		}

		postMessage({
			type: "domResponse",
			requestId,
			text: `Clicked ${targetId}: dispatched pointer events on <${tag}>`,
		})
	} catch (err) {
		postMessage({ type: "domResponse", requestId, text: `Error clicking: ${err}` })
	}
}
