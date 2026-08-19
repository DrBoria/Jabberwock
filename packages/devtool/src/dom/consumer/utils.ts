/**
 * Shared utilities for the DOM consumer — respond helper, element resolution,
 * and command result serialization.
 */

export function respond(event: MessageEvent, payload: Record<string, unknown>): void {
	try {
		event.source?.postMessage(
			{ type: "dom-response", requestId: (event.data as Record<string, unknown>).requestId, ...payload },
			{ targetOrigin: "*" } as WindowPostMessageOptions,
		)
	} catch {
		// Ignore postMessage errors
	}
}

export function resolveElement(req: Record<string, unknown>): Element | null {
	const selector = req.selector as string | undefined
	if (!selector) {
		return null
	}
	const el = document.querySelector(selector)
	if (!el) {
		return null
	}
	return el
}

export function serializeCommandResult(cmdResult: unknown): string {
	if (cmdResult === undefined) return "undefined"
	if (cmdResult === null) return "null"
	if (cmdResult === "") return '"" (empty string)'
	if (cmdResult instanceof Element) return `<${cmdResult.tagName.toLowerCase()}>`
	if (cmdResult instanceof NodeList || cmdResult instanceof HTMLCollection) {
		const items = Array.from(cmdResult)
			.map((el2, i) => {
				const tag = (el2 as Element).tagName?.toLowerCase() || "?"
				return `${i}: <${tag}>${(el2 as Element).id ? `#${(el2 as Element).id}` : ""}`
			})
			.join(", ")
		return `[${items}] (${cmdResult.length} elements)`
	}
	if (typeof cmdResult === "object") return JSON.stringify(cmdResult, null, 2)
	return String(cmdResult)
}

export function executeUserCommandOnElement(
	element: Element,
	userCommand: string,
): { commandResult?: string; commandError?: string } {
	try {
		const fn = new Function("$0", `return (${userCommand})`)
		const cmdResult = fn(element)
		return { commandResult: serializeCommandResult(cmdResult) }
	} catch (cmdErr) {
		return { commandError: cmdErr instanceof Error ? cmdErr.message : String(cmdErr) }
	}
}
