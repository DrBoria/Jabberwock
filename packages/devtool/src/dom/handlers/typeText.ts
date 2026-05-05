/**
 * typeText action handler — type text into an input/textarea or contenteditable element.
 *
 * Uses native value setters for React controlled inputs, execCommand for
 * contenteditable (rich text editors), and supports optional Enter key dispatch.
 * Also supports typing into elements inside iframes via postMessage.
 */
import type { DomHandlerContext } from "../types.js"
import { findElementById, findElementBySelector } from "../lookup.js"

export async function handleTypeText(ctx: DomHandlerContext, req: Record<string, unknown>): Promise<void> {
	const { postMessage, queryIframe, resolveSelectorInIframe } = ctx
	const requestId = req.requestId as string
	const selector = req.selector as string | undefined
	const id = req.id as string | undefined
	const text = req.text as string
	const submit = req.submit as boolean | undefined

	try {
		// Check if selector targets an iframe
		if (selector) {
			const iframeTarget = await resolveSelectorInIframe(selector)
			if (iframeTarget) {
				try {
					await queryIframe(iframeTarget.iframe, {
						type: "dom-action",
						command: "type",
						selector: iframeTarget.innerSelector,
						text,
						submit,
					})
					postMessage({
						type: "domResponse",
						requestId,
						text: `Typed "${text}" into ${iframeTarget.innerSelector} inside iframe via postMessage`,
					})
				} catch (err) {
					postMessage({
						type: "domResponse",
						requestId,
						text: `Error typing inside iframe: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
				return
			}
		}

		// Find element: prefer selector over id
		const el = selector ? findElementBySelector(selector) : id ? findElementById(id) : null
		if (!el) {
			const hint = selector || id || "?"
			postMessage({ type: "domResponse", requestId, text: `Element not found: ${hint}` })
			return
		}
		const targetId = selector || id || "?"

		// Focus the element first
		if (typeof (el as HTMLElement).focus === "function") {
			;(el as HTMLElement).focus()
		}

		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
			// Use native setter for React controlled inputs
			const proto = Object.getPrototypeOf(el)
			const nativeSetter = Object.getOwnPropertyDescriptor(proto.constructor.prototype, "value")?.set
			if (nativeSetter) {
				nativeSetter.call(el, text)
			} else {
				;(el as HTMLInputElement).value = text
			}
			el.dispatchEvent(new Event("input", { bubbles: true }))
			el.dispatchEvent(new Event("change", { bubbles: true }))
		} else if (el.getAttribute("contenteditable") === "true") {
			// For contenteditable (rich text editors), use execCommand which
			// properly integrates with React's synthetic event system
			const selection = window.getSelection()
			if (selection) {
				const range = document.createRange()
				range.selectNodeContents(el)
				range.collapse(false)
				selection.removeAllRanges()
				selection.addRange(range)
			}
			document.execCommand("insertText", false, text)
		} else {
			el.textContent = text
			el.dispatchEvent(new Event("input", { bubbles: true }))
		}

		if (submit) {
			const enterOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }
			el.dispatchEvent(new KeyboardEvent("keydown", enterOpts))
			el.dispatchEvent(new KeyboardEvent("keypress", enterOpts))
			el.dispatchEvent(new KeyboardEvent("keyup", enterOpts))
		}

		postMessage({
			type: "domResponse",
			requestId,
			text: `Typed "${text}" into ${targetId}${submit ? " + Enter" : ""}`,
		})
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error typing text: ${err instanceof Error ? err.message : String(err)}`,
		})
	}
}
