import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	CHAT_TEXT_AREA_ENHANCE_PROMPT,
	CHAT_TEXT_AREA_SELECT_IMAGES,
	CHAT_TEXT_AREA_SEARCH_FILES,
	CHAT_TEXT_AREA_DRAGGED_IMAGES,
	CHAT_TOPIC_MODE,
	CHAT_TOPIC_SWITCH_MODE,
	CHAT_TOPIC_REQUEST_COMMANDS,
	CHAT_TOPIC_UPDATE_TODO_LIST,
} from "@features/chat"

/**
 * Register all chat-level event handlers on the given IntentBus.
 *
 * Chat-level handlers are organized under chat/task/, chat/task/messages/,
 * and chat/task/notifications/ — this function additionally registers
 * webview message → intent routing for chat-level events.
 */

function registerOnChatCHATTEXTAREAENHANCEPROMPT(): void {
	onWebviewMessage(CHAT_TEXT_AREA_ENHANCE_PROMPT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "textarea.enhance.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnChatCHATTEXTAREASELECTIMAGES(): void {
	onWebviewMessage(CHAT_TEXT_AREA_SELECT_IMAGES, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "textarea.images.select.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnChatCHATTEXTAREASEARCHFILES(): void {
	onWebviewMessage(CHAT_TEXT_AREA_SEARCH_FILES, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "textarea.files.search.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnChatCHATTEXTAREADRAGGEDIMAGES(): void {
	onWebviewMessage(CHAT_TEXT_AREA_DRAGGED_IMAGES, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "textarea.images.dragged",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnChatCHATTOPICMODE(): void {
	onWebviewMessage(CHAT_TOPIC_MODE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "topic.mode.switch.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnChatCHATTOPICSWITCHMODE(): void {
	onWebviewMessage(CHAT_TOPIC_SWITCH_MODE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "topic.mode.switch.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnChatCHATTOPICREQUESTCOMMANDS(): void {
	onWebviewMessage(CHAT_TOPIC_REQUEST_COMMANDS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "topic.commands.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnChatCHATTOPICUPDATETODOLIST(): void {
	onWebviewMessage(CHAT_TOPIC_UPDATE_TODO_LIST, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "topic.todolist.update",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerOnChatIntents(_bus: IntentBus): void {
	registerOnChatCHATTEXTAREAENHANCEPROMPT()
	registerOnChatCHATTEXTAREASELECTIMAGES()
	registerOnChatCHATTEXTAREASEARCHFILES()
	registerOnChatCHATTEXTAREADRAGGEDIMAGES()
	registerOnChatCHATTOPICMODE()
	registerOnChatCHATTOPICSWITCHMODE()
	registerOnChatCHATTOPICREQUESTCOMMANDS()
	registerOnChatCHATTOPICUPDATETODOLIST()
}
