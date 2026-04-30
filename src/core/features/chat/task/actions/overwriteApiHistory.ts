import crypto from "crypto"
import { type ClineMessage } from "@jabberwock/types"
import { type ApiMessage } from "../../../../task-persistence"
import { Task } from "../../../../task/Task"
import { NativeToolCallParser } from "../../../../assistant-message/NativeToolCallParser"

/**
 * Overwrites the API conversation history and syncs UI messages.
 * Used by condenseContext and context management to rewrite conversation state.
 */
export async function overwriteApiConversationHistory(task: Task, newHistory: ApiMessage[], syncToUi = true) {
	task.apiConversationHistory = newHistory

	// Clear pending tool results/content to avoid merging old state into next turn
	task.userMessageContent = []
	task.assistantMessageContent = []

	if (!syncToUi) {
		console.log("[Task#overwriteApiConversationHistory] Skipping UI sync as requested.")
		return
	}

	// Sync UI messages (clineMessages) to avoid duplication and React key collisions
	task.clineMessages = newHistory.map((msg) => {
		const ts = msg.ts || task.generateUniqueTs()
		const role = msg.role
		const type = role === "assistant" ? "say" : "say" // Defaults to say for rewrite

		let text = ""
		if (typeof msg.content === "string") {
			text = msg.content
		} else if (Array.isArray(msg.content)) {
			text = msg.content
				.map((block: any) => {
					if (block.type === "text") return block.text
					if (block.type === "tool_use") return `[Tool Use: ${block.name}]`
					return ""
				})
				.join("\n")
		}

		return {
			ts,
			type,
			say: type === "say" ? "text" : undefined,
			text: text.trim(),
			role,
		} as ClineMessage
	})

	// Clear pending tool results/content to avoid merging old state into next turn
	task.userMessageContent = []
	task.assistantMessageContent = []
	task.currentStreamingContentIndex = 0
	task.presentAssistantMessageLocked = false
	task.presentAssistantMessageHasPendingUpdates = false
	task.streamingToolCallIndices.clear()
	NativeToolCallParser.clearAllStreamingToolCalls()

	const providerInstance = task.providerRef.deref()
	if (providerInstance && providerInstance.chatStore) {
		const node = providerInstance.chatStore.nodes.get(task.taskId)
		if (node) {
			const mstMessages = newHistory.map((msg, idx) => ({
				id: msg.id || crypto.randomUUID(),
				role: msg.role,
				content: msg,
				ts: msg.ts || task.clineMessages[idx].ts,
			}))
			node.replaceMessages(mstMessages)
			// Also sync UI messages to MST
			node.syncUiMessages(structuredClone(task.clineMessages))
		}
	}

	// Signal to the main loop (recursivelyMakeClineRequests) that the context has
	// shifted and the current turn must be aborted.
	task.turnResetPending = true

	await task.saveApiConversationHistory()
	await task.saveClineMessages()
}
