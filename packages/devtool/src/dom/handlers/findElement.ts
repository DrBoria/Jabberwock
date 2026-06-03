/**
 * findElement action handler — the most complex DOM handler.
 *
 * Resolves a CSS selector (or "*" for full page), serializes the matched
 * DOM subtree, optionally executes a JS command on the found element,
 * and queries cross-origin iframes via postMessage for their content.
 */
import type { DomHandlerContext, DomIframeResponse } from "../types.js"
import { serializeDomToTree } from "../serialization.js"
import { findAllElementsBySelector } from "../lookup.js"

export async function handleFindElement(ctx: DomHandlerContext, req: Record<string, unknown>): Promise<void> {
	const { postMessage, queryIframe, resolveSelectorInIframe } = ctx
	const requestId = req.requestId as string
	const selector = req.selector as string

	try {
		// Resolve depth/maxChildren defaults
		const domDepth = (req.depth as number | undefined) ?? (selector === "*" ? 10 : 3)
		const domMaxChildren = (req.maxChildren as number | undefined) ?? 10

		// Check if selector targets an iframe (e.g., "iframe[src*='...'] button")
		if (selector !== "*") {
			const iframeTarget = await resolveSelectorInIframe(selector)
			if (iframeTarget) {
				try {
					const iframeQuery: Record<string, unknown> = {
						type: "dom-query",
						command: "querySelector",
						selector: iframeTarget.innerSelector,
						depth: domDepth,
						maxChildren: domMaxChildren,
					}
					if (req.command) {
						iframeQuery.userCommand = req.command
					}
					const result = (await queryIframe(iframeTarget.iframe, iframeQuery)) as DomIframeResponse
					let output = ""
					if (result?.html) {
						const parser = new DOMParser()
						const parsedDoc = parser.parseFromString(result.html, "text/html")
						if (parsedDoc.body) {
							const iframeTree = serializeDomToTree(parsedDoc.body, 0, domDepth, domMaxChildren)
							output = JSON.stringify(iframeTree, null, 2)
						}
					}
					// Append command result from iframe if present
					if (result?.commandResult !== undefined) {
						output += `\n\nCommand result:\n${result.commandResult}`
					} else if (result?.commandError !== undefined) {
						output += `\n\nCommand error:\n${result.commandError}`
					}
					if (output) {
						postMessage({ type: "domResponse", requestId, text: output })
						return
					}
				} catch {
					// fall through to main document
				}
			}
		}

		// Find element(s) in the main document
		// For "*" selector, use root/body (single element).
		// For specific selectors, use querySelectorAll to return ALL matching elements.
		const elements =
			selector === "*"
				? (() => {
						const root = document.getElementById("root") || document.body
						return root ? [root] : []
					})()
				: findAllElementsBySelector(selector)

		if (elements.length === 0) {
			postMessage({ type: "domResponse", requestId, text: `Element not found: ${selector}` })
			return
		}

		// Serialize all matched elements
		let output = ""
		for (let idx = 0; idx < elements.length; idx++) {
			const el = elements[idx]!

			// ── Iframe element found without inner selector — forward query to iframe content ──
			// When the selector targets an iframe directly (e.g., "iframe[src*='3005']") without
			// a space-separated inner selector, resolveSelectorInIframe returned null above.
			// We detect this case and forward the query (serialize + command) to the iframe content.
			if (el instanceof HTMLIFrameElement && el.src) {
				try {
					const iframeQuery: Record<string, unknown> = {
						type: "dom-query",
						command: "querySelector",
						selector: "*",
						depth: domDepth,
						maxChildren: domMaxChildren,
					}
					if (req.command) {
						iframeQuery.userCommand = req.command
					}
					const result = (await queryIframe(el, iframeQuery)) as DomIframeResponse
					let iframeOutput = ""
					if (result?.html) {
						const parser = new DOMParser()
						const parsedDoc = parser.parseFromString(result.html, "text/html")
						if (parsedDoc.body) {
							const iframeTree = serializeDomToTree(parsedDoc.body, 0, domDepth, domMaxChildren)
							iframeOutput = JSON.stringify(iframeTree, null, 2)
						}
					}
					if (result?.commandResult !== undefined) {
						iframeOutput += `\n\nCommand result:\n${result.commandResult}`
					} else if (result?.commandError !== undefined) {
						iframeOutput += `\n\nCommand error:\n${result.commandError}`
					}
					if (elements.length > 1) {
						output += `[${idx}] ${iframeOutput || `iframe content empty (${el.src})`}\n\n`
					} else {
						output = iframeOutput || `iframe content empty (${el.src})`
					}
					continue
				} catch (_iframeErr) {
					// Fall through to normal serialization if iframe query fails
				}
			}

			// Serialize the DOM subtree
			const tree = serializeDomToTree(el, 0, domDepth, domMaxChildren)
			let elOutput = JSON.stringify(tree, null, 2)

			// Execute command if provided (use $0 to reference the found element)
			if (req.command) {
				try {
					const fn = new Function("$0", `return (${req.command})`)
					const commandResult = fn(el)
					const resultStr =
						commandResult === undefined
							? "undefined"
							: commandResult === null
								? "null"
								: commandResult === ""
									? '"" (empty string)'
									: commandResult instanceof Element
										? `<${commandResult.tagName.toLowerCase()}>`
										: commandResult instanceof NodeList || commandResult instanceof HTMLCollection
											? `[${Array.from(commandResult)
													.map((el2, i) => {
														const tag = (el2 as Element).tagName?.toLowerCase() || "?"
														return `${i}: <${tag}>${(el2 as Element).id ? `#${(el2 as Element).id}` : ""}`
													})
													.join(", ")}] (${commandResult.length} elements)`
											: typeof commandResult === "object"
												? JSON.stringify(commandResult, null, 2)
												: String(commandResult)
					elOutput += `\n\nCommand result:\n${resultStr}`
				} catch (cmdErr) {
					elOutput += `\n\nCommand error: ${cmdErr instanceof Error ? cmdErr.message : String(cmdErr)}`
				}
			}

			if (elements.length > 1) {
				output += `[${idx}] ${elOutput}\n\n`
			} else {
				output = elOutput
			}
		}

		// ── Resolve cross-origin iframes via postMessage ──────────────
		// Cross-origin iframes can't be read from the parent webview's JavaScript.
		// Instead, we send a postMessage to the iframe's contentWindow requesting
		// its serialized DOM. The iframe content must handle "dom-query" messages.
		try {
			const iframes = document.querySelectorAll<HTMLIFrameElement>("iframe[src]")
			for (const iframe of Array.from(iframes)) {
				const src = iframe.getAttribute("src") || ""
				if (!src.startsWith("http://") && !src.startsWith("https://")) continue

				let isCrossOrigin = true
				try {
					const doc = iframe.contentDocument
					if (doc?.body) isCrossOrigin = false
				} catch {
					isCrossOrigin = true
				}

				if (isCrossOrigin) {
					try {
						const result = (await queryIframe(iframe, {
							type: "dom-query",
							command: "serialize",
							depth: domDepth,
							maxChildren: domMaxChildren,
						})) as DomIframeResponse
						if (result && typeof result === "object" && "html" in result) {
							const html = result.html as string
							if (html) {
								const parser = new DOMParser()
								const parsedDoc = parser.parseFromString(html, "text/html")
								if (parsedDoc.body) {
									const iframeTree = serializeDomToTree(parsedDoc.body, 0, domDepth, domMaxChildren)
									if (Object.keys(iframeTree).length > 0) {
										output += `\n\n=== Iframe content (${src}) ===\n${JSON.stringify(iframeTree, null, 2)}`
									}
								}
							}
						}
					} catch (fetchErr) {
						output += `\n\n=== Iframe content (${src}) ===\nError: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`
					}
				}
			}
		} catch {
			// Ignore iframe query errors
		}

		postMessage({ type: "domResponse", requestId, text: output })
	} catch (err) {
		postMessage({
			type: "domResponse",
			requestId,
			text: `Error finding element: ${err instanceof Error ? err.message : String(err)}`,
		})
	}
}
