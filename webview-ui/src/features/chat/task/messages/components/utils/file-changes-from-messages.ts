import type { Notification, SayToolData } from "@jabberwock/types"
import { safeJsonParse } from "@jabberwock/core/browser"

/** File-edit tool names from SayToolData["tool"] (packages/types). */
const FILE_EDIT_TOOLS = new Set<string>(["editedExistingFile", "appliedDiff", "newFileCreated"])

export interface FileChangeEntry {
	path: string
	diff: string
	diffStats?: { added: number; removed: number }
	/** Original file content before first edit (for merged diff display) */
	originalContent?: string
}

/** Extracts a file-edit tool payload from a message, or undefined if not applicable. */
function getToolFromMessage(msg: Notification): SayToolData | undefined {
	const toolType = msg.type
	if (toolType !== "say" && toolType !== "ask") return undefined

	const isToolEdit = toolType === "say" ? msg.say === "tool" : msg.ask === "tool" && msg.isAnswered
	if (!isToolEdit) return undefined
	if (!msg.text || msg.partial) return undefined

	const tool = safeJsonParse<SayToolData>(msg.text)
	if (!tool) return undefined
	if (!FILE_EDIT_TOOLS.has(tool.tool)) return undefined

	return tool
}

/** Pushes batch-diff entries from a tool payload into the accumulator. */
function pushBatchDiffEntries(tool: SayToolData, entries: FileChangeEntry[]): void {
	const { batchDiffs } = tool
	if (!batchDiffs || !Array.isArray(batchDiffs)) return

	for (const file of batchDiffs) {
		if (!file.path) continue

		const content =
			file.content ?? file.diffs?.map((d: { content: string; startLine?: number }) => d.content).join("\n") ?? ""

		if (content) {
			entries.push({
				path: file.path,
				diff: content,
				diffStats: file.diffStats,
			})
		}
	}
}

/** Pushes a single-file diff entry from a tool payload into the accumulator. */
function pushSingleFileEntry(tool: SayToolData, entries: FileChangeEntry[]): void {
	if (!tool.path) return

	const diff = tool.diff ?? tool.content ?? ""
	if (diff) {
		entries.push({
			path: tool.path,
			diff,
			diffStats: tool.diffStats,
			originalContent: tool.originalContent,
		})
	}
}

export function fileChangesFromMessages(messages: Notification[] | undefined): FileChangeEntry[] {
	if (!messages?.length) return []

	const entries: FileChangeEntry[] = []

	for (const msg of messages) {
		const tool = getToolFromMessage(msg)
		if (!tool) continue

		if (tool.batchDiffs && Array.isArray(tool.batchDiffs)) {
			pushBatchDiffEntries(tool, entries)
			continue
		}

		pushSingleFileEntry(tool, entries)
	}

	return entries
}
