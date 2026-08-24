import { ReactNode } from "react"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import type { ElementContent } from "hast"
import { Fragment, jsx, jsxs } from "react/jsx-runtime"
import type { Highlighter } from "shiki"
import { getHighlighter, escapeHtml } from "./highlighter-engine"
export { getHighlighter }

export function highlightFzfMatch(
	text: string,
	positions: number[],
	highlightClassName: string = "history-item-highlight",
) {
	if (!positions.length) return text
	const parts: { text: string; highlight: boolean }[] = []
	let lastIndex = 0
	positions.sort((a, b) => a - b)
	positions.forEach((pos) => {
		if (pos > lastIndex) parts.push({ text: text.substring(lastIndex, pos), highlight: false })
		parts.push({ text: text[pos], highlight: true })
		lastIndex = pos + 1
	})
	if (lastIndex < text.length) parts.push({ text: text.substring(lastIndex), highlight: false })
	return parts
		.map((part) => {
			const escapedText = escapeHtml(part.text)
			return part.highlight ? `<span class="${highlightClassName}">${escapedText}</span>` : escapedText
		})
		.join("")
}

function extractCodeChildren(hast: unknown): ElementContent[] | null {
	type HastElement = { tagName?: string; properties?: { className?: string[] }; children?: ElementContent[] }
	const root = hast as { children?: HastElement[] }
	if (!root.children || root.children.length === 0) return null
	const preEl = root.children[0]
	if (!preEl.children || preEl.children.length === 0) return null
	const codeEl = preEl.children[0] as HastElement | undefined
	return codeEl?.children ?? null
}

function convertToReactNode(rawNode: ElementContent): ReactNode | null {
	const lineNode = rawNode as { tagName?: string; properties?: { className?: string[] }; children?: ElementContent[] }
	if (lineNode.tagName !== "span") return null
	const classNames = lineNode.properties?.className
	if (!classNames || !classNames.includes("line")) return null
	return toJsxRuntime(
		{ type: "element", tagName: "span", properties: {}, children: lineNode.children ?? [] },
		{ Fragment, jsx, jsxs },
	)
}

function getHighlightedLines(
	highlighter: Highlighter,
	text: string,
	lang: string,
	shikiTheme: "github-light" | "github-dark",
): ReactNode[] | null {
	const hast = highlighter.codeToHast(text, {
		lang,
		theme: shikiTheme,
		transformers: [
			{
				pre(node: { properties: Record<string, unknown> }) {
					node.properties.style = "padding:0;margin:0;background:none;"
				},
				code(node: { properties: Record<string, unknown> }) {
					node.properties.class = `hljs language-${lang}`
				},
				line(node: { properties: Record<string, unknown> }, line: number) {
					node.properties["data-line"] = line
				},
			},
		],
	})
	const codeChildren = extractCodeChildren(hast)
	if (!codeChildren) return null
	const highlightedLines: ReactNode[] = []
	for (const rawNode of codeChildren) {
		const reactNode = convertToReactNode(rawNode)
		if (reactNode) highlightedLines.push(reactNode)
	}
	return highlightedLines
}

function highlightSingleLineFallback(
	highlighter: Highlighter,
	line: string,
	lang: string,
	shikiTheme: "github-light" | "github-dark",
): ReactNode {
	if (!line.trim()) return line
	try {
		const lineHast = highlighter.codeToHast(line, {
			lang,
			theme: shikiTheme,
			transformers: [
				{
					pre(node: { properties: Record<string, unknown> }) {
						node.properties.style = "padding:0;margin:0;background:none;"
					},
					code(node: { properties: Record<string, unknown> }) {
						node.properties.class = `hljs language-${lang}`
					},
				},
			],
		})
		const lineCodeEl = (
			lineHast as {
				children: Array<{
					children?: Array<{
						tagName?: string
						properties?: { className?: string[] }
						children?: ElementContent[]
					}>
				}>
			}
		)?.children?.[0]?.children?.[0]
		if (!lineCodeEl || !lineCodeEl.children) return line
		return toJsxRuntime(
			{ type: "element", tagName: "span", properties: {}, children: lineCodeEl.children },
			{ Fragment, jsx, jsxs },
		)
	} catch {
		return line
	}
}

export async function highlightHunks(
	oldText: string,
	newText: string,
	lang: string,
	theme: "light" | "dark",
	_hunkIndex = 0,
	_filePath?: string,
): Promise<{ oldLines: ReactNode[]; newLines: ReactNode[] }> {
	try {
		const highlighter = await getHighlighter(lang)
		const shikiTheme = theme === "light" ? "github-light" : "github-dark"
		const highlightAndExtractLines = (text: string): ReactNode[] => {
			const textLines = text.split("\n")
			if (!text.trim()) return textLines.map((line) => line || "")
			try {
				const highlightedLines = getHighlightedLines(highlighter, text, lang, shikiTheme)
				if (highlightedLines !== null && highlightedLines.length === textLines.length) return highlightedLines
				return textLines.map((line) => highlightSingleLineFallback(highlighter, line, lang, shikiTheme))
			} catch {
				return textLines.map((line) => line || "")
			}
		}
		return { oldLines: highlightAndExtractLines(oldText), newLines: highlightAndExtractLines(newText) }
	} catch {
		return {
			oldLines: oldText.split("\n").map((line) => line || ""),
			newLines: newText.split("\n").map((line) => line || ""),
		}
	}
}
