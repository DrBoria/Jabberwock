import * as path from "path"
import { virtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import { readWithSlice } from "@integrations/misc/indentation-reader"
import { DEFAULT_LINE_LIMIT } from "@features/settings/context/tools/native-tools/r/read_file"
import type { ExtractTextResult } from "./types"
import { SUPPORTED_BINARY_FORMATS, addLineNumbers, stripLineNumbers } from "./helpers"

/**
 * Extracts text from a binary file (PDF, DOCX, IPYNB, XLSX) by format.
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
	const ext = path.extname(filePath).toLowerCase()
	const extractor = SUPPORTED_BINARY_FORMATS[ext]
	if (!extractor) {
		throw new Error(`Unsupported binary format: ${ext}`)
	}
	return extractor(filePath)
}

/**
 * Extracts text from a file (plain text or binary) with metadata.
 *
 * For plain text files, reads using slice parameters and returns content
 * with line numbers. For binary files, delegates to the format-specific extractor.
 */
export async function extractTextFromFileWithMetadata(
	filePath: string,
	options?: { offset?: number; limit?: number },
): Promise<ExtractTextResult> {
	const ext = path.extname(filePath).toLowerCase()
	const isBinary = ext in SUPPORTED_BINARY_FORMATS

	if (isBinary) {
		const extractor = SUPPORTED_BINARY_FORMATS[ext]
		const content = await extractor(filePath)
		const lines = content.split("\n")
		return {
			content,
			totalLines: lines.length,
			returnedLines: lines.length,
			wasTruncated: false,
		}
	}

	const offset = options?.offset ?? 1
	const limit = options?.limit ?? DEFAULT_LINE_LIMIT

	const rawContent = await virtualWorkspace.readFile(filePath)
	const stripped = stripLineNumbers(rawContent)
	const sliced = readWithSlice(stripped, offset, limit)

	return {
		content: addLineNumbers(sliced.content, offset),
		totalLines: sliced.totalLines,
		returnedLines: sliced.returnedLines,
		wasTruncated: sliced.wasTruncated,
		linesShown: [offset, offset + sliced.returnedLines - 1],
	}
}
