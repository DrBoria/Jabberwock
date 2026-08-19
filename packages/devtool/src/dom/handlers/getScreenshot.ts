/**
 * getScreenshot action handler — captures the webview DOM as a base64 PNG
 * using the SVG foreignObject approach with inlined CSS styles.
 */
import type { DomHandlerContext } from "../types.js"

/**
 * Walk a cloned DOM tree and inline every element's computed style
 * so that external stylesheets are preserved in the screenshot.
 */
function inlineStyles(root: HTMLElement): void {
	const elements = root.querySelectorAll<HTMLElement>("*")
	// Also include the root itself
	const all = [root, ...Array.from(elements)]

	for (const el of all) {
		const computed = window.getComputedStyle(el)
		// Build a style attribute from a dozen essential layout / font / color properties.
		// We avoid huge or redundant properties (like `-webkit-*` vendor bloat) and focus
		// on the visual properties that matter most in a webview screenshot.
		const importantProps = [
			"display",
			"position",
			"visibility",
			"opacity",
			"overflow",
			"zIndex",
			"flexDirection",
			"flexWrap",
			"alignItems",
			"alignContent",
			"justifyContent",
			"gap",
			"gridTemplateColumns",
			"gridTemplateRows",
			"width",
			"height",
			"minWidth",
			"minHeight",
			"maxWidth",
			"maxHeight",
			"margin",
			"marginTop",
			"marginRight",
			"marginBottom",
			"marginLeft",
			"padding",
			"paddingTop",
			"paddingRight",
			"paddingBottom",
			"paddingLeft",
			"top",
			"right",
			"bottom",
			"left",
			"transform",
			"border",
			"borderTop",
			"borderRight",
			"borderBottom",
			"borderLeft",
			"borderRadius",
			"boxShadow",
			"backgroundColor",
			"color",
			"fontFamily",
			"fontSize",
			"fontWeight",
			"fontStyle",
			"lineHeight",
			"textAlign",
			"textDecoration",
			"textOverflow",
			"whiteSpace",
			"wordBreak",
			"cursor",
			"outline",
			"background",
			"backgroundImage",
			"backgroundSize",
			"backgroundPosition",
			"backgroundRepeat",
			"backgroundClip",
			"fill",
			"stroke",
		]
		const styleParts: string[] = []
		for (const prop of importantProps) {
			const val = computed.getPropertyValue(prop)
			// Only inline non-default / non-inherited values to keep the payload small
			if (val && val !== "none" && val !== "normal" && val !== "0px" && val !== "auto") {
				styleParts.push(`${prop}:${val}`)
			}
		}
		// Always set box-sizing to prevent layout shifts in the foreignObject
		const boxSizing = computed.getPropertyValue("boxSizing")
		if (boxSizing) styleParts.push(`box-sizing:${boxSizing}`)

		if (styleParts.length > 0) {
			el.setAttribute("style", styleParts.join(";"))
		}
	}
}

/**
 * Recursively inline styles then render a deep clone of the document to a canvas.
 */
async function captureScreenshot(): Promise<string> {
	const root = document.getElementById("root") || document.body
	if (!root) {
		throw new Error("No root element found")
	}

	// Deep clone so we don't mutate the live DOM
	const clone = root.cloneNode(true) as HTMLElement
	// Remove scripts from the clone
	clone.querySelectorAll("script").forEach((s) => s.remove())
	// Inline all computed styles
	inlineStyles(clone)

	// Serialise the cloned DOM to an XML string suitable for foreignObject
	const serialised = new XMLSerializer().serializeToString(clone)

	const width = window.innerWidth
	const height = window.innerHeight

	// Build SVG with foreignObject
	const svg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
			`<foreignObject x="0" y="0" width="100%" height="100%">` +
			`<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:inherit">` +
			serialised +
			`</div>` +
			`</foreignObject>` +
			`</svg>`,
	)}`

	// Load SVG as image, draw to canvas, return base64
	const img = await new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image()
		image.onload = () => resolve(image)
		image.onerror = (err) => reject(new Error(`Failed to load SVG image: ${err}`))
		image.src = svg
	})

	const canvas = document.createElement("canvas")
	canvas.width = width
	canvas.height = height
	const ctx2d = canvas.getContext("2d")
	if (!ctx2d) {
		throw new Error("Could not get 2D canvas context")
	}
	ctx2d.drawImage(img, 0, 0)
	return canvas.toDataURL("image/png")
}

export function handleGetScreenshot(ctx: DomHandlerContext, req: Record<string, unknown>): void {
	const { postMessage } = ctx
	const requestId = req.requestId as string

	captureScreenshot()
		.then((dataUrl) => {
			postMessage({ type: "domResponse", requestId, text: dataUrl })
		})
		.catch((err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err)
			postMessage({ type: "domResponse", requestId, text: `Screenshot error: ${msg}` })
		})
}
