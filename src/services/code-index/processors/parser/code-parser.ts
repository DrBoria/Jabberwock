import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import { LanguageParser, loadRequiredLanguageParsers } from "@services/tree-sitter/languageParser"
import { ICodeParser, CodeBlock } from "@services/code-index/interfaces"
import { scannerExtensions, fallbackExtensions } from "@services/code-index/shared/supported-extensions"
import { MIN_BLOCK_CHARS } from "@services/code-index/constants"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"
import { sanitizeErrorMessage } from "@services/code-index/shared/sanitizeInput"
import { chunkTextByLines } from "./text-chunker"
import { processCaptureNodes } from "./capture-processor"
import { parseMarkdownContent } from "./markdown-processor"

/**
 * Implementation of the code parser interface
 */
export class CodeParser implements ICodeParser {
	private loadedParsers: LanguageParser = {}
	private pendingLoads: Map<string, Promise<LanguageParser>> = new Map()

	/**
	 * Parses a code file into code blocks
	 * @param filePath Path to the file to parse
	 * @param options Optional parsing options
	 * @returns Promise resolving to array of code blocks
	 */
	async parseFile(
		filePath: string,
		options?: {
			content?: string
			fileHash?: string
		},
	): Promise<CodeBlock[]> {
		const ext = path.extname(filePath).toLowerCase()

		if (!this.isSupportedLanguage(ext)) {
			return []
		}

		let content: string
		let fileHash: string

		if (options?.content) {
			content = options.content
			fileHash = options.fileHash || this.createFileHash(content)
		} else {
			try {
				content = await readFile(filePath, "utf8")
				fileHash = this.createFileHash(content)
			} catch (error) {
				console.error(`[jabberwock] Error reading file ${filePath}:`, error)
				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
					stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
					location: "parseFile",
				})
				return []
			}
		}

		return this.parseContent(filePath, content, fileHash)
	}

	private isSupportedLanguage(extension: string): boolean {
		return scannerExtensions.includes(extension)
	}

	private createFileHash(content: string): string {
		return createHash("sha256").update(content).digest("hex")
	}

	private async parseContent(filePath: string, content: string, fileHash: string): Promise<CodeBlock[]> {
		const ext = path.extname(filePath).slice(1).toLowerCase()
		const seenSegmentHashes = new Set<string>()

		const isMarkdown = ext === "md" || ext === "markdown"
		if (isMarkdown) {
			return parseMarkdownContent(filePath, content, fileHash, seenSegmentHashes)
		}

		const needsFallback = (fallbackExtensions as readonly string[]).includes(`.${ext}`)
		if (needsFallback) {
			const lines = content.split("\n")
			return chunkTextByLines(lines, filePath, fileHash, "fallback_chunk", seenSegmentHashes)
		}

		const language = await this._ensureParserLoaded(ext, filePath)
		if (!language) {
			console.warn(`[jabberwock] No parser available for file extension: ${ext}`)
			return []
		}

		const tree = language.parser.parse(content)
		const captures = tree ? language.query.captures(tree.rootNode) : []

		if (captures.length === 0) {
			const hasSufficientContent = content.length >= MIN_BLOCK_CHARS
			if (!hasSufficientContent) {
				return []
			}
			const lines = content.split("\n")
			return chunkTextByLines(lines, filePath, fileHash, "fallback_chunk", seenSegmentHashes)
		}

		return processCaptureNodes(captures, filePath, fileHash, seenSegmentHashes)
	}

	private async _ensureParserLoaded(ext: string, filePath: string): Promise<LanguageParser[string] | undefined> {
		if (this.loadedParsers[ext]) {
			return this.loadedParsers[ext]
		}

		const pendingLoad = this.pendingLoads.get(ext)
		if (pendingLoad) {
			try {
				await pendingLoad
			} catch (error) {
				this._handleParserLoadError(error, filePath)
				return undefined
			}
		} else {
			const loadPromise = loadRequiredLanguageParsers([filePath])
			this.pendingLoads.set(ext, loadPromise)
			try {
				const newParsers = await loadPromise
				if (newParsers) {
					this.loadedParsers = { ...this.loadedParsers, ...newParsers }
				}
			} catch (error) {
				this._handleParserLoadError(error, filePath)
				return undefined
			} finally {
				this.pendingLoads.delete(ext)
			}
		}

		return this.loadedParsers[ext]
	}

	private _handleParserLoadError(error: unknown, filePath: string): void {
		console.error(`[jabberwock] Error loading language parser for ${filePath}:`, error)
		getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
			error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
			stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
			location: "parseContent:loadParser",
		})
	}
}

export const codeParser = new CodeParser()
