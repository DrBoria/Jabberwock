import type { ReasoningDetail, GroupMetadata } from "@api/transform/openai-format-types"

function isCorruptedEncryptedBlock(detail: ReasoningDetail): boolean {
	return detail.type === "reasoning.encrypted" && !detail.data
}

function groupDetailsByIndex(details: ReasoningDetail[]): Map<number, ReasoningDetail[]> {
	const groupedByIndex = new Map<number, ReasoningDetail[]>()

	for (const detail of details) {
		if (isCorruptedEncryptedBlock(detail)) {
			continue
		}

		const index = detail.index ?? 0
		if (!groupedByIndex.has(index)) {
			groupedByIndex.set(index, [])
		}
		groupedByIndex.get(index)!.push(detail)
	}

	return groupedByIndex
}

function accumulateGroupMetadata(details: ReasoningDetail[]): GroupMetadata {
	let concatenatedText = ""
	let concatenatedSummary = ""
	let signature: string | undefined
	let id: string | undefined
	let format = "unknown"
	let type = "reasoning.text"

	for (const detail of details) {
		if (detail.text) {
			concatenatedText += detail.text
		}
		if (detail.summary) {
			concatenatedSummary += detail.summary
		}
		if (detail.signature) {
			signature = detail.signature
		}
		if (detail.id) {
			id = detail.id
		}
		if (detail.format) {
			format = detail.format
		}
		if (detail.type) {
			type = detail.type
		}
	}

	return { text: concatenatedText, summary: concatenatedSummary, signature, id, format, type }
}

function findLastDataEntry(details: ReasoningDetail[], groupIndex: number): ReasoningDetail | undefined {
	let lastDataEntry: ReasoningDetail | undefined

	for (const detail of details) {
		if (detail.data) {
			lastDataEntry = {
				type: detail.type,
				data: detail.data,
				signature: detail.signature ?? undefined,
				id: detail.id ?? undefined,
				format: detail.format,
				index: groupIndex,
			}
		}
	}

	return lastDataEntry
}

/**
 * Consolidates reasoning_details by grouping by index and type.
 * - Filters out corrupted encrypted blocks (missing `data` field)
 * - For text blocks: concatenates text, keeps last signature/id/format
 * - For encrypted blocks: keeps only the last one per index
 *
 * @param reasoningDetails - Array of reasoning detail objects
 * @returns Consolidated array of reasoning details
 * @see https://github.com/cline/cline/issues/8214
 */
export function consolidateReasoningDetails(reasoningDetails: ReasoningDetail[]): ReasoningDetail[] {
	if (!reasoningDetails || reasoningDetails.length === 0) {
		return []
	}

	const groupedByIndex = groupDetailsByIndex(reasoningDetails)
	const consolidated: ReasoningDetail[] = []

	for (const [index, details] of groupedByIndex.entries()) {
		const metadata = accumulateGroupMetadata(details)

		if (metadata.text) {
			consolidated.push({
				type: metadata.type,
				text: metadata.text,
				signature: metadata.signature,
				id: metadata.id,
				format: metadata.format,
				index,
			})
		}

		if (metadata.summary && !metadata.text) {
			consolidated.push({
				type: metadata.type,
				summary: metadata.summary,
				signature: metadata.signature,
				id: metadata.id,
				format: metadata.format,
				index,
			})
		}

		const dataEntry = findLastDataEntry(details, index)
		if (dataEntry) {
			consolidated.push(dataEntry)
		}
	}

	return consolidated
}
