import { useEffect, useRef, useState } from "react"
import { getHighlighter, isLanguageLoaded } from "@src/utils/text/highlighter-engine"
import type { ShikiTransformer } from "shiki"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import { Fragment, jsx, jsxs } from "react/jsx-runtime"

export const useCodeHighlight = (
	source: string | undefined,
	currentLanguage: string,
): {
	highlightedCode: React.ReactNode
	buttonPositionTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>
	collapseTimeout1Ref: React.MutableRefObject<NodeJS.Timeout | null>
	collapseTimeout2Ref: React.MutableRefObject<NodeJS.Timeout | null>
} => {
	const [highlightedCode, setHighlightedCode] = useState<React.ReactNode>(null)
	const isMountedRef = useRef(true),
		buttonPositionTimeoutRef = useRef<NodeJS.Timeout | null>(null),
		collapseTimeout1Ref = useRef<NodeJS.Timeout | null>(null),
		collapseTimeout2Ref = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		isMountedRef.current = true
		const fallback = (
			<pre style={{ padding: 0, margin: 0 }}>
				<code className={`hljs language-${currentLanguage || "txt"}`}>{source || ""}</code>
			</pre>
		)
		const setSafe = (n: React.ReactNode) => {
			if (isMountedRef.current) setHighlightedCode(n)
		}
		const highlight = async () => {
			if (currentLanguage && !isLanguageLoaded(currentLanguage)) setSafe(fallback)
			const h = await getHighlighter(currentLanguage)
			if (!isMountedRef.current) return
			const hast = await h.codeToHast(source || "", {
				lang: currentLanguage || "txt",
				theme: document.body.className.toLowerCase().includes("light") ? "github-light" : "github-dark",
				transformers: [
					{
						pre(node: import("hast").Element) {
							node.properties.style = "padding:0;margin:0"
							return node
						},
						code(node: import("hast").Element) {
							node.properties.class = `hljs language-${currentLanguage}`
							return node
						},
						line(node: import("hast").Element) {
							node.properties.class = node.properties.class || ""
							return node
						},
					} satisfies Partial<ShikiTransformer>,
				],
			})
			if (!isMountedRef.current) return
			try {
				setSafe(toJsxRuntime(hast, { Fragment, jsx, jsxs }))
			} catch (e) {
				console.error("[jabberwock] [CodeBlock] Error converting HAST to JSX:", e)
				setSafe(fallback)
			}
		}
		highlight().catch((e) => {
			console.error("[jabberwock] [CodeBlock] Syntax highlighting error:", e, "\nStack trace:", e.stack)
			if (isMountedRef.current) setHighlightedCode(fallback)
		})
		return () => {
			isMountedRef.current = false
		}
	}, [source, currentLanguage])

	return {
		highlightedCode,
		buttonPositionTimeoutRef,
		collapseTimeout1Ref,
		collapseTimeout2Ref,
	}
}
