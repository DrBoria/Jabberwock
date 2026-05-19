import { LRUCache } from "lru-cache"
import { ReactNode } from "react"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import type { ElementContent } from "hast"
import { Fragment, jsx, jsxs } from "react/jsx-runtime"
import {
	createHighlighter,
	type Highlighter,
	type BundledTheme,
	type BundledLanguage,
	bundledLanguages,
	bundledThemes,
} from "shiki"

// Extend BundledLanguage to include 'txt' because Shiki supports this but it is
// not listed in the bundled languages
export type ExtendedLanguage = BundledLanguage | "txt"

// Map common language aliases to their Shiki BundledLanguage equivalent
const languageAliases: Record<string, ExtendedLanguage> = {
	// Plain text variants
	text: "txt",
	plaintext: "txt",
	plain: "txt",

	// Shell/Bash variants
	sh: "shell",
	bash: "shell",
	zsh: "shell",
	shellscript: "shell",
	"shell-script": "shell",
	console: "shell",
	terminal: "shell",

	// JavaScript variants
	js: "javascript",
	node: "javascript",
	nodejs: "javascript",

	// TypeScript variants
	ts: "typescript",

	// Python variants
	py: "python",
	python3: "python",
	py3: "python",

	// Ruby variants
	rb: "ruby",

	// Markdown variants
	md: "markdown",

	// C++ variants
	cpp: "c++",
	cc: "c++",

	// C# variants
	cs: "c#",
	csharp: "c#",

	// HTML variants
	htm: "html",

	// YAML variants
	yml: "yaml",

	// Docker variants
	dockerfile: "docker",

	// CSS variants
	styles: "css",
	style: "css",

	// JSON variants
	jsonc: "json",
	json5: "json",

	// XML variants
	xaml: "xml",
	xhtml: "xml",
	svg: "xml",

	// SQL variants
	mysql: "sql",
	postgresql: "sql",
	postgres: "sql",
	pgsql: "sql",
	plsql: "sql",
	oracle: "sql",
}

// Track which languages we've warned about to avoid duplicate warnings
const warnedLanguages = new Set<string>()

// Normalize language to a valid Shiki language
export function normalizeLanguage(language: string | undefined): ExtendedLanguage {
	if (language === undefined) {
		return "txt"
	}

	// Convert to lowercase for consistent matching
	const normalizedInput = language.toLowerCase()

	// If it's already a valid bundled language, return it
	if (normalizedInput in bundledLanguages) {
		return normalizedInput as BundledLanguage
	}

	// Check if it's an alias
	if (normalizedInput in languageAliases) {
		return languageAliases[normalizedInput]
	}

	// Warn about unrecognized language and default to txt (only once per language)
	if (language !== "txt" && !warnedLanguages.has(language)) {
		console.warn(`[Shiki] Unrecognized language '${language}', defaulting to txt.`)
		warnedLanguages.add(language)
	}

	return "txt"
}

// Export function to check if a language is loaded
export const isLanguageLoaded = (language: string): boolean => {
	return state.loadedLanguages.has(normalizeLanguage(language))
}

// Artificial delay for testing language loading (ms) - for testing
const LANGUAGE_LOAD_DELAY = 0

// Common languages for first-stage initialization
const initialLanguages: BundledLanguage[] = ["shell", "log"]

// Singleton state
const state: {
	instance: Highlighter | null
	instanceInitPromise: Promise<Highlighter> | null
	loadedLanguages: Set<ExtendedLanguage>
	pendingLanguageLoads: Map<ExtendedLanguage, Promise<void>>
} = {
	instance: null,
	instanceInitPromise: null,
	loadedLanguages: new Set<ExtendedLanguage>(["txt"]),
	pendingLanguageLoads: new Map(),
}

export const getHighlighter = async (language?: string): Promise<Highlighter> => {
	try {
		const shikilang = normalizeLanguage(language)

		// Initialize highlighter if needed
		if (!state.instanceInitPromise) {
			state.instanceInitPromise = (async () => {
				const instance = await createHighlighter({
					themes: Object.keys(bundledThemes) as BundledTheme[],
					langs: initialLanguages,
				})

				state.instance = instance

				// Track initially loaded languages
				initialLanguages.forEach((lang) => state.loadedLanguages.add(lang))

				return instance
			})()
		}

		// Wait for initialization to complete
		const instance = await state.instanceInitPromise

		// Load requested language if needed (txt is already in loadedLanguages)
		if (!state.loadedLanguages.has(shikilang)) {
			// Check for existing pending load
			let loadingPromise = state.pendingLanguageLoads.get(shikilang)

			if (!loadingPromise) {
				// Create new loading promise
				loadingPromise = (async () => {
					try {
						// Add artificial delay for testing if nonzero
						if (LANGUAGE_LOAD_DELAY > 0) {
							await new Promise((resolve) => setTimeout(resolve, LANGUAGE_LOAD_DELAY))
						}

						await instance.loadLanguage(shikilang as BundledLanguage)
						state.loadedLanguages.add(shikilang)
					} catch (error) {
						console.error(`[Shiki] Failed to load language ${shikilang}:`, error)
						throw error
					} finally {
						// Clean up pending promise after completion
						state.pendingLanguageLoads.delete(shikilang)
					}
				})()

				// Store the promise
				state.pendingLanguageLoads.set(shikilang, loadingPromise)
			}

			await loadingPromise
		}

		return instance
	} catch (error) {
		console.error("[Shiki] Error in getHighlighter:", error)
		throw error
	}
}

