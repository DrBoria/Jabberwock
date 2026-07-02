/**
 * typeText action handler — type text into an input/textarea or contenteditable element.
 *
 * Uses native value setters for React controlled inputs, execCommand for
 * contenteditable (rich text editors), and supports optional Enter key dispatch.
 * Also supports typing into elements inside iframes via postMessage.
 */
import type { DomHandlerContext } from "../../types.js"
import { findElementById, findElementBySelector } from "../../lookup.js"

async function typeInIframe(
	ctx: DomHandlerContext,
	selector: string,
	text: string,
	submit: boolean | undefined,
	requestId: string,
): Promise<boolean> {
	const { postMessage, queryIframe, resolveSelectorInIframe } = ctx
	const iframeTarget = await resolveSelectorInIframe(selector)
	if (!iframeTarget) return false

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
	return true
}

function typeIntoInputElement(el: Element, text: string): void {
	const proto = Object.getPrototypeOf(el)
	const nativeSetter = Object.getOwnPropertyDescriptor(proto.constructor.prototype, "value")?.set
	if (nativeSetter) {
		nativeSetter.call(el, text)
	} else {
		;(el as HTMLInputElement).value = text
	}
	el.dispatchEvent(new Event("input", { bubbles: true }))
	el.dispatchEvent(new Event("change", { bubbles: true }))
}

function typeIntoContentEditable(el: Element, text: string): void {
	const selection = window.getSelection()
	if (selection) {
		const range = document.createRange()
		range.selectNodeContents(el)
		range.collapse(false)
		selection.removeAllRanges()
		selection.addRange(range)
	}
	document.execCommand("insertText", false, text)
}

function typeIntoGenericElement(el: Element, text: string): void {
	el.textContent = text
	el.dispatchEvent(new Event("input", { bubbles: true }))
}

function dispatchAndRespond(el: Element, targetId: string, text: string, submit: boolean | undefined): void {
	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
		typeIntoInputElement(el, text)
	} else if (el.getAttribute("contenteditable") === "true") {
		typeIntoContentEditable(el, text)
	} else {
		typeIntoGenericElement(el, text)
	}

	if (submit) {
		const enterOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }
		el.dispatchEvent(new KeyboardEvent("keydown", enterOpts))
		el.dispatchEvent(new KeyboardEvent("keypress", enterOpts))
		el.dispatchEvent(new KeyboardEvent("keyup", enterOpts))
	}
}

function resolveTargetElement(selector: string | undefined, id: string | undefined): Element | null {
	return selector ? findElementBySelector(selector) : id ? findElementById(id) : null
}

function getTargetHint(selector: string | undefined, id: string | undefined): string {
	return selector || id || "?"
}

export async function handleTypeText(ctx: DomHandlerContext, req: Record<string, unknown>): Promise<void> {
	const { postMessage } = ctx
	const requestId = req.requestId as string
	const selector = req.selector as string | undefined
	const id = req.id as string | undefined
	const text = req.text as string
	const submit = req.submit as boolean | undefined

	try {
		if (selector) {
			const handled = await typeInIframe(ctx, selector, text, submit, requestId)
			if (handled) return
		}

		const el = resolveTargetElement(selector, id)
		if (!el) {
			postMessage({ type: "domResponse", requestId, text: `Element not found: ${getTargetHint(selector, id)}` })
			return
		}
		const targetId = getTargetHint(selector, id)

		if (typeof (el as HTMLElement).focus === "function") {
			;(el as HTMLElement).focus()
		}

		dispatchAndRespond(el, targetId, text, submit)

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
