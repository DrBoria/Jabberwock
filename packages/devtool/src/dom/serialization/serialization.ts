/**
 * DOM serialization helpers — pure functions that transform the live DOM
 * into a JSON-compatible tree structure for agent consumption.
 *
 * These are the exact same functions that were inline in DevtoolProvider.tsx,
 * extracted here for modularity and testability.
 */
import {
	getNodeKey,
	getRelevantAttributes,
	getNodeText,
	serializeMaxDepthNode,
	serializeLeafElement,
	computeIframeIndex,
} from "./helpers.js"

// ── Iframe Serialization ─────────────────────────────────────────────────

function trySerializeIframeInner(
	iframeNode: Record<string, unknown>,
	root: Element,
	depth: number,
	maxDepth?: number,
	maxChildren?: number,
): void {
	try {
		const iframe = root as HTMLIFrameElement
		const innerDoc = iframe.contentDocument || iframe.contentWindow?.document
		if (innerDoc?.body) {
			const innerTree = serializeDomToTree(innerDoc.body, depth + 1, maxDepth, maxChildren)
			if (Object.keys(innerTree).length > 0) {
				for (const [k, v] of Object.entries(innerTree)) {
					iframeNode[k] = v
				}
			}
		}
	} catch {
		iframeNode.__crossOrigin = true
	}
}

function serializeIframeElement(
	root: Element,
	depth: number,
	maxDepth?: number,
	maxChildren?: number,
): Record<string, unknown> {
	const attrs = getRelevantAttributes(root)
	const src = root.getAttribute("src") || ""
	const iframeNode: Record<string, unknown> = {}
	if (Object.keys(attrs).length > 0) iframeNode._attrs = attrs
	if (src) iframeNode._src = src

	trySerializeIframeInner(iframeNode, root, depth, maxDepth, maxChildren)

	const key = `iframe:nth-of-type(${computeIframeIndex(root)})`
	return { [key]: iframeNode }
}

// ── Tree Building ─────────────────────────────────────────────────────────

function mergeChildIntoTree(
	childTree: Record<string, unknown>,
	child: Element,
	depth: number,
	maxDepth?: number,
	maxChildren?: number,
): void {
	const key = getNodeKey(child)
	const subTree = serializeDomToTree(child, depth + 1, maxDepth, maxChildren)
	if (Object.keys(subTree).length > 0) {
		const subTreeKeys = Object.keys(subTree)
		if (subTreeKeys.length === 1 && subTreeKeys[0] !== key) {
			childTree[key] = subTree
		} else {
			childTree[key] = subTree[key] ?? subTree
		}
	}
}

function buildChildTree(
	root: Element,
	depth: number,
	maxDepth?: number,
	maxChildren?: number,
): { childTree: Record<string, unknown>; visibleChildren: Element[] } {
	const childTree: Record<string, unknown> = {}
	const children = Array.from(root.children)
	let visibleChildren = children.filter(
		(c) => !["script", "style", "noscript", "link", "meta"].includes(c.tagName.toLowerCase()),
	)

	if (maxChildren !== undefined && visibleChildren.length > maxChildren) {
		visibleChildren = visibleChildren.slice(0, maxChildren)
	}

	for (const child of visibleChildren) {
		mergeChildIntoTree(childTree, child, depth, maxDepth, maxChildren)
	}

	return { childTree, visibleChildren }
}

function finalizeSerialization(
	key: string,
	childTree: Record<string, unknown>,
	attrs: Record<string, string>,
	text: string,
	root: Element,
	visibleChildren: Element[],
): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	result[key] = childTree

	const resultEntry = result[key] as Record<string, unknown>
	if (Object.keys(attrs).length > 0) {
		resultEntry._attrs = attrs
	}
	const hasOwnText = Array.from(root.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
	if (text && (hasOwnText || visibleChildren.length === 0)) {
		resultEntry._text = text
	}

	return result
}

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
	if (["script", "style", "noscript", "link", "meta"].includes(tag)) return {}

	if (maxDepth !== undefined && depth >= maxDepth) {
		return serializeMaxDepthNode(root, depth, maxDepth, maxChildren)
	}

	if (tag === "svg" || tag === "path" || tag === "canvas") {
		return serializeLeafElement(root)
	}

	if (tag === "iframe") {
		return serializeIframeElement(root, depth, maxDepth, maxChildren)
	}

	const text = getNodeText(root)
	const attrs = getRelevantAttributes(root)
	const { childTree, visibleChildren } = buildChildTree(root, depth, maxDepth, maxChildren)
	const key = getNodeKey(root)

	return finalizeSerialization(key, childTree, attrs, text, root, visibleChildren)
}
