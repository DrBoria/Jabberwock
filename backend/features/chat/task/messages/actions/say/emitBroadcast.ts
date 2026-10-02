import { IntentConstants } from "@intentConstants"
import type { NotificationSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@jabberwock/types"
import { getTask } from "@features/chat"
import { emitNonPartialMessage, emitPartialMessage, emitCompleteMessage } from "./broadcastMessageSend"

/**
 * The four message domains a broadcast can belong to. Each maps to a distinct
 * `IntentConstants.messages.*_BROADCAST` intent, which `on-message-broadcast.ts`
 * handles to add the notification to the MST store and push the snapshot.
 */
export type BroadcastDomain = "agent" | "system" | "mcp" | "user"

const BROADCAST_INTENT: Record<BroadcastDomain, string> = {
	agent: IntentConstants.messages.AGENT_BROADCAST,
	system: IntentConstants.messages.SYSTEM_BROADCAST,
	mcp: IntentConstants.messages.MCP_BROADCAST,
	user: IntentConstants.messages.USER_BROADCAST,
}

/**
 * Checkpoint data for tool execution checkpoint/restore.
 * Contains dynamic key-value pairs representing the tool's execution state
 * at the time of checkpoint creation.
 */
export type CheckpointData = { [key: string]: unknown }

/**
 * Emit a message to the task's message feed for a given domain.
 *
 * This is the single shared broadcast utility: it resolves the domain to its
 * broadcast intent, guards against an aborted task, and dispatches to the
 * correct emitter (non-partial / partial / complete). All domain-specific
 * broadcast creators were consolidated here — callers pass the domain
 * explicitly (`"agent"`, `"system"`, `"mcp"`, `"user"`).
 */
export async function emitBroadcast(
	domain: BroadcastDomain,
	taskId: string,
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
	const broadcastType = BROADCAST_INTENT[domain]
	const task = getTask(taskId)

	await task.taskModeReady

	if (task._state.abort) {
		throw new Error(`[Jabberwock#say] task ${task.taskId}.${task.instanceId} aborted`)
	}

	const partialMsg = task._partialMessage
	const isUpdatingPreviousPartial = partialMsg !== undefined && partialMsg.say === type
	const mode = task._state._taskMode ?? "code"

	if (partial === undefined) {
		emitNonPartialMessage(
			task,
			taskId,
			broadcastType,
			type,
			mode,
			text,
			images,
			checkpoint,
			options,
			contextCondense,
			contextTruncation,
		)

		return
	}

	if (partial) {
		emitPartialMessage(
			task,
			taskId,
			broadcastType,
			type,
			mode,
			text,
			images,
			partial,
			progressStatus,
			isUpdatingPreviousPartial,
			options,
			contextCondense,
			contextTruncation,
		)

		return
	}

	emitCompleteMessage(
		task,
		taskId,
		broadcastType,
		type,
		mode,
		text,
		images,
		progressStatus,
		isUpdatingPreviousPartial,
		options,
		contextCondense,
		contextTruncation,
	)
}
