import { createHash } from "crypto"
import { CodeBlock } from "@services/code-index/interfaces"
import { MAX_BLOCK_CHARS, MAX_CHARS_TOLERANCE_FACTOR, MIN_BLOCK_CHARS } from "@services/code-index/constants"
import { parseMarkdown } from "@services/tree-sitter/markdownParser"
import { chunkTextByLines } from "./text-chunker"

export function processMarkdownSection(
	lines: string[],
	filePath: string,
	fileHash: string,
	type: string,
	seenSegmentHashes: Set<string>,
	startLine: number,
	identifier: string | null = null,
): CodeBlock[] {
	const content = lines.join("\n")

	const hasSufficientContent = content.trim().length >= MIN_BLOCK_CHARS
	if (!hasSufficientContent) {
		return []
	}

	const needsChunking =
		content.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR ||
		lines.some((line) => line.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR)

	if (needsChunking) {
		const chunks = chunkTextByLines(lines, filePath, fileHash, type, seenSegmentHashes, startLine)
		if (identifier) {
			chunks.forEach((chunk) => {
				chunk.identifier = identifier
			})
		}
		return chunks
	}

	const endLine = startLine + lines.length - 1
	const contentPreview = content.slice(0, 100)
	const segmentHash = createHash("sha256")
		.update(`${filePath}-${startLine}-${endLine}-${content.length}-${contentPreview}`)
		.digest("hex")

	if (!seenSegmentHashes.has(segmentHash)) {
		seenSegmentHashes.add(segmentHash)
		return [
			{
				file_path: filePath,
				identifier,
				type,
				start_line: startLine,
				end_line: endLine,
				content,
				segmentHash,
				fileHash,
			},
		]
	}

	return []
}

export function parseMarkdownContent(
	filePath: string,
	content: string,
	fileHash: string,
	seenSegmentHashes: Set<string>,
): CodeBlock[] {
	const lines = content.split("\n")
	const markdownCaptures = parseMarkdown(content) || []

	if (markdownCaptures.length === 0) {
		return processMarkdownSection(lines, filePath, fileHash, "markdown_content", seenSegmentHashes, 1)
	}

	const results: CodeBlock[] = []
	let lastProcessedLine = 0

	if (markdownCaptures.length > 0) {
		const firstHeaderLine = markdownCaptures[0].node.startPosition.row
		if (firstHeaderLine > 0) {
			const preHeaderLines = lines.slice(0, firstHeaderLine)
			const preHeaderBlocks = processMarkdownSection(
				preHeaderLines,
				filePath,
				fileHash,
				"markdown_content",
				seenSegmentHashes,
				1,
			)
			results.push(...preHeaderBlocks)
		}
	}

	for (let i = 0; i < markdownCaptures.length; i += 2) {
		const nameCapture = markdownCaptures[i]
		if (i + 1 >= markdownCaptures.length) break
		const definitionCapture = markdownCaptures[i + 1]

		if (!definitionCapture) continue

		const startLine = definitionCapture.node.startPosition.row + 1
		const endLine = definitionCapture.node.endPosition.row + 1
		const sectionLines = lines.slice(startLine - 1, endLine)

		const headerMatch = nameCapture.name.match(/\.h(\d)$/)
		const headerLevel = headerMatch ? parseInt(headerMatch[1]) : 1
		const headerText = nameCapture.node.text

		const sectionBlocks = processMarkdownSection(
			sectionLines,
			filePath,
			fileHash,
			`markdown_header_h${headerLevel}`,
			seenSegmentHashes,
			startLine,
			headerText,
		)
		results.push(...sectionBlocks)

		lastProcessedLine = endLine
	}

	if (lastProcessedLine < lines.length) {
		const remainingLines = lines.slice(lastProcessedLine)
		const remainingBlocks = processMarkdownSection(
			remainingLines,
			filePath,
			fileHash,
			"markdown_content",
			seenSegmentHashes,
			lastProcessedLine + 1,
		)
		results.push(...remainingBlocks)
	}

	return results
}
