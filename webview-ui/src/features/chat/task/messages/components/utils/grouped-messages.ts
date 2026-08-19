import type { Notification, SayToolData } from "@jabberwock/types"
import { batchConsecutive } from "@/features/settings/agents/mode-selector/utils/batchConsecutive"

/**
 * Type guard: checks if a message is a "tool" ask for a specific tool type.
 */
function isToolAsk(msg: Notification, toolName: string): boolean {
	if (msg.type !== "ask" || msg.ask !== "tool") return false
	try {
		const tool = JSON.parse(msg.text || "{}") as SayToolData
		return tool.tool === toolName
	} catch {
		return false
	}
}

/**
 * Type guard: checks if a message is a "readFile" tool ask.
 */
const isReadFileAsk = (msg: Notification): boolean => isToolAsk(msg, "readFile")

/**
 * Type guard: checks if a message is a file-listing tool ask.
 */
const isListFilesAsk = (msg: Notification): boolean =>
	isToolAsk(msg, "listFilesTopLevel") || isToolAsk(msg, "listFilesRecursive")

/**
 * Type guard: checks if a message is an edit-file tool ask.
 */
const isEditFileAsk = (msg: Notification): boolean =>
	isToolAsk(msg, "editedExistingFile") || isToolAsk(msg, "appliedDiff") || isToolAsk(msg, "newFileCreated")

/**
 * Synthesizer: merges a batch of readFile asks into a single message with batchFiles.
 */
function synthesizeReadFileBatch(batch: Notification[]): Notification {
	const batchFiles = batch
		.map((batchMsg) => {
			try {
				return (JSON.parse(batchMsg.text || "{}") as SayToolData).batchFiles || []
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
function synthesizeListFilesBatch(batch: Notification[]): Notification {
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
function synthesizeEditFileBatch(batch: Notification[]): Notification {
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
	guard: (msg: Notification) => boolean
	synthesize: (batch: Notification[]) => Notification
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
export function computeGroupedMessages(visibleMessages: Notification[], isCondensing: boolean): Notification[] {
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
		} as Notification)
	}

	return result
}
