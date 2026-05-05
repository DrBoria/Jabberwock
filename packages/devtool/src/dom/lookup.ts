/**
 * DOM element lookup helpers — query the webview's document for elements
 * by ID (with data-testid fallback) or by CSS selector.
 */

/**
 * Find an element by ID with a multi-strategy fallback:
 * 1. Try data-testid lookup (the id param could be a data-testid value)
 * 2. Try CSS selector (for cases like '[data-testid="foo"]' passed as id)
 * 3. Fallback to DOM getElementById
 */
export function findElementById(id: string): Element | null {
	// 1. Try data-testid lookup (the id param could be a data-testid value)
	const el = document.querySelector(`[data-testid="${CSS.escape(id)}"]`)
	if (el) return el
	// 2. Try CSS selector (for cases like '[data-testid="foo"]' passed as id)
	try {
		const bySelector = document.querySelector(id)
		if (bySelector) return bySelector
	} catch {
		// not a valid CSS selector, continue
	}
	// 3. Fallback to DOM id
	return document.getElementById(id)
}

/**
 * Find an element by CSS selector. Returns null on invalid selector
 * (instead of throwing) for graceful fallback chains.
 */
export function findElementBySelector(selector: string): Element | null {
	try {
		return document.querySelector(selector)
	} catch {
		return null
	}
}
