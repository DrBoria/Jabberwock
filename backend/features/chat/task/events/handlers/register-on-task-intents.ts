import { IntentBus, IntentPriority } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import { dispatchTaskResumeIntent, dispatchSendMessageToAgent } from "@features/api"
import { registerAllTaskHandlers } from "@features/chat/task/handlers"
import { registerOnGoalAdd } from "@features/chat"
import { registerOnGoalRemove } from "@features/chat"
import { registerOnGoalUpdate } from "@features/chat"
import { registerOnGoalReorder } from "@features/chat"
import {
	CHAT_TASK_NEW_TASK,
	CHAT_TASK_CANCEL_TASK,
	CHAT_TASK_RESUME,
	CHAT_TASK_SEND_MESSAGE,
	CHAT_TASK_CLEAR_TASK,
	CHAT_TASK_TASK_SYNC_ENABLED,
	CHAT_TASK_CONDENSE_TASK_CONTEXT_REQUEST,
	CHAT_TASK_WEBVIEW_DID_LAUNCH,
} from "@features/chat"

/**
 * Register all task-related event handlers on the given IntentBus.
 *
 * Delegates to the existing registerAllTaskHandlers in the task/handlers/
 * directory to avoid duplicating registration logic.
 */

function registerOnTaskCHATTASKNEWTASK(): void {
	onWebviewMessage(CHAT_TASK_NEW_TASK, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.new.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnTaskCHATTASKCANCELTASK(): void {
	onWebviewMessage(CHAT_TASK_CANCEL_TASK, (_provider, message) => {
		const store = getStore()
		if (!store) return

		store.chat.setIsRunning(false)

		// Abort the streaming task model — the streaming loop checks
		// task._state.abort (Task Model level), which is separate from
		// store.chat.abort (Chat Model level). The activeTask view may
		// be null even when the task exists in the tasks map, so we
		// also try via activeTaskId as a fallback.
		const activeTask = store.chat.activeTask
		activeTask?.abortTask?.()
		const taskId = store.chat.activeTaskId
		if (taskId) {
			store.chat.tasks.get(taskId)?.cancelCurrentRequest?.()
		}

		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.cancel.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			priority: IntentPriority.Critical,
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnTaskCHATTASKRESUME(): void {
	onWebviewMessage(CHAT_TASK_RESUME, (_provider, message) => {
		const store = getStore()
		if (!store || !message.taskId) return

		dispatchTaskResumeIntent(message.taskId)
	})
}

function registerOnTaskCHATTASKSENDMESSAGE(): void {
	onWebviewMessage(CHAT_TASK_SEND_MESSAGE, (_provider, message) => {
		const dispatched = dispatchSendMessageToAgent(message.text ?? "", message.taskId)
		if (!dispatched)
			console.warn("[jabberwock] [webviewMessageHandler] sendMessage: no active task to deliver the prompt")
	})
}

function registerOnTaskCHATTASKCLEARTASK(): void {
	onWebviewMessage(CHAT_TASK_CLEAR_TASK, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.clear.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnTaskCHATTASKTASKSYNCENABLED(): void {
	onWebviewMessage(CHAT_TASK_TASK_SYNC_ENABLED, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.sync.enabled.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnTaskCHATTASKCONDENSETASKCONTEXTREQUEST(): void {
	onWebviewMessage(CHAT_TASK_CONDENSE_TASK_CONTEXT_REQUEST, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.condense.context.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnTaskCHATTASKWEBVIEWDIDLAUNCH(): void {
	onWebviewMessage(CHAT_TASK_WEBVIEW_DID_LAUNCH, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.webview.launched",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerOnTaskIntents(bus: IntentBus): void {
	registerAllTaskHandlers(bus)
	registerOnTaskCHATTASKNEWTASK()
	registerOnTaskCHATTASKCANCELTASK()
	registerOnTaskCHATTASKRESUME()
	registerOnTaskCHATTASKSENDMESSAGE()
	registerOnTaskCHATTASKCLEARTASK()
	registerOnTaskCHATTASKTASKSYNCENABLED()
	registerOnTaskCHATTASKCONDENSETASKCONTEXTREQUEST()
	registerOnTaskCHATTASKWEBVIEWDIDLAUNCH()
	registerOnGoalAdd(bus)
	registerOnGoalRemove(bus)
	registerOnGoalUpdate(bus)
	registerOnGoalReorder(bus)
}
