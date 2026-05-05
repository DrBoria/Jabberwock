/**
 * DOM serialization helpers — pure functions that transform the live DOM
 * into a JSON-compatible tree structure for agent consumption.
 *
 * These are the exact same functions that were inline in DevtoolProvider.tsx,
 * extracted here for modularity and testability.
 */

// ── Node Key Generation ──────────────────────────────────────────────────

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

	// For non-generic tags, deduplicate with :nth-child(N)
	const parent = el.parentElement
	if (parent) {
		const siblings = Array.from(parent.children).filter((s) => s.tagName.toLowerCase() === tag)
		const idx = siblings.indexOf(el) + 1
		if (siblings.length > 1) return `${tag}:nth-child(${idx})`
	}

	return tag
}

// ── Attribute Extraction ─────────────────────────────────────────────────

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

function getNodeText(el: Element): string {
	const text = el.textContent?.trim() || ""
	if (text.length > 150) return text.slice(0, 150) + "..."
	return text
}

function shouldSkipTag(tag: string): boolean {
	return ["script", "style", "noscript", "link", "meta"].includes(tag)
}

// ── Main Serialization ───────────────────────────────────────────────────

/**
 * Serialize a DOM Element (and its subtree) to a JSON-compatible tree.
 *
 * @param root - The root element to serialize
 * @param depth - Current recursion depth (0-based, incremented on each child descent)
 * @param maxDepth - Maximum depth before truncation (optional). When reached,
 *                   shows a `depth: N` indicator instead of expanding children.
 * @param maxChildren - Maximum children per node before truncation (optional)
 * @returns A record representing the DOM subtree
 */
export function serializeDomToTree(
	root: Element,
	depth = 0,
	maxDepth?: number,
	maxChildren?: number,
): Record<string, unknown> {
	const tag = root.tagName.toLowerCase()
	if (shouldSkipTag(tag)) return {}

	const text = getNodeText(root)
	const attrs = getRelevantAttributes(root)

	// If depth reaches maxDepth, show depth indicator instead of expanding
	if (maxDepth !== undefined && depth >= maxDepth) {
		const remainingDepth = computeSubtreeDepth(root, maxChildren)
		const node: Record<string, unknown> = {
			depth: remainingDepth,
		}
		if (Object.keys(attrs).length > 0) node._attrs = attrs
		if (text) node._text = text
		return { [getNodeKey(root)]: node }
	}

	// SVG / path / canvas leaf
	if (tag === "svg" || tag === "path" || tag === "canvas") {
		const testId = root.getAttribute("data-testid")
		const key = testId ? `[data-testid="${testId}"]` : tag
		const node: Record<string, unknown> = {}
		if (Object.keys(attrs).length > 0) node._attrs = attrs
		if (text) {
			node._text = text
		}
		return { [key]: node }
	}

	// iframe — embed content inline with continuous depth counting
	if (tag === "iframe") {
		const src = root.getAttribute("src") || ""
		const iframeNode: Record<string, unknown> = {}
		if (Object.keys(attrs).length > 0) iframeNode._attrs = attrs
		if (src) iframeNode._src = src

		// Try same-origin iframe first
		try {
			const iframe = root as HTMLIFrameElement
			const innerDoc = iframe.contentDocument || iframe.contentWindow?.document
			if (innerDoc?.body) {
				const innerTree = serializeDomToTree(innerDoc.body, depth + 1, maxDepth, maxChildren)
				if (Object.keys(innerTree).length > 0) {
					// Merge iframe content directly under the iframe key
					for (const [k, v] of Object.entries(innerTree)) {
						iframeNode[k] = v
					}
				}
			}
		} catch {
			// Cross-origin — mark for async resolution
			iframeNode.__crossOrigin = true
		}

		return { iframe: iframeNode }
	}

	// Build child tree
	const childTree: Record<string, unknown> = {}

	// Collect visible children (skip only script/style/noscript/link/meta)
	const children = Array.from(root.children)
	let visibleChildren = children.filter((c) => !shouldSkipTag(c.tagName.toLowerCase()))

	if (maxChildren !== undefined && visibleChildren.length > maxChildren) {
		visibleChildren = visibleChildren.slice(0, maxChildren)
	}

	for (const child of visibleChildren) {
		const key = getNodeKey(child)
		const subTree = serializeDomToTree(child, depth + 1, maxDepth, maxChildren)
		if (Object.keys(subTree).length > 0) {
			// If the child serialized with a single key that differs from what we computed,
			// nest it properly under our key
			const subTreeKeys = Object.keys(subTree)
			if (subTreeKeys.length === 1 && subTreeKeys[0] !== key) {
				childTree[key] = subTree
			} else {
				childTree[key] = subTree[key] ?? subTree
			}
		}
	}

	const key = getNodeKey(root)

	const result: Record<string, unknown> = {}
	result[key] = childTree

	const resultEntry = result[key] as Record<string, unknown>
	if (Object.keys(attrs).length > 0) {
		resultEntry._attrs = attrs
	}
	// Only include _text if node has its own direct TextNode content or has no element children
	const hasOwnText = Array.from(root.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
	if (text && (hasOwnText || visibleChildren.length === 0)) {
		resultEntry._text = text
	}

	return result
}

/**
 * Compute the maximum remaining depth in the subtree below this element.
 * Used to show a `depth: N` indicator when maxDepth is reached.
 */
function computeSubtreeDepth(el: Element, maxChildren?: number): number {
	let max = 0
	const children = Array.from(el.children)
	let visible = children.filter((c) => !shouldSkipTag(c.tagName.toLowerCase()))
	if (maxChildren !== undefined && visible.length > maxChildren) {
		visible = visible.slice(0, maxChildren)
	}
	for (const child of visible) {
		const d = computeSubtreeDepth(child, maxChildren)
		if (d > max) max = d
	}
	return max + 1
}
