/**
 * dragElement and dragFromTo action handlers.
 *
 * dragElement: drag an element by CSS selector in a direction by a number of pixels.
 * dragFromTo: drag from one absolute coordinate to another (measured in page pixels).
 */
import type { DomHandlerContext } from "../../types.js"
import { findElementBySelector } from "../../lookup.js"

/**
 * Drag an element (matched by CSS selector) in a direction by a number of pixels.
 * Supports dragging elements inside iframes via postMessage.
 */
async function dragInIframe(
	ctx: DomHandlerContext,
	selector: string,
	direction: string,
	pixels: number,
	requestId: string,
): Promise<boolean> {
	const { postMessage, queryIframe, resolveSelectorInIframe } = ctx
	const iframeTarget = await resolveSelectorInIframe(selector)
	if (!iframeTarget) return false

	try {
		await queryIframe(iframeTarget.iframe, {
			type: "dom-action",
			command: "drag",
			selector: iframeTarget.innerSelector,
			direction,
			pixels,
		})
		postMessage({
			type: "domResponse",
			requestId,
			text: `Dragged ${iframeTarget.innerSelector} ${direction} ${pixels}px inside iframe via postMessage`,
		})
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error dragging inside iframe: ${err instanceof Error ? err.message : String(err)}`,
		})
	}
	return true
}

function dragElementByPixels(el: Element, direction: string, pixels: number): void {
	const dx = direction === "l" ? -pixels : direction === "r" ? pixels : 0
	const dy = direction === "t" ? -pixels : direction === "b" ? pixels : 0
	const rect = el.getBoundingClientRect()
	const startX = rect.left + rect.width / 2
	const startY = rect.top + rect.height / 2
	const dispatchMouse = (type: string, x: number, y: number) => {
		el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }))
	}
	dispatchMouse("mousedown", startX, startY)
	dispatchMouse("mousemove", startX + dx, startY + dy)
	dispatchMouse("mouseup", startX + dx, startY + dy)
}

export async function handleDragElement(ctx: DomHandlerContext, req: Record<string, unknown>): Promise<void> {
	const { postMessage } = ctx
	const requestId = req.requestId as string
	const selector = req.selector as string
	const direction = req.direction as string
	const pixels = req.pixels as number

	try {
		const handled = await dragInIframe(ctx, selector, direction, pixels, requestId)
		if (handled) return

		const el = findElementBySelector(selector)
		if (!el) {
			postMessage({ type: "domResponse", requestId, text: `Element not found: ${selector}` })
			return
		}
		dragElementByPixels(el, direction, pixels)
		postMessage({ type: "domResponse", requestId, text: `Dragged ${direction} ${pixels}px` })
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error dragging element: ${err instanceof Error ? err.message : String(err)}`,
		})
	}
}

/**
 * Drag from one absolute coordinate to another, dispatching mousedown → mousemove (×10) → mouseup.
 * Coordinates are measured from element bounding rects (l=left, t=top, r=right, b=bottom).
 */
export function handleDragFromTo(ctx: DomHandlerContext, req: Record<string, unknown>): void {
	const { postMessage } = ctx
	const requestId = req.requestId as string
	const from = req.from as { l: number; t: number; r: number; b: number }
	const to = req.to as { l: number; t: number; r: number; b: number }

	try {
		const body = document.body
		const fromX = (from.l + from.r) / 2
		const fromY = (from.t + from.b) / 2
		const toX = (to.l + to.r) / 2
		const toY = (to.t + to.b) / 2
		const dispatchMouse = (type: string, x: number, y: number) => {
			body.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }))
		}
		dispatchMouse("mousedown", fromX, fromY)
		const steps = 10
		for (let i = 1; i <= steps; i++) {
			const t = i / steps
			dispatchMouse("mousemove", fromX + (toX - fromX) * t, fromY + (toY - fromY) * t)
		}
		dispatchMouse("mouseup", toX, toY)
		postMessage({
			type: "domResponse",
			requestId,
			text: `Dragged from (${fromX},${fromY}) to (${toX},${toY})`,
		})
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error dragging: ${err instanceof Error ? err.message : String(err)}`,
		})
	}
}