// ============================================================
// Merged from highlight.ts
// ============================================================

// LRU cache for escapeHtml with reasonable size limit
const escapeHtmlCache = new LRUCache<string, string>({ max: 500 })

function escapeHtml(text: string): string {
	// Check cache first
	const cached = escapeHtmlCache.get(text)
	if (cached !== undefined) {
		return cached
	}

	// Compute escaped text
	const escaped = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")

	// Cache the result
	escapeHtmlCache.set(text, escaped)

	return escaped
}

export function highlightFzfMatch(
	text: string,
	positions: number[],
	highlightClassName: string = "history-item-highlight",
) {
	if (!positions.length) return text

	const parts: { text: string; highlight: boolean }[] = []
	let lastIndex = 0

	// Sort positions to ensure we process them in order
	positions.sort((a, b) => a - b)

	positions.forEach((pos) => {
		// Add non-highlighted text before this position
		if (pos > lastIndex) {
			parts.push({
				text: text.substring(lastIndex, pos),
				highlight: false,
			})
		}

		// Add highlighted character
		parts.push({
			text: text[pos],
			highlight: true,
		})

		lastIndex = pos + 1
	})

	// Add any remaining text
	if (lastIndex < text.length) {
		parts.push({
			text: text.substring(lastIndex),
			highlight: false,
		})
	}

	// Build final string
	return parts
		.map((part) => {
			const escapedText = escapeHtml(part.text)
			return part.highlight ? `<span class="${highlightClassName}">${escapedText}</span>` : escapedText
		})
		.join("")
}

// ============================================================
// Merged from highlightDiff.ts
// ============================================================

/**
 * Highlight two pieces of code (old and new) in a single pass and return
 * arrays of ReactNode representing each line
 */
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

		// Helper to highlight text and extract lines
		const highlightAndExtractLines = (text: string): ReactNode[] => {
			const textLines = text.split("\n")

			if (!text.trim()) {
				return textLines.map((line) => line || "")
			}

			try {
				// Use Shiki's line transformer to get per-line highlighting
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
								// Add a line marker to help with extraction
								node.properties["data-line"] = line
							},
						},
					],
				})

				// Extract the <code> element's children (which should be line elements)
				const codeEl = (
					hast as {
						children: Array<{
							children?: Array<{
								tagName?: string
								properties?: { className?: string[] }
								children?: ElementContent[]
							}>
						}>
					}
				)?.children?.[0]?.children?.[0]
				if (!codeEl || !codeEl.children) {
					return textLines.map((line) => line || "")
				}

				// Convert each line element to a ReactNode
				const highlightedLines: ReactNode[] = []

				for (const rawNode of codeEl.children) {
					const lineNode = rawNode as {
						tagName?: string
						properties?: { className?: string[] }
						children?: ElementContent[]
					}
					if (lineNode.tagName === "span" && lineNode.properties?.className?.includes("line")) {
						// This is a line span from Shiki
						const reactNode = toJsxRuntime(
							{ type: "element", tagName: "span", properties: {}, children: lineNode.children || [] },
							{ Fragment, jsx, jsxs },
						)
						highlightedLines.push(reactNode)
					}
				}

				// If we didn't get the expected structure, fall back to simple approach
				if (highlightedLines.length !== textLines.length) {
					// For each line, highlight it individually (fallback)
					return textLines.map((line) => {
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
							if (!lineCodeEl || !lineCodeEl.children) {
								return line
							}

							return toJsxRuntime(
								{ type: "element", tagName: "span", properties: {}, children: lineCodeEl.children },
								{ Fragment, jsx, jsxs },
							)
						} catch {
							return line
						}
					})
				}

				return highlightedLines
			} catch {
				return textLines.map((line) => line || "")
			}
		}

		// Process both old and new text
		const oldLines = highlightAndExtractLines(oldText)
		const newLines = highlightAndExtractLines(newText)

		return { oldLines, newLines }
	} catch {
		// Fallback to plain text on any error
		return {
			oldLines: oldText.split("\n").map((line) => line || ""),
			newLines: newText.split("\n").map((line) => line || ""),
		}
	}
}
