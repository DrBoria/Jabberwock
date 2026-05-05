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

// ── Generic Tag Collapsing ───────────────────────────────────────────────

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

// ── Node Classification ──────────────────────────────────────────────────

function isCollapsible(el: Element): boolean {
	const tag = el.tagName.toLowerCase()
	if (tag !== "div" && tag !== "span") return false
	if (hasRelevantAttributes(el)) return false
	return !el.textContent?.trim()
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
 * @param depth - Current recursion depth
 * @param maxDepth - Maximum depth before truncation (optional)
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

	// If depth exceeds maxDepth, show summary instead of empty {}
	if (maxDepth !== undefined && depth > maxDepth) {
		return {
			__truncated: true,
			__tag: tag,
			__text: text || root.textContent?.trim()?.slice(0, 100) || "",
			__children: root.children.length,
		}
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

	// iframe
	if (tag === "iframe") {
		const src = root.getAttribute("src") || ""
		try {
			const iframe = root as HTMLIFrameElement
			const innerDoc = iframe.contentDocument || iframe.contentWindow?.document
			if (innerDoc?.body) {
				const innerTree = serializeDomToTree(innerDoc.body, depth, maxDepth, maxChildren)
				const wrapped: Record<string, unknown> = {}
				for (const [k, v] of Object.entries(innerTree)) {
					wrapped[`[Webview] ${k}`] = v
				}
				return wrapped
			}
		} catch {
			// Cross-origin iframe — mark with a placeholder that the async
			// handler will try to resolve via postMessage
		}
		return {
			__iframe: true,
			__src: src,
		}
	}

	// Collect children
	const children = Array.from(root.children)
	let nonCollapsibleChildren = children.filter((c) => !isCollapsible(c) && !shouldSkipTag(c.tagName.toLowerCase()))

	if (maxChildren !== undefined && nonCollapsibleChildren.length > maxChildren) {
		nonCollapsibleChildren = nonCollapsibleChildren.slice(0, maxChildren)
	}

	// If collapsible and no interesting children, show summary instead of empty {}
	if (isCollapsible(root) && nonCollapsibleChildren.length === 0) {
		return {
			__collapsed: true,
			__tag: tag,
			__text: text || root.textContent?.trim()?.slice(0, 100) || "",
			__children: children.length,
		}
	}

	// Build child tree
	const childKeys: string[] = nonCollapsibleChildren.map((c) => getNodeKey(c))
	const collapsedKeys = collapseGenericKeys(childKeys)

	// Map children to collapsed keys
	const childTree: Record<string, unknown> = {}
	let childIdx = 0
	for (const key of collapsedKeys) {
		if (childIdx >= nonCollapsibleChildren.length) break
		const collapseMatch = key.match(/^div\^(\d+)$/)
		const count = collapseMatch?.[1] ? parseInt(collapseMatch[1]) : 1

		if (count > 1) {
			// Collapsed generic group (div^N): serialize ALL children
			const group: Record<string, unknown> = {}
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
				childTree[key] = subTree[key] ?? subTree
			}
			childIdx++
		}
	}

	// ── Compact single-child generic containers ───────────────────────
	const hasOwnText = Array.from(root.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
	const isGeneric = tag === "div" || tag === "span"
	if (isGeneric && Object.keys(attrs).length === 0 && !hasOwnText && Object.keys(childTree).length === 1) {
		return Object.values(childTree)[0] as Record<string, unknown>
	}

	const key = getNodeKey(root)

	const result: Record<string, unknown> = {}
	result[key] = childTree

	const resultEntry = result[key] as Record<string, unknown>
	if (Object.keys(attrs).length > 0) {
		resultEntry._attrs = attrs
	}
	// Only include _text if node has its own direct TextNode content or is a leaf
	// This avoids duplicating text up the parent chain (children already have their own _text)
	if (text && (hasOwnText || nonCollapsibleChildren.length === 0)) {
		resultEntry._text = text
	}

	return result
}
