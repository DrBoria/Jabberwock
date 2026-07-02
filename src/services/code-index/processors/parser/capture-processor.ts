import { createHash } from "crypto"
import { Node } from "web-tree-sitter"
import { CodeBlock } from "@services/code-index/interfaces"
import { MAX_BLOCK_CHARS, MAX_CHARS_TOLERANCE_FACTOR, MIN_BLOCK_CHARS } from "@services/code-index/constants"
import { chunkTextByLines } from "./text-chunker"

function createBlockFromNode(
	currentNode: Node,
	filePath: string,
	fileHash: string,
	seenSegmentHashes: Set<string>,
): CodeBlock | null {
	const identifier =
		currentNode.childForFieldName("name")?.text ||
		currentNode.children.find((c) => c?.type === "identifier")?.text ||
		null
	const type = currentNode.type
	const start_line = currentNode.startPosition.row + 1
	const end_line = currentNode.endPosition.row + 1
	const content = currentNode.text
	const contentPreview = content.slice(0, 100)
	const segmentHash = createHash("sha256")
		.update(`${filePath}-${start_line}-${end_line}-${content.length}-${contentPreview}`)
		.digest("hex")

	if (seenSegmentHashes.has(segmentHash)) {
		return null
	}

	seenSegmentHashes.add(segmentHash)
	return {
		file_path: filePath,
		identifier,
		type,
		start_line,
		end_line,
		content,
		segmentHash,
		fileHash,
	}
}

function chunkLeafNodeByLines(
	node: Node,
	filePath: string,
	fileHash: string,
	seenSegmentHashes: Set<string>,
): CodeBlock[] {
	const lines = node.text.split("\n")
	const baseStartLine = node.startPosition.row + 1
	return chunkTextByLines(lines, filePath, fileHash, node.type, seenSegmentHashes, baseStartLine)
}

export function processCaptureNodes(
	captures: { node: Node; name: string }[],
	filePath: string,
	fileHash: string,
	seenSegmentHashes: Set<string>,
): CodeBlock[] {
	const results: CodeBlock[] = []
	const queue: Node[] = Array.from(captures).map((capture) => capture.node)

	while (queue.length > 0) {
		const currentNode = queue.shift()!

		const meetsMinChars = currentNode.text.length >= MIN_BLOCK_CHARS
		if (!meetsMinChars) {
			continue
		}

		const exceedsMaxChars = currentNode.text.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR
		if (exceedsMaxChars) {
			const hasChildren = currentNode.children.filter((child) => child !== null).length > 0
			if (hasChildren) {
				queue.push(...currentNode.children.filter((child) => child !== null))
			} else {
				const chunkedBlocks = chunkLeafNodeByLines(currentNode, filePath, fileHash, seenSegmentHashes)
				results.push(...chunkedBlocks)
			}
		} else {
			const block = createBlockFromNode(currentNode, filePath, fileHash, seenSegmentHashes)
			if (block) {
				results.push(block)
			}
		}
	}

	return results
}
