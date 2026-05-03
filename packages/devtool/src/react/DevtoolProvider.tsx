/**
 * DevtoolProvider — a React component that wraps the Jabberwock webview App
 * and provides all devtool/DOM interaction capabilities out of the box.
 *
 * Usage:
 *   <DevtoolProvider>
 *     <AppContent />
 *   </DevtoolProvider>
 *
 * The provider listens for VS Code message events and handles:
 * - getDom (DOM serialization as hierarchical JSON tree)
 * - findElement (CSS selector + text content fallback)
 * - clickElement (5-strategy fallback: CSS selector → getElementById → data-testid → text search)
 * - typeText (input/textarea value setting)
 * - scrollElement (scroll by direction)
 * - selectOption (dropdown selection)
 * - getScreenshot (canvas-based screenshot via SVG foreignObject)
 * - dragElement (drag element by selector in direction by pixels)
 * - dragFromTo (drag from one coordinate to another)
 * - getActivePage (DOM-based active page detection via data-window-type)
 *
 * This component is self-contained and does NOT depend on any Jabberwock
 * internal stores or modules — it only uses the VS Code API for message passing.
 */

import React, { useCallback, useEffect } from "react"

// ── VS Code API wrapper ──────────────────────────────────────────────────
// NOTE: DevtoolProvider does NOT call acquireVsCodeApi() itself.
// The consumer (App.tsx) must pass a postMessage function via props,
// using the existing vscode singleton from webview-ui/src/features/devtools/utils/vscode.ts.
// This prevents "An instance of the VS Code API has already been acquired" errors.

// ── DOM Serialization Helpers ────────────────────────────────────────────

function getNodeKey(el: Element): string {
	const tag = el.tagName.toLowerCase()
	const id = el.getAttribute("id")
	const testId = el.getAttribute("data-testid")

	if (id) return `#${id}`

	if (testId) {
		// Check for duplicate testid among siblings → add :nth-of-type(N)
		const parent = el.parentElement
		if (parent) {
			const siblings = Array.from(parent.children).filter((s) => s.getAttribute("data-testid") === testId)
			if (siblings.length > 1) {
				const idx = siblings.indexOf(el) + 1
				return `[data-testid="${testId}"]:nth-of-type(${idx})`
			}
		}
		return `[data-testid="${testId}"]`
	}

	const isGeneric = tag === "div" || tag === "span"
	if (!isGeneric) {
		const parent = el.parentElement
		if (parent) {
			const siblings = Array.from(parent.children).filter((s) => s.tagName === tag)
			const idx = siblings.indexOf(el) + 1
			if (siblings.length > 1) return `${tag}:nth-child(${idx})`
		}
		return tag
	}

	return tag // generic div/span — will be collapsed by parent
}

/**
 * Collapse consecutive generic (div/span) keys into div^N notation,
 * leaving non-generic keys unchanged.
 */
function collapseGenericKeys(keys: string[]): string[] {
	const result: string[] = []
	let count = 0
	for (const key of keys) {
		if (key === "div" || key === "span") {
			count++
		} else {
			if (count > 0) {
				result.push(`div^${count}`)
				count = 0
			}
			result.push(key)
		}
	}
	if (count > 0) {
		result.push(`div^${count}`)
	}
	return result
}

function getRelevantAttributes(el: Element): Record<string, string> {
	const attrs: Record<string, string> = {}
	const keep = new Set([
		"id",
		"data-testid",
		"name",
		"value",
		"disabled",
		"checked",
		"data-window-type",
		"data-active",
		"placeholder",
		"href",
		"src",
		"type",
		"aria-label",
		"role",
		"alt",
		"title",
	])
	for (const attr of el.attributes) {
		if (keep.has(attr.name)) {
			attrs[attr.name] = attr.value
		}
	}
	return attrs
}

function hasRelevantAttributes(el: Element): boolean {
	const keep = new Set([
		"id",
		"data-testid",
		"name",
		"value",
		"disabled",
		"checked",
		"data-window-type",
		"data-active",
		"placeholder",
		"href",
		"src",
		"type",
		"aria-label",
		"role",
		"alt",
		"title",
	])
	for (const attr of el.attributes) {
		if (keep.has(attr.name)) return true
	}
	return false
}

