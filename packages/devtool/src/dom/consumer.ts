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

// ── Response Helper ───────────────────────────────────────────────────────

function respond(event: MessageEvent, payload: Record<string, unknown>): void {
	try {
		event.source?.postMessage(
			{ type: "dom-response", requestId: (event.data as Record<string, unknown>).requestId, ...payload },
			{ targetOrigin: "*" } as WindowPostMessageOptions,
		)
	} catch {
		// Ignore postMessage errors
	}
}

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

		// Execute user command on the found element if provided
		if (userCommand) {
			try {
				const fn = new Function("$0", `return (${userCommand})`)
				const cmdResult = fn(innerEl)
				const resultStr =
					cmdResult === undefined
						? "undefined"
						: cmdResult === null
							? "null"
							: cmdResult === ""
								? '"" (empty string)'
								: cmdResult instanceof Element
									? `<${cmdResult.tagName.toLowerCase()}>`
									: cmdResult instanceof NodeList || cmdResult instanceof HTMLCollection
										? `[${Array.from(cmdResult)
												.map((el2, i) => {
													const tag = (el2 as Element).tagName?.toLowerCase() || "?"
													return `${i}: <${tag}>${(el2 as Element).id ? `#${(el2 as Element).id}` : ""}`
												})
												.join(", ")}] (${cmdResult.length} elements)`
										: typeof cmdResult === "object"
											? JSON.stringify(cmdResult, null, 2)
											: String(cmdResult)
				result.commandResult = resultStr
			} catch (cmdErr) {
				result.commandError = cmdErr instanceof Error ? cmdErr.message : String(cmdErr)
			}
		}

		respond(event, { result })
	} else if (userCommand) {
		// No matching element but user provided a command — execute against document.body
		try {
			const fn = new Function("$0", `return (${userCommand})`)
			const cmdResult = fn(document.body)
			const resultStr =
				cmdResult === undefined
					? "undefined"
					: cmdResult === null
						? "null"
						: cmdResult === ""
							? '"" (empty string)'
							: typeof cmdResult === "object"
								? JSON.stringify(cmdResult, null, 2)
								: String(cmdResult)
			respond(event, { result: { commandResult: resultStr } })
		} catch (cmdErr) {
			respond(event, { result: { commandError: cmdErr instanceof Error ? cmdErr.message : String(cmdErr) } })
		}
	} else {
		respond(event, { result: { html: "" } })
	}
}

// ── dom-action Handlers ───────────────────────────────────────────────────

function handleClick(event: MessageEvent, req: Record<string, unknown>): void {
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

function handleType(event: MessageEvent, req: Record<string, unknown>): void {
	const el = resolveElement(req)
	if (!el) return

	const text = (req.text as string) || ""
	const submit = req.submit === true

	if (typeof (el as HTMLElement).focus === "function") (el as HTMLElement).focus()

	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
		const proto = Object.getPrototypeOf(el)
		const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set
		if (nativeSetter) {
			nativeSetter.call(el, text)
		} else {
			;(el as HTMLInputElement).value = text
		}
		el.dispatchEvent(new Event("input", { bubbles: true }))
		el.dispatchEvent(new Event("change", { bubbles: true }))
	} else if (el.getAttribute("contenteditable") === "true") {
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

	respond(event, { result: { success: true, message: `Typed into ${req.selector}` } })
}

function handleScroll(event: MessageEvent, req: Record<string, unknown>): void {
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

function handleDrag(event: MessageEvent, req: Record<string, unknown>): void {
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

// ── Element Resolution ────────────────────────────────────────────────────

function resolveElement(req: Record<string, unknown>): Element | null {
	const selector = req.selector as string | undefined
	if (!selector) {
		return null
	}
	const el = document.querySelector(selector)
	if (!el) {
		// Can't respond here since we don't have the event — caller handles this
		return null
	}
	return el
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

	// ── dom-query (read DOM) ──────────────────────────────────────────
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

	// ── dom-action (interact with DOM) ────────────────────────────────
	if (data.type === "dom-action") {
		const command = data.command as string
		const handler = domActionHandlers[command]
		if (handler) {
			// Resolve element first — if not found, respond with error
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
