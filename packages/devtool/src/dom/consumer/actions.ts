/**
 * DOM action handlers for the consumer — click, type, scroll, drag.
 */
import { respond, resolveElement } from "./utils.js"

// ── Typing helpers ────────────────────────────────────────────────────────

function dispatchEnterKey(el: Element): void {
	const enterOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }
	el.dispatchEvent(new KeyboardEvent("keydown", enterOpts))
	el.dispatchEvent(new KeyboardEvent("keypress", enterOpts))
	el.dispatchEvent(new KeyboardEvent("keyup", enterOpts))
}

function typeIntoInputElement(el: Element, text: string): void {
	const inputEl = el as HTMLInputElement
	const proto = Object.getPrototypeOf(inputEl)
	const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set
	if (nativeSetter) {
		nativeSetter.call(inputEl, text)
	} else {
		inputEl.value = text
	}
	inputEl.dispatchEvent(new Event("input", { bubbles: true }))
	inputEl.dispatchEvent(new Event("change", { bubbles: true }))
}

function typeIntoContentEditableElement(el: Element, text: string): void {
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

function typeIntoElement(el: Element, text: string): void {
	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
		typeIntoInputElement(el, text)
	} else if (el.getAttribute("contenteditable") === "true") {
		typeIntoContentEditableElement(el, text)
	} else {
		el.textContent = text
		el.dispatchEvent(new Event("input", { bubbles: true }))
	}
}

// ── Action handlers ───────────────────────────────────────────────────────

export function handleClick(event: MessageEvent, req: Record<string, unknown>): void {
	const el = resolveElement(req)
	if (!el) return

	if (typeof (el as HTMLElement).click === "function") {
		;(el as HTMLElement).click()
	} else {
		const rect = el.getBoundingClientRect()
		const cx = rect.left + rect.width / 2
		const cy = rect.top + rect.height / 2
		const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy }
		el.dispatchEvent(new PointerEvent("pointerdown", opts))
		el.dispatchEvent(new PointerEvent("pointerup", opts))
		el.dispatchEvent(new MouseEvent("mousedown", opts))
		el.dispatchEvent(new MouseEvent("mouseup", opts))
		el.dispatchEvent(new MouseEvent("click", opts))
	}

	// Build a descriptive label for the clicked element
	const tag = el.tagName.toLowerCase()
	const text = (el.textContent || "").trim().slice(0, 80)
	const id = el.getAttribute("id")
	const testId = el.getAttribute("data-testid")
	const ariaLabel = el.getAttribute("aria-label")
	const labelParts: string[] = [`<${tag}>`]
	if (id) labelParts.push(`#${id}`)
	if (testId) labelParts.push(`[data-testid="${testId}"]`)
	if (ariaLabel) labelParts.push(`aria-label="${ariaLabel}"`)
	if (text) labelParts.push(`"${text}"`)

	respond(event, { result: { success: true, message: `Clicked ${labelParts.join(" ")}` } })
}

export function handleType(event: MessageEvent, req: Record<string, unknown>): void {
	const el = resolveElement(req)
	if (!el) return

	const text = (req.text as string) || ""
	const submit = req.submit === true

	if (typeof (el as HTMLElement).focus === "function") (el as HTMLElement).focus()

	typeIntoElement(el, text)

	if (submit) dispatchEnterKey(el)

	respond(event, { result: { success: true, message: `Typed into ${req.selector}` } })
}

export function handleScroll(event: MessageEvent, req: Record<string, unknown>): void {
	const el = resolveElement(req)
	if (!el) return

	const scrollAmount = 300
	const dir = (req.direction as string) || "down"
	switch (dir) {
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

	respond(event, { result: { success: true, message: `Scrolled ${dir}` } })
}

export function handleDrag(event: MessageEvent, req: Record<string, unknown>): void {
	const el = resolveElement(req)
	if (!el) return

	const pixels = (req.pixels as number) || 50
	const dx = req.direction === "l" ? -pixels : req.direction === "r" ? pixels : 0
	const dy = req.direction === "t" ? -pixels : req.direction === "b" ? pixels : 0
	const rect = el.getBoundingClientRect()
	const startX = rect.left + rect.width / 2
	const startY = rect.top + rect.height / 2
	const endX = startX + dx
	const endY = startY + dy

	const pointerOpts = {
		bubbles: true,
		cancelable: true,
		pointerId: 1,
		clientX: startX,
		clientY: startY,
		isPrimary: true,
	}

	// Step 1: pointerdown on the element — dnd-kit captures this via React listeners
	el.dispatchEvent(new PointerEvent("pointerdown", pointerOpts))
	el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: startX, clientY: startY }))

	// Step 2: Use requestAnimationFrame to let dnd-kit's PointerSensor activate and register
	// native document-level listeners for pointermove and pointerup
	requestAnimationFrame(() => {
		const moveOpts = {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			clientX: endX,
			clientY: endY,
			isPrimary: true,
		}
		// Dispatch pointermove on document — dnd-kit's native listener catches it
		document.dispatchEvent(new PointerEvent("pointermove", moveOpts))
		document.dispatchEvent(
			new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: endX, clientY: endY }),
		)

		requestAnimationFrame(() => {
			// Dispatch pointerup on document — dnd-kit's native listener is registered on document
			document.dispatchEvent(
				new PointerEvent("pointerup", {
					bubbles: true,
					cancelable: true,
					pointerId: 1,
					clientX: endX,
					clientY: endY,
					isPrimary: true,
				}),
			)
			document.dispatchEvent(
				new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: endX, clientY: endY }),
			)

			respond(event, { result: { success: true, message: `Dragged ${req.direction} ${pixels}px` } })
		})
	})
}
