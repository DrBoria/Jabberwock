/**
 * Iframe query and cross-origin helpers for findElement.
 */
import type { DomIframeResponse } from "../../types.js"
import { serializeDomToTree } from "../../serialization/serialization.js"

export async function queryIframeAndSerialize(
	iframe: HTMLIFrameElement,
	innerSelector: string,
	depth: number,
	maxChildren: number,
	command?: string,
): Promise<string> {
	const iframeQuery: Record<string, unknown> = {
		type: "dom-query",
		command: "querySelector",
		selector: innerSelector,
		depth,
		maxChildren,
	}
	if (command) {
		iframeQuery.userCommand = command
	}
	const result = await queryIframeInternal(iframe, iframeQuery)
	return formatIframeResult(result)
}

async function queryIframeInternal(
	iframe: HTMLIFrameElement,
	query: Record<string, unknown>,
): Promise<DomIframeResponse | null> {
	try {
		return await queryIframeDynamic(iframe, query)
	} catch {
		return null
	}
}

async function queryIframeDynamic(
	iframe: HTMLIFrameElement,
	query: Record<string, unknown>,
): Promise<DomIframeResponse> {
	return iframe.contentWindow
		? await new Promise<DomIframeResponse>((resolve) => {
				const channel = new MessageChannel()
				channel.port1.onmessage = (e: MessageEvent) => resolve(e.data as DomIframeResponse)
				iframe.contentWindow!.postMessage(query, "*", [channel.port2])
				setTimeout(() => resolve({} as DomIframeResponse), 5000)
			})
		: ({} as DomIframeResponse)
}

function serializeHtmlToTree(html: string, depth: number, maxChildren: number): string {
	if (!html) return ""
	const parser = new DOMParser()
	const parsedDoc = parser.parseFromString(html, "text/html")
	if (!parsedDoc.body) return ""
	const iframeTree = serializeDomToTree(parsedDoc.body, 0, depth, maxChildren)
	return JSON.stringify(iframeTree, null, 2)
}

function formatIframeResult(result: DomIframeResponse | null): string {
	if (!result) return ""
	let output = ""
	if (result.html) {
		output = serializeHtmlToTree(result.html, 0, 0)
	}
	if (result.commandResult !== undefined) {
		output += `\n\nCommand result:\n${result.commandResult}`
	} else if (result.commandError !== undefined) {
		output += `\n\nCommand error:\n${result.commandError}`
	}
	return output
}

export async function handleDirectIframeSelector(
	selector: string,
	depth: number,
	maxChildren: number,
	command: string | undefined,
): Promise<string | null> {
	const iframeTarget = await resolveSelectorInIframeStatic(selector)
	if (!iframeTarget) return null

	const output = await queryIframeAndSerialize(
		iframeTarget.iframe,
		iframeTarget.innerSelector,
		depth,
		maxChildren,
		command,
	)
	return output || null
}

async function resolveSelectorInIframeStatic(
	_selector: string,
): Promise<{ iframe: HTMLIFrameElement; innerSelector: string } | null> {
	return null
}

export function processIframeElement(
	el: Element,
	idx: number,
	totalElements: number,
	depth: number,
	maxChildren: number,
	command: string | undefined,
): Promise<string | null> {
	if (!(el instanceof HTMLIFrameElement) || !el.src) return Promise.resolve(null)

	return queryIframeAndSerialize(el, "*", depth, maxChildren, command).then((iframeOutput) => {
		if (totalElements > 1) {
			return `[${idx}] ${iframeOutput || `iframe content empty (${el.src})`}\n\n`
		}
		return iframeOutput || `iframe content empty (${el.src})`
	})
}

async function fetchCrossOriginContent(iframe: HTMLIFrameElement, src: string): Promise<string> {
	try {
		const result = await queryIframeDynamic(iframe, { type: "dom-query", command: "serialize" })
		if (result?.html) {
			const serialized = serializeHtmlToTree(result.html, 0, 0)
			if (serialized) {
				return `\n\n=== Iframe content (${src}) ===\n${serialized}`
			}
		}
	} catch (fetchErr) {
		return `\n\n=== Iframe content (${src}) ===\nError: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`
	}
	return ""
}

function isCrossOriginUrl(src: string): boolean {
	return src.startsWith("http://") || src.startsWith("https://")
}

export async function processCrossOriginIframes(): Promise<string> {
	let extraOutput = ""
	const iframes = document.querySelectorAll<HTMLIFrameElement>("iframe[src]")
	for (const iframe of Array.from(iframes)) {
		const src = iframe.getAttribute("src") || ""
		if (!isCrossOriginUrl(src)) continue

		let isCrossOrigin = true
		try {
			const doc = iframe.contentDocument
			if (doc?.body) isCrossOrigin = false
		} catch {
			isCrossOrigin = true
		}

		if (isCrossOrigin) {
			extraOutput += await fetchCrossOriginContent(iframe, src)
		}
	}
	return extraOutput
}
