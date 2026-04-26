import type { ClineMessage, ClineSayTool } from "@jabberwock/types"
import { batchConsecutive } from "@src/utils/batchConsecutive"

/**
 * Type guard: checks if a message is a "tool" ask for a specific tool type.
 */
function isToolAsk(msg: ClineMessage, toolName: string): boolean {
	if (msg.type !== "ask" || msg.ask !== "tool") return false
	try {
		const tool = JSON.parse(msg.text || "{}") as ClineSayTool
		return tool.tool === toolName
	} catch {
		return false
	}
}

/**
 * Type guard: checks if a message is a "readFile" tool ask.
 */
const isReadFileAsk = (msg: ClineMessage): boolean => isToolAsk(msg, "readFile")

/**
 * Type guard: checks if a message is a file-listing tool ask.
 */
const isListFilesAsk = (msg: ClineMessage): boolean =>
	isToolAsk(msg, "listFilesTopLevel") || isToolAsk(msg, "listFilesRecursive")

/**
 * Type guard: checks if a message is an edit-file tool ask.
 */
const isEditFileAsk = (msg: ClineMessage): boolean =>
	isToolAsk(msg, "editedExistingFile") || isToolAsk(msg, "appliedDiff") || isToolAsk(msg, "newFileCreated")

/**
 * Synthesizer: merges a batch of readFile asks into a single message with batchFiles.
 */
function synthesizeReadFileBatch(batch: ClineMessage[]): ClineMessage {
	const batchFiles = batch
		.map((batchMsg) => {
			try {
				return (JSON.parse(batchMsg.text || "{}") as ClineSayTool).batchFiles || []
			} catch {
				return []
			}
		})
		.flat()
	const firstTool = JSON.parse(batch[0].text || "{}")
	return { ...batch[0], text: JSON.stringify({ ...firstTool, batchFiles }) }
}

/**
 * Synthesizer: merges a batch of listFiles asks into a single message with batchDirs.
 */
function synthesizeListFilesBatch(batch: ClineMessage[]): ClineMessage {
	const batchDirs = batch.map((batchMsg) => {
		try {
			const tool = JSON.parse(batchMsg.text || "{}")
			return {
				path: tool.path || "",
				recursive: tool.tool === "listFilesRecursive",
				isOutsideWorkspace: tool.isOutsideWorkspace || false,
				key: tool.path || "",
			}
		} catch {
			return { path: "", recursive: false, key: "" }
		}
	})
	let firstTool
	try {
		firstTool = JSON.parse(batch[0].text || "{}")
	} catch {
		return batch[0]
	}
	return { ...batch[0], text: JSON.stringify({ ...firstTool, batchDirs }) }
}

/**
 * Synthesizer: merges a batch of edit-file asks into a single message with batchDiffs.
 */
function synthesizeEditFileBatch(batch: ClineMessage[]): ClineMessage {
	const batchDiffs = batch.map((batchMsg) => {
		try {
			const tool = JSON.parse(batchMsg.text || "{}")
			return {
				path: tool.path || "",
				changeCount: 1,
				key: tool.path || "",
				content: tool.content || tool.diff || "",
				diffStats: tool.diffStats,
			}
		} catch {
			return { path: "", changeCount: 0, key: "", content: "" }
		}
	})
	let firstTool
	try {
		firstTool = JSON.parse(batch[0].text || "{}")
	} catch {
		return batch[0]
	}
	return { ...batch[0], text: JSON.stringify({ ...firstTool, batchDiffs }) }
}

/**
 * Map of batchable message types to their type guard and synthesizer.
 * This replaces the chain of if/switch statements with a declarative pipeline.
 */
interface BatchRule {
	guard: (msg: ClineMessage) => boolean
	synthesize: (batch: ClineMessage[]) => ClineMessage
}

const batchRules: BatchRule[] = [
	{ guard: isReadFileAsk, synthesize: synthesizeReadFileBatch },
	{ guard: isListFilesAsk, synthesize: synthesizeListFilesBatch },
	{ guard: isEditFileAsk, synthesize: synthesizeEditFileBatch },
]

/**
 * Computes grouped messages by applying batch rules in sequence.
 * Each rule batches consecutive matching messages and synthesizes them.
 *
 * @param visibleMessages - Pre-filtered visible messages
 * @param isCondensing - Whether context condensation is in progress
 * @returns Grouped messages with consecutive tool asks batched together
 */
export function computeGroupedMessages(visibleMessages: ClineMessage[], isCondensing: boolean): ClineMessage[] {
	let result = visibleMessages

	// Apply each batch rule in sequence
	for (const rule of batchRules) {
		result = batchConsecutive(result, rule.guard, rule.synthesize)
	}

	// Append condensing indicator if needed
	if (isCondensing) {
		result.push({
			type: "say",
			say: "condense_context",
			ts: Date.now(),
			partial: true,
		} as ClineMessage)
	}

	return result
}
