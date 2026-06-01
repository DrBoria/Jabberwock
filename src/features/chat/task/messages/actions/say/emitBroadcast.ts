import type {
	NotificationSay,
	Notification,
	ToolProgressStatus,
	ContextCondense,
	ContextTruncation,
} from "@jabberwock/types"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { getTask } from "../../../actions/taskRegistry"

/**
 * Shared logic for all broadcast action creators.
 *
 * Handles task state validation (abort check, task mode readiness),
 * partial message update logic, and Intent creation with the specified
 * broadcast type. Each action creator (agentBroadcast, systemBroadcast,
 * etc.) calls this with the appropriate IntentConstants.messages.* type.
 *
 * The handler (`on-message-broadcast.ts`) receives the Intent and performs
 * the actual store mutation + snapshot push.
 */
/**
 * Checkpoint data for tool execution checkpoint/restore.
 * Contains dynamic key-value pairs representing the tool's execution state
 * at the time of checkpoint creation.
 */
export type CheckpointData = { [key: string]: unknown }

export async function emitBroadcast(
	taskId: string,
	broadcastType: string,
	type: NotificationSay,
	text?: string,
	images?: string[],
	partial?: boolean,
	checkpoint?: CheckpointData,
	progressStatus?: ToolProgressStatus,
	options: {
		isNonInteractive?: boolean
	} = {},
	contextCondense?: ContextCondense,
	contextTruncation?: ContextTruncation,
): Promise<undefined> {
	const task = getTask(taskId)

	// BUG FIX: Wait for task mode initialization before accessing task._state._taskMode
	await task.taskModeReady

	if (task._state.abort) {
		throw new Error(`[Jabberwock#say] task ${task.taskId}.${task.instanceId} aborted`)
	}

	// Read notifications from per-task MST store
	const taskModel = getBackendRootStore().chat.tasks.get(taskId)!
	const messages = taskModel.notifications.items

	if (partial !== undefined) {
		const lastMessage = messages.at(-1)

		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && lastMessage.type === "say" && lastMessage.say === type

		if (partial) {
			if (isUpdatingPreviousPartial) {
				// Existing partial message, so update it.
				lastMessage.text = text
				lastMessage.images = images
				lastMessage.partial = partial
				lastMessage.progressStatus = progressStatus
				emitMessageUpdate(task.taskId, broadcastType, lastMessage)
			} else {
				// This is a new partial message, so add it with partial state.
				const sayTs = task.generateUniqueTs()

				if (!options.isNonInteractive) {
					task.lastMessageTs = sayTs
				}

				emitMessageCreate(taskId, broadcastType, {
					mode: task._state._taskMode,
					ts: sayTs,
					type: "say",
					say: type,
					text,
					images,
					partial,
					contextCondense,
					contextTruncation,
				})
			}
		} else {
			// Now have a complete version of a previously partial message.
			if (isUpdatingPreviousPartial) {
				if (!options.isNonInteractive) {
					task.lastMessageTs = lastMessage.ts
				}

				lastMessage.text = text
				lastMessage.images = images
				lastMessage.partial = false
				lastMessage.progressStatus = progressStatus

				emitMessageUpdate(task.taskId, broadcastType, lastMessage)
			} else {
				// This is a new and complete message, so add it like normal.
				const sayTs = task.generateUniqueTs()

				if (!options.isNonInteractive) {
					task.lastMessageTs = sayTs
				}

				emitMessageCreate(taskId, broadcastType, {
					mode: task._state._taskMode,
					ts: sayTs,
					type: "say",
					say: type,
					text,
					images,
					contextCondense,
					contextTruncation,
				})
			}
		}
	} else {
		// This is a new non-partial message, so add it like normal.
		const sayTs = task.generateUniqueTs()

		if (!options.isNonInteractive) {
			task.lastMessageTs = sayTs
		}

		emitMessageCreate(taskId, broadcastType, {
			mode: task._state._taskMode,
			ts: sayTs,
			type: "say",
			say: type,
			text,
			images,
			checkpoint,
			contextCondense,
			contextTruncation,
		})
	}
}

/**
 * Emit a broadcast Intent to add a new notification to the store.
 */
function emitMessageCreate(taskId: string, broadcastType: string, notification: Notification): void {
	const store = getBackendRootStore()
	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: broadcastType,
		payload: { taskId, notification, action: "create" },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

/**
 * Emit a broadcast Intent to update an existing notification in the store.
 */
function emitMessageUpdate(taskId: string, broadcastType: string, notification: Notification): void {
	const store = getBackendRootStore()
	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: broadcastType,
		payload: { taskId, notification, action: "update" },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}
