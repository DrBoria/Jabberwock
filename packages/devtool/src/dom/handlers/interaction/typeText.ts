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
	// `composed: true` makes the events retarget through a shadow DOM boundary
	// when the input lives inside a custom element's shadow root, so host-level
	// listeners (e.g. React `onInput` wrapped by @vscode/webview-ui-toolkit)
	// still fire. For light-DOM inputs this is a no-op.
	const eventOpts: EventInit = { bubbles: true, composed: true }
	el.dispatchEvent(new Event("input", eventOpts))
	el.dispatchEvent(new Event("change", eventOpts))
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

/**
 * Type into a shadow-DOM host element (e.g. Fast Elements such as
 * `vscode-text-field` / `vscode-text-area`): the real editable control lives
 * inside `shadowRoot` (`part="control"`).
 *
 * Writing the value onto that inner input through its native setter and
 * dispatching a composed `input` event there reproduces a real keystroke:
 * the Fast control's own `handleTextInput` handler copies the value onto the
 * host (`this.value = this.control.value`) and the composed `input` event
 * retargets to the host, where React's `onInput` (wired by the toolkit's
 * `wrap(..., events: { onInput: "input" })`) listens for it — and
 * `e.target.value` reads the host's `value` property.
 *
 * Returns `true` when a shadow control was found and typed into.
 */
function typeIntoShadowHost(el: HTMLElement, text: string): boolean {
	if (!el.shadowRoot) {
		return false
	}
	const control = el.shadowRoot.querySelector<HTMLElement>('input, textarea, [contenteditable="true"]')
	if (!control) {
		return false
	}
	if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
		typeIntoInputElement(control, text)
		return true
	}
	if (control.isContentEditable) {
		typeIntoContentEditable(control, text)
		return true
	}
	return false
}

function dispatchAndRespond(el: Element, targetId: string, text: string, submit: boolean | undefined): void {
	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
		typeIntoInputElement(el, text)
	} else if (el.getAttribute("contenteditable") === "true") {
		typeIntoContentEditable(el, text)
	} else if (el instanceof HTMLElement && typeIntoShadowHost(el, text)) {
		// Shadow-DOM host (e.g. vscode-text-field): typed into the inner control.
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
