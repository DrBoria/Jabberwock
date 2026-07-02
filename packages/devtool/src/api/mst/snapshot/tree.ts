import { isPlainObject } from "./truncate.js"

/**
 * Recursively discover nested store structure up to a max depth.
 * Returns a map of path → { type, sub? } for the guide tree.
 */
function addObjectTreeEntry(
	tree: Record<string, { type: string; sub?: string[] }>,
	key: string,
	path: string,
	value: Record<string, unknown>,
	depth: number,
	maxDepth: number,
): void {
	tree[path] = { type: "object" }
	if (depth >= maxDepth) {
		return
	}
	const childKeys = Object.keys(value)
	if (childKeys.length === 0) {
		return
	}
	tree[path].sub = childKeys
	const deeper = discoverStoreTree(value, path, depth + 1, maxDepth)
	Object.assign(tree, deeper)
}

export function discoverStoreTree(
	obj: Record<string, unknown>,
	prefix = "",
	depth = 0,
	maxDepth = 3,
): Record<string, { type: string; sub?: string[] }> {
	const tree: Record<string, { type: string; sub?: string[] }> = {}

	for (const [key, value] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${key}` : key
		if (isPlainObject(value)) {
			addObjectTreeEntry(tree, key, path, value, depth, maxDepth)
		} else if (Array.isArray(value)) {
			tree[path] = { type: `array[${value.length}]` }
		} else {
			tree[path] = { type: typeof value }
		}
	}

	return tree
}

export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".")
	let current: unknown = obj
	for (const part of parts) {
		if (current === null || current === undefined || typeof current !== "object") {
			return undefined
		}
		current = (current as Record<string, unknown>)[part]
	}
	return current
}

export function resolveNestedPath(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".")
	let current: unknown = obj
	for (const part of parts) {
		if (current === null || current === undefined || typeof current !== "object") {
			return undefined
		}
		current = (current as Record<string, unknown>)[part]
	}
	return current
}
