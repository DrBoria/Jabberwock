/**
 * findElement action handler — the most complex DOM handler.
 *
 * Resolves a CSS selector (or "*" for full page), serializes the matched
 * DOM subtree, optionally executes a JS command on the found element,
 * and queries cross-origin iframes via postMessage for their content.
 */
import type { DomHandlerContext } from "../../types.js"
import { serializeDomToTree } from "../../serialization/serialization.js"
import { findAllElementsBySelector } from "../../lookup.js"
import { handleDirectIframeSelector, processIframeElement, processCrossOriginIframes } from "./findElement-iframe.js"

function getDefaultDepth(selector: string): number {
	return selector === "*" ? 10 : 3
}

function getRootElements(selector: string): Element[] {
	if (selector === "*") {
		const root = document.getElementById("root") || document.body
		return root ? [root] : []
	}
	return findAllElementsBySelector(selector)
}

function serializeCommandResultForFind(commandResult: unknown): string {
	if (commandResult === undefined) return "undefined"
	if (commandResult === null) return "null"
	if (commandResult === "") return '"" (empty string)'
	if (commandResult instanceof Element) return `<${commandResult.tagName.toLowerCase()}>`
	if (commandResult instanceof NodeList || commandResult instanceof HTMLCollection) {
		const items = Array.from(commandResult)
			.map((el2, i) => {
				const tag = (el2 as Element).tagName?.toLowerCase() || "?"
				return `${i}: <${tag}>${(el2 as Element).id ? `#${(el2 as Element).id}` : ""}`
			})
			.join(", ")
		return `[${items}] (${commandResult.length} elements)`
	}
	if (typeof commandResult === "object") return JSON.stringify(commandResult, null, 2)
	return String(commandResult)
}

function executeJsCommandOnElement(el: Element, command: string): string {
	try {
		const fn = new Function("$0", `return (${command})`)
		const commandResult = fn(el)
		return `\n\nCommand result:\n${serializeCommandResultForFind(commandResult)}`
	} catch (cmdErr) {
		return `\n\nCommand error: ${cmdErr instanceof Error ? cmdErr.message : String(cmdErr)}`
	}
}

function serializeElementWithCommand(el: Element, command: string | undefined): string {
	const tree = serializeDomToTree(el, 0, 0, 0)
	let elOutput = JSON.stringify(tree, null, 2)
	if (command) {
		elOutput += executeJsCommandOnElement(el, command)
	}
	return elOutput
}

async function serializeElementList(
	elements: Element[],
	command: string | undefined,
	domDepth: number,
	domMaxChildren: number,
): Promise<string> {
	let output = ""
	for (let idx = 0; idx < elements.length; idx++) {
		const el = elements[idx]!

		if (el instanceof HTMLIFrameElement && el.src) {
			const iframeResult = await processIframeElement(el, idx, elements.length, domDepth, domMaxChildren, command)
			if (iframeResult) {
				output += iframeResult
				continue
			}
		}

		const elOutput = serializeElementWithCommand(el, command)
		if (elements.length > 1) {
			output += `[${idx}] ${elOutput}\n\n`
		} else {
			output = elOutput
		}
	}
	return output
}

export async function handleFindElement(ctx: DomHandlerContext, req: Record<string, unknown>): Promise<void> {
	const { postMessage } = ctx
	const requestId = req.requestId as string
	const selector = req.selector as string

	try {
		const domDepth = (req.depth as number | undefined) ?? getDefaultDepth(selector)
		const domMaxChildren = (req.maxChildren as number | undefined) ?? 10

		if (selector !== "*") {
			const iframeOutput = await handleDirectIframeSelector(
				selector,
				domDepth,
				domMaxChildren,
				req.command as string | undefined,
			)
			if (iframeOutput) {
				postMessage({ type: "domResponse", requestId, text: iframeOutput })
				return
			}
		}

		const elements = getRootElements(selector)
		if (elements.length === 0) {
			postMessage({ type: "domResponse", requestId, text: `Element not found: ${selector}` })
			return
		}

		const output = await serializeElementList(elements, req.command as string | undefined, domDepth, domMaxChildren)
		const crossOriginContent = await processCrossOriginIframes()

		postMessage({ type: "domResponse", requestId, text: output + crossOriginContent })
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error finding element: ${err instanceof Error ? err.message : String(err)}`,
		})
	}
}
