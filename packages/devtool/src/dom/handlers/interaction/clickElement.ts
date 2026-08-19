/**
 * clickElement action handler — click an element using a 3-strategy approach:
 * 1. Native .click() for standard interactive elements (button, a, input, select, etc.)
 * 2. Full pointer event chain for Radix UI / ShadCN components
 * 3. aria-controls popover toggling for popover triggers
 */
import type { DomHandlerContext } from "../../types.js"
import { findElementById, findElementBySelector } from "../../lookup.js"

async function clickInIframe(ctx: DomHandlerContext, selector: string, requestId: string): Promise<boolean> {
	const { postMessage, queryIframe, resolveSelectorInIframe } = ctx
	const iframeTarget = await resolveSelectorInIframe(selector)
	if (!iframeTarget) return false

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
	return true
}

function dispatchPointerEvents(el: Element): { cx: number; cy: number } {
	const rect = el.getBoundingClientRect()
	const cx = rect.left + rect.width / 2
	const cy = rect.top + rect.height / 2
	const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy }
	el.dispatchEvent(new PointerEvent("pointerdown", opts))
	el.dispatchEvent(new PointerEvent("pointerup", opts))
	el.dispatchEvent(new MouseEvent("mousedown", opts))
	el.dispatchEvent(new MouseEvent("mouseup", opts))
	el.dispatchEvent(new MouseEvent("click", opts))
	return { cx, cy }
}

function isInteractiveElement(tag: string): boolean {
	return (
		tag === "button" ||
		tag === "a" ||
		tag === "input" ||
		tag === "select" ||
		tag === "option" ||
		tag === "summary" ||
		tag === "label"
	)
}

function resolveClickElement(selector: string | undefined, id: string | undefined): Element | null {
	return selector ? findElementBySelector(selector) : id ? findElementById(id) : null
}

function clickHint(selector: string | undefined, id: string | undefined): string {
	return selector || id || "?"
}

function handlePopoverToggle(
	el: Element,
	requestId: string,
	targetId: string,
	postMessage: DomHandlerContext["postMessage"],
): boolean {
	const ariaControls = el.getAttribute("aria-controls")
	if (!ariaControls) return false

	const content = document.getElementById(ariaControls)
	if (!content) return false

	const isExpanded = el.getAttribute("aria-expanded") === "true"
	content.setAttribute("data-state", isExpanded ? "closed" : "open")
	el.setAttribute("aria-expanded", String(!isExpanded))
	postMessage({
		type: "domResponse",
		requestId,
		text: `Clicked ${targetId}: dispatched pointer events + toggled popover "${ariaControls}"`,
	})
	return true
}

export async function handleClickElement(ctx: DomHandlerContext, req: Record<string, unknown>): Promise<void> {
	const { postMessage } = ctx
	const requestId = req.requestId as string
	const selector = req.selector as string | undefined
	const id = req.id as string | undefined

	try {
		if (selector) {
			const handled = await clickInIframe(ctx, selector, requestId)
			if (handled) return
		}

		const el = resolveClickElement(selector, id)
		if (!el) {
			postMessage({ type: "domResponse", requestId, text: `Element not found: ${clickHint(selector, id)}` })
			return
		}
		const targetId = clickHint(selector, id)
		const tag = el.tagName.toLowerCase()

		if (isInteractiveElement(tag)) {
			;(el as HTMLElement).click()
			postMessage({ type: "domResponse", requestId, text: `Clicked ${targetId} via .click()` })
			return
		}

		// Strategy 2: Dispatch full pointer event chain
		dispatchPointerEvents(el)

		// Strategy 3: For Radix UI Popover triggers — toggle via aria-controls
		if (handlePopoverToggle(el, requestId, targetId, postMessage)) return

		postMessage({
			type: "domResponse",
			requestId,
			text: `Clicked ${targetId}: dispatched pointer events on <${tag}>`,
		})
	} catch (err) {
		postMessage({ type: "domResponse", requestId, text: `Error clicking: ${err}` })
	}
}
