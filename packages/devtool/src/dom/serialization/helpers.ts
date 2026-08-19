/**
 * Low-level DOM serialization helpers — node key generation, attribute
 * extraction, text truncation, depth computation.
 */

export function getNodeKey(el: Element): string {
	const tag = el.tagName.toLowerCase()
	const id = el.getAttribute("id")
	const testId = el.getAttribute("data-testid")

	if (id) return `#${id}`

	if (testId) {
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

	const parent = el.parentElement
	if (parent) {
		const siblings = Array.from(parent.children).filter((s) => s.tagName.toLowerCase() === tag)
		const idx = siblings.indexOf(el) + 1
		if (siblings.length > 1) return `${tag}:nth-child(${idx})`
	}

	return tag
}

export function getRelevantAttributes(el: Element): Record<string, string> {
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
	for (const attr of Array.from(el.attributes)) {
		if (keep.has(attr.name)) {
			attrs[attr.name] = attr.value
		}
	}
	return attrs
}

export function getNodeText(el: Element): string {
	const text = el.textContent?.trim() || ""
	if (text.length > 150) return text.slice(0, 150) + "..."
	return text
}

export function computeSubtreeDepth(el: Element, maxChildren?: number): number {
	let max = 0
	const children = Array.from(el.children)
	let visible = children.filter(
		(c) => !["script", "style", "noscript", "link", "meta"].includes(c.tagName.toLowerCase()),
	)
	if (maxChildren !== undefined && visible.length > maxChildren) {
		visible = visible.slice(0, maxChildren)
	}
	for (const child of visible) {
		const d = computeSubtreeDepth(child, maxChildren)
		if (d > max) max = d
	}
	return max + 1
}

export function serializeMaxDepthNode(
	root: Element,
	depth: number,
	maxDepth: number,
	maxChildren?: number,
): Record<string, unknown> {
	const remainingDepth = computeSubtreeDepth(root, maxChildren)
	const text = getNodeText(root)
	const attrs = getRelevantAttributes(root)
	const node: Record<string, unknown> = { depth: remainingDepth }
	if (Object.keys(attrs).length > 0) node._attrs = attrs
	if (text) node._text = text
	return { [getNodeKey(root)]: node }
}

export function serializeLeafElement(root: Element): Record<string, unknown> {
	const tag = root.tagName.toLowerCase()
	const testId = root.getAttribute("data-testid")
	const key = testId ? `[data-testid="${testId}"]` : tag
	const text = getNodeText(root)
	const attrs = getRelevantAttributes(root)
	const node: Record<string, unknown> = {}
	if (Object.keys(attrs).length > 0) node._attrs = attrs
	if (text) node._text = text
	return { [key]: node }
}

export function computeIframeIndex(root: Element): number {
	const parent = root.parentElement
	if (!parent) return 1
	const siblings = Array.from(parent.querySelectorAll("iframe"))
	return siblings.indexOf(root as HTMLIFrameElement) + 1
}