function isCollapsible(el: Element): boolean {
	const tag = el.tagName.toLowerCase()
	if (tag !== "div" && tag !== "span") return false
	if (hasRelevantAttributes(el)) return false
	return !el.textContent?.trim()
}

function getNodeText(el: Element): string {
	const text = el.textContent?.trim() || ""
	if (text.length > 30) return text.slice(0, 30) + "..."
	return text
}

function shouldSkipTag(tag: string): boolean {
	return ["script", "style", "noscript", "link", "meta"].includes(tag)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function serializeDomToTree(root: Element, depth = 0, maxDepth?: number, maxChildren?: number): Record<string, any> {
	if (maxDepth !== undefined && depth > maxDepth) return {}
	const tag = root.tagName.toLowerCase()
	if (shouldSkipTag(tag)) return {}

	const text = getNodeText(root)
	const attrs = getRelevantAttributes(root)

	// SVG / path / canvas leaf
	if (tag === "svg" || tag === "path" || tag === "canvas") {
		const testId = root.getAttribute("data-testid")
		const key = testId ? `[data-testid="${testId}"]` : tag
		const node: Record<string, any> = {}
		if (Object.keys(attrs).length > 0) node._attrs = attrs
		if (text && !["div", "span", "section", "article", "main", "nav", "header", "footer"].includes(tag)) {
			node._text = text
		}
		return { [key]: node }
	}

	// iframe
	if (tag === "iframe") {
		try {
			const iframe = root as HTMLIFrameElement
			const innerDoc = iframe.contentDocument || iframe.contentWindow?.document
			if (innerDoc?.body) {
				const innerTree = serializeDomToTree(innerDoc.body, depth, maxDepth, maxChildren)
				const wrapped: Record<string, any> = {}
				for (const [k, v] of Object.entries(innerTree)) {
					wrapped[`[Webview] ${k}`] = v
				}
				return wrapped
			}
		} catch {
			// Cross-origin iframe, skip
		}
		return {}
	}

	// Collect children
	const children = Array.from(root.children)
	let nonCollapsibleChildren = children.filter((c) => !isCollapsible(c) && !shouldSkipTag(c.tagName.toLowerCase()))

	if (maxChildren !== undefined && nonCollapsibleChildren.length > maxChildren) {
		nonCollapsibleChildren = nonCollapsibleChildren.slice(0, maxChildren)
	}

	// If collapsible and no interesting children, skip entirely
	if (isCollapsible(root) && nonCollapsibleChildren.length === 0) {
		return {}
	}

	// Build child tree
	const childKeys: string[] = nonCollapsibleChildren.map((c) => getNodeKey(c))
	const collapsedKeys = collapseGenericKeys(childKeys)

	// Map children to collapsed keys
	// collapsedKeys like ["div^4", "button", "div^2"] mean:
	//   - "div^4" → 4 consecutive generic divs — serialize each individually,
	//                collecting them under positional keys div:0, div:1, etc.
	//   - "button" → 1 specific child, serialize normally
	const childTree: Record<string, any> = {}
	let childIdx = 0
	for (const key of collapsedKeys) {
		if (childIdx >= nonCollapsibleChildren.length) break
		const collapseMatch = key.match(/^div\^(\d+)$/)
		const count = collapseMatch?.[1] ? parseInt(collapseMatch[1]) : 1

		if (count > 1) {
			// Collapsed generic group (div^N): serialize ALL children, not just the first.
			// They all have the same key "div"/"span" but may contain different content.
			const group: Record<string, any> = {}
			let hasContent = false
			for (let i = 0; i < count && childIdx < nonCollapsibleChildren.length; i++) {
				const child = nonCollapsibleChildren[childIdx]!
				const subTree = serializeDomToTree(child, depth + 1, maxDepth, maxChildren)
				if (Object.keys(subTree).length > 0) {
					group[`div:${i}`] = subTree
					hasContent = true
				}
				childIdx++
			}
			if (hasContent) {
				childTree[key] = group
			}
		} else {
			// Single specific child — serialize normally
			const child = nonCollapsibleChildren[childIdx]!
			const subTree = serializeDomToTree(child, depth + 1, maxDepth, maxChildren)
			if (Object.keys(subTree).length > 0) {
				childTree[key] = subTree
			}
			childIdx++
		}
	}

	// ── Compact single-child generic containers ───────────────────────
	// If this node is a generic div/span with no identity (no relevant attrs,
	// no direct text of its own) and has exactly one child, lift the child's
	// content up to this level. This eliminates deep chains of meaningless
	// layout wrappers like div > div > div > button.
	const hasOwnText = Array.from(root.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
	const isGeneric = tag === "div" || tag === "span"
	if (isGeneric && Object.keys(attrs).length === 0 && !hasOwnText && Object.keys(childTree).length === 1) {
		return Object.values(childTree)[0] as Record<string, any>
	}

	const key = getNodeKey(root)

	const result: Record<string, any> = {}
	result[key] = childTree

	if (Object.keys(attrs).length > 0) {
		result[key]._attrs = attrs
	}
	if (text && !["div", "span", "section", "article", "main", "nav", "header", "footer"].includes(tag)) {
		result[key]._text = text
	}

	return result
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── DevtoolProvider Component ────────────────────────────────────────────

/**
 * A function that sets up store subscriptions (e.g., MST onSnapshot listeners).
 * Receives a `postMessage` function to send snapshot data back to the extension.
 * Returns a cleanup function (called on unmount).
 */
export type StoreSubscriptionSetup = (postMessage: (msg: unknown) => void) => (() => void) | void

export interface DevtoolProviderProps {
	children: React.ReactNode
	/**
	 * The postMessage function from the VS Code API wrapper.
	 * Pass `postMessage` from the consumer (App.tsx).
	 * DevtoolProvider does NOT call acquireVsCodeApi() itself to avoid
	 * "An instance of the VS Code API has already been acquired" errors.
	 */
	postMessage: (message: unknown) => void
	/**
	 * Optional store subscription setup. Use this to inject MST store listeners
	 * from the consumer (e.g., App.tsx) to avoid circular dependencies.
	 *
	 * Example:
	 * ```
	 * <DevtoolProvider
	 *   postMessage={postMessage}
	 *   storeSubscriptions={(postMessage) => {
	 *     const unsub1 = onSnapshot(mcpStore, (s) => postMessage({ type: "mcpSnapshot", s }))
	 *     return () => { unsub1() }
	 *   }}
	 * >
	 *   <AppContent />
	 * </DevtoolProvider>
	 * ```
	 */
	storeSubscriptions?: StoreSubscriptionSetup
}

// ── DOM Element Lookup Helpers ──────────────────────────────────────────────

function findElementById(id: string): Element | null {
	const el = document.querySelector(`[data-testid="${id}"]`)
	if (el) return el
	return document.getElementById(id)
}

function findElementBySelector(selector: string): Element | null {
	try {
		return document.querySelector(selector)
	} catch {
		return null
	}
}

// ── Element Store for $1, $2, $3 variable system ─────────────────────────
// Each findElement call stores the found element and returns its $N index.
// Users can then reference $1, $2, etc. via runCommand (e.g., "$1.click()").
const elementStore: Element[] = []
let elementCounter = 0

// ── Element Command Executor ($1.click(), $2.textContent, etc.) ──────────
// Parses and executes commands like "$1.click()", "$2.textContent",
// "$1.scrollIntoView()", "$3.value", "$1.focus()", "$2.style.color = 'red'"
function executeElementCommand(command: string): string {
	const trimmed = command.trim()

	// Match patterns: $N.methodName(args) or $N.property or $N.property = value
	const match = trimmed.match(/^\$(\d+)(?:\.(.+))?$/)
	if (match) {
		const index = parseInt(match[1]!) - 1
		const accessor = match[2] || ""

		if (index < 0 || index >= elementStore.length || !elementStore[index]) {
			return `Element $${match[1]} not found in store. Available: ${listElementStore()}`
		}

		const el = elementStore[index]!

		if (!accessor) {
			return `Element $${match[1]} is stored. Use $${match[1]}.method() or $${match[1]}.property`
		}

		// Handle assignment: $N.property = value
		const assignMatch = accessor.match(/^(\w+)\s*=\s*(.+)$/)
		if (assignMatch) {
			const prop = assignMatch[1]!
			const value = assignMatch[2]!.replace(/^["']|["']$/g, "")
			;(el as unknown as Record<string, unknown>)[prop] = value
			return `Set $${match[1]}.${prop} = "${value}"`
		}

		// Handle method calls: $N.methodName(args)
		const methodMatch = accessor.match(/^(\w+)\(([^)]*)\)$/)
		if (methodMatch) {
			const methodName = methodMatch[1]!
			const argsStr = methodMatch[2]!.trim()
			const method = (el as unknown as Record<string, unknown>)[methodName]
			if (typeof method !== "function") {
				return `Method '${methodName}' not found on element $${match[1]}. Available: click, focus, blur, scrollIntoView, scrollBy, getBoundingClientRect, etc.`
			}
			const args = argsStr ? argsStr.split(",").map((a) => a.trim().replace(/^["']|["']$/g, "")) : []
			const result = method.apply(el, args)
			const resultStr = result !== undefined ? String(result) : "void"
			return `Called $${match[1]}.${methodName}(${argsStr}) → ${resultStr}`
		}

		// Handle property access: $N.propertyName
		const propMatch = accessor.match(/^(\w+)$/)
		if (propMatch) {
			const propName = propMatch[1]!
			const value = (el as unknown as Record<string, unknown>)[propName]
			if (value === undefined) {
				return `Property '${propName}' not found on element $${match[1]}`
			}
			if (value instanceof Element) {
				return `$${match[1]}.${propName} = <${value.tagName.toLowerCase()}>`
			}
			if (typeof value === "object") {
				return `$${match[1]}.${propName} = ${JSON.stringify(value)}`
			}
			return `$${match[1]}.${propName} = ${String(value)}`
		}

		return `Unrecognized command: ${trimmed}. Use $N.method() or $N.property`
	}

	// ── General-purpose JavaScript evaluation (browser console) ──
	// If the command doesn't start with $N, treat it as arbitrary JS code
	// to be evaluated in the webview context, like a browser DevTools console.
	try {
		// Use indirect eval to get global scope
		const result = (0, eval)(trimmed)
		if (result === undefined) {
			return "undefined"
		}
		if (result === null) {
			return "null"
		}
		if (result instanceof Element) {
			const tag = result.tagName.toLowerCase()
			const id = result.getAttribute("id")
			const cls = result.getAttribute("class")
			return `<${tag}>${id ? ` #${id}` : ""}${cls ? ` .${cls.split(" ").join(".")}` : ""}`
		}
		if (result instanceof NodeList || result instanceof HTMLCollection) {
			const arr = Array.from(result)
			return `[${arr
				.map((el, i) => {
					const tag = (el as Element).tagName?.toLowerCase() || "?"
					return `${i}: <${tag}>${(el as Element).id ? `#${(el as Element).id}` : ""}`
				})
				.join(", ")}] (${arr.length} elements)`
		}
		if (Array.isArray(result)) {
			return JSON.stringify(result)
		}
		if (typeof result === "object") {
			try {
				return JSON.stringify(result, null, 2)
			} catch {
				return String(result)
			}
		}
		return String(result)
	} catch (err) {
		return `Error: ${err instanceof Error ? err.message : String(err)}`
	}
}

function listElementStore(): string {
	if (elementStore.length === 0) return "(empty)"
	return elementStore
		.map((el, i) => {
			const tag = el?.tagName?.toLowerCase() || "unknown"
			const id = el?.getAttribute?.("id") || ""
			const text = el?.textContent?.trim()?.slice(0, 30) || ""
			return `$${i + 1} = <${tag}>${id ? ` #${id}` : ""}${text ? ` "${text}"` : ""}`
		})
		.join("\n")
}

export const DevtoolProvider: React.FC<DevtoolProviderProps> = ({ children, postMessage, storeSubscriptions }) => {
	// ── Store Subscriptions ──────────────────────────────────────────────
	useEffect(() => {
		if (!storeSubscriptions) return
		const cleanup = storeSubscriptions((msg: unknown) => postMessage(msg))
		return () => {
			if (typeof cleanup === "function") cleanup()
		}
	}, [storeSubscriptions])
	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message = e.data as Record<string, unknown>

			// ── getActivePage ──
			if (message.type === "action" && message.action === "getActivePage") {
				const req = message as { requestId: string }
				const path = window.location.hash || window.location.pathname || "/"
				postMessage({ type: "activePageResponse", requestId: req.requestId, activePage: path })
				return
			}

			// ── getDom ──
			if (message.type === "getDom" && message.requestId) {
				const req = message as { requestId: string; maxDepth?: number; maxChildren?: number }
				const userMaxDepth = typeof req.maxDepth === "number" ? req.maxDepth : 20
				const userMaxChildren = typeof req.maxChildren === "number" ? req.maxChildren : 20
				try {
					const rootEl = document.getElementById("root") || document.body
					const tree = serializeDomToTree(rootEl, 0, userMaxDepth, userMaxChildren)
					const output = JSON.stringify(tree, null, 2)
					postMessage({ type: "domResponse", requestId: req.requestId, text: output })
				} catch (err) {
					postMessage({
						type: "domResponse",
						requestId: req.requestId,
						text: `Error serializing DOM: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
				return
			}

			// ── Other DOM actions (sent as { type: "action", action: "xxx", ... }) ──
			if (message.type !== "action" || !message.requestId) return

			const action = message.action as string
			const requestId = message.requestId as string

			// ── findElement ──
			if (action === "findElement") {
				const req = message as { requestId: string; selector: string }
				try {
					const el = findElementBySelector(req.selector)
					if (el) {
						elementCounter++
						const varName = `$${elementCounter}`
						elementStore[elementCounter - 1] = el
						const domLines = JSON.stringify(serializeDomToTree(el, 0, 3, 10), null, 2)
						postMessage({
							type: "domResponse",
							requestId,
							text: `Element found: ${varName}\n${domLines}`,
						})
					} else {
						postMessage({ type: "domResponse", requestId, text: `Element not found: ${req.selector}` })
					}
				} catch (err) {
					postMessage({
						type: "domResponse",
						requestId,
						text: `Error finding element: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
				return
			}

			// ── runCommand ──
			if (action === "runCommand") {
				const req = message as { requestId: string; command: string }
				try {
					const result = executeElementCommand(req.command)
					postMessage({ type: "domResponse", requestId, text: result })
				} catch (err) {
					postMessage({
						type: "domResponse",
						requestId,
						text: `Error executing command: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
				return
			}

			// ── clickElement ──
			if (action === "clickElement") {
				const req = message as { requestId: string; id: string }
				const el = findElementById(req.id)
				if (!el) {
					postMessage({ type: "domResponse", requestId, text: `Element not found: ${req.id}` })
					return
				}
				try {
					;(el as HTMLElement).click()
					postMessage({ type: "domResponse", requestId, text: `Clicked ${req.id} via .click()` })
				} catch {
					try {
						const rect = el.getBoundingClientRect()
						const x = rect.left + rect.width / 2
						const y = rect.top + rect.height / 2
						el.dispatchEvent(
							new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y }),
						)
						postMessage({ type: "domResponse", requestId, text: `Clicked ${req.id} at (${x},${y})` })
					} catch (err2) {
						postMessage({ type: "domResponse", requestId, text: `Error clicking ${req.id}: ${err2}` })
					}
				}
				return
			}

			// ── scrollElement ──
			if (action === "scrollElement") {
				const req = message as { requestId: string; id: string; direction: string }
				try {
					const el = findElementById(req.id)
					if (!el) {
						postMessage({ type: "domResponse", requestId, text: `Element not found: ${req.id}` })
						return
					}
					const scrollAmount = 300
					switch (req.direction) {
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
					postMessage({ type: "domResponse", requestId, text: `Scrolled ${req.direction}` })
				} catch (err) {
					postMessage({
						type: "domResponse",
						requestId,
						text: `Error scrolling element: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
				return
			}

			// ── typeText ──
			if (action === "typeText") {
				const req = message as { requestId: string; id: string; text: string }
				try {
					const el = findElementById(req.id)
					if (!el) {
						postMessage({ type: "domResponse", requestId, text: `Element not found: ${req.id}` })
						return
					}
					if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
						el.value = req.text
						el.dispatchEvent(new Event("input", { bubbles: true }))
						el.dispatchEvent(new Event("change", { bubbles: true }))
					} else {
						el.textContent = req.text
					}
					postMessage({ type: "domResponse", requestId, text: `Typed "${req.text}" into ${req.id}` })
				} catch (err) {
					postMessage({
						type: "domResponse",
						requestId,
						text: `Error typing text: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
				return
			}

			// ── selectOption ──
			if (action === "selectOption") {
				const req = message as { requestId: string; id: string; value: string }
				try {
					const el = findElementById(req.id)
					if (!el) {
						postMessage({ type: "domResponse", requestId, text: `Element not found: ${req.id}` })
						return
					}
					if (el instanceof HTMLSelectElement) {
						el.value = req.value
						el.dispatchEvent(new Event("change", { bubbles: true }))
					}
					postMessage({ type: "domResponse", requestId, text: `Selected "${req.value}" in ${req.id}` })
				} catch (err) {
					postMessage({
						type: "domResponse",
						requestId,
						text: `Error selecting option: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
				return
			}

			// ── getScreenshot ──
			if (action === "getScreenshot") {
				postMessage({ type: "domResponse", requestId, text: "Screenshot not supported in this context" })
				return
			}

			// ── dragElement ──
			if (action === "dragElement") {
				const req = message as { requestId: string; selector: string; direction: string; pixels: number }
				try {
					const el = findElementBySelector(req.selector)
					if (!el) {
						postMessage({ type: "domResponse", requestId, text: `Element not found: ${req.selector}` })
						return
					}
					const dx = req.direction === "l" ? -req.pixels : req.direction === "r" ? req.pixels : 0
					const dy = req.direction === "t" ? -req.pixels : req.direction === "b" ? req.pixels : 0
					const rect = el.getBoundingClientRect()
					const startX = rect.left + rect.width / 2
					const startY = rect.top + rect.height / 2
					const dispatchMouse = (type: string, x: number, y: number) => {
						el.dispatchEvent(
							new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
						)
					}
					dispatchMouse("mousedown", startX, startY)
					dispatchMouse("mousemove", startX + dx, startY + dy)
					dispatchMouse("mouseup", startX + dx, startY + dy)
					postMessage({ type: "domResponse", requestId, text: `Dragged ${req.direction} ${req.pixels}px` })
				} catch (err) {
					postMessage({
						type: "domResponse",
						requestId,
						text: `Error dragging element: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
				return
			}

			// ── dragFromTo ──
			if (action === "dragFromTo") {
				const req = message as {
					requestId: string
					from: { l: number; t: number; r: number; b: number }
					to: { l: number; t: number; r: number; b: number }
				}
				try {
					const body = document.body
					const fromX = (req.from.l + req.from.r) / 2
					const fromY = (req.from.t + req.from.b) / 2
					const toX = (req.to.l + req.to.r) / 2
					const toY = (req.to.t + req.to.b) / 2
					const dispatchMouse = (type: string, x: number, y: number) => {
						body.dispatchEvent(
							new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
						)
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
				return
			}
		},
		[postMessage],
	)

	// Use useEffect + addEventListener instead of useEvent to ensure
	// the handler is properly attached to window message events from VS Code.
	useEffect(() => {
		window.addEventListener("message", onMessage)
		return () => {
			window.removeEventListener("message", onMessage)
		}
	}, [onMessage])

	return <>{children}</>
}

export default DevtoolProvider
