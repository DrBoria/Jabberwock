import pWaitFor from "p-wait-for"
import delay from "delay"

import { AskIgnoredError } from "../../../../core/task/AskIgnoredError"
import type { Task } from "../Task"
import type {
	ClineAsk,
	ClineAskResponse,
	ClineSay,
	ClineMessage,
	ToolProgressStatus,
	ContextCondense,
	ContextTruncation,
	ToolName,
} from "@jabberwock/types"
import { JabberwockEventName, isInteractiveAsk, isResumableAsk } from "@jabberwock/types"
import { findLastIndex } from "../../../../shared/array"
import { checkAutoApproval } from "../../../../core/auto-approval"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getTimerQueue } from "../../../foundation/timer-queue/getTimerQueue"

/**
 * Asks the user a question. The task waits for a response before continuing.
 *
 * NOTE: The bug fix — await task.taskModeReady at the top ensures the task mode
 * is initialized before any access to task.taskMode (sync getter) within this function.
 */
export async function ask(
	task: Task,
	type: ClineAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
	// BUG FIX: Wait for task mode initialization before accessing task.taskMode
	await task.taskModeReady

	// If this Cline instance was aborted by the provider, then the only
	// thing keeping us alive is a promise still running in the background,
	// in which case we don't want to send its result to the webview as it
	// is attached to a new instance of Cline now. So we can safely ignore
	// the result of any active promises, and this class will be
	// deallocated. (Although we set Cline = undefined in provider, that
	// simply removes the reference to this instance, but the instance is
	// still alive until this promise resolves or rejects.)
	if (task.abort) {
		throw new Error(`[Jabberwock#ask] task ${task.taskId}.${task.instanceId} aborted`)
	}

	let askTs: number

	if (partial !== undefined) {
		const lastMessage = task.clineMessages.at(-1)

		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type

		if (partial) {
			if (isUpdatingPreviousPartial) {
				// Existing partial message, so update it.
				lastMessage.text = text
				lastMessage.partial = partial
				lastMessage.progressStatus = progressStatus
				lastMessage.isProtected = isProtected
				task.updateClineMessage(lastMessage)
				throw new AskIgnoredError("updating existing partial")
			} else {
				// This is a new partial message, so add it with partial
				// state.
				askTs = task.generateUniqueTs()
				task.lastMessageTs = askTs
				await task.addToClineMessages({
					mode: task.taskMode,
					ts: askTs,
					type: "ask",
					ask: type,
					text,
					partial,
					isProtected,
				})
				throw new AskIgnoredError("new partial")
			}
		} else {
			if (isUpdatingPreviousPartial) {
				// This is the complete version of a previously partial
				// message, so replace the partial with the complete version.
				task.askResponse = undefined
				task.askResponseText = undefined
				task.askResponseImages = undefined

				// Bug for the history books:
				// In the webview we use the ts as the chatrow key for the
				// virtuoso list. Since we would update this ts right at the
				// end of streaming, it would cause the view to flicker. The
				// key prop has to be stable otherwise react has trouble
				// reconciling items between renders, causing unmounting and
				// remounting of components (flickering).
				// The lesson here is if you see flickering when rendering
				// lists, it's likely because the key prop is not stable.
				// So in this case we must make sure that the message ts is
				// never altered after first setting it.
				askTs = lastMessage.ts
				task.lastMessageTs = askTs
				lastMessage.text = text
				lastMessage.partial = false
				lastMessage.progressStatus = progressStatus
				lastMessage.isProtected = isProtected
				await task.saveClineMessages()
				task.updateClineMessage(lastMessage)
			} else {
				// This is a new and complete message, so add it like normal.
				task.askResponse = undefined
				task.askResponseText = undefined
				task.askResponseImages = undefined
				askTs = task.generateUniqueTs()
				task.lastMessageTs = askTs
				await task.addToClineMessages({
					mode: task.taskMode,
					ts: askTs,
					type: "ask",
					ask: type,
					text,
					isProtected,
				})
			}
		}
	} else {
		// This is a new non-partial message, so add it like normal.
		task.askResponse = undefined
		task.askResponseText = undefined
		task.askResponseImages = undefined
		askTs = task.generateUniqueTs()
		task.lastMessageTs = askTs
		await task.addToClineMessages({ mode: task.taskMode, ts: askTs, type: "ask", ask: type, text, isProtected })

		// [TODO-LOG] Ask created — model is waiting for user response
		const askLogMsg = `[TODO-LOG] [Task] Ask created (taskId: ${task.taskId}, type: ${type})`
		console.log(askLogMsg)
		diagnosticsManager.log(askLogMsg, "info")
	}

	let timeouts: NodeJS.Timeout[] = []

	// Automatically approve if the ask according to the user's settings.
	const provider = task.providerRef.deref()
	const state = provider ? await provider.getState() : undefined
	const approval = await checkAutoApproval({ state: state as Record<string, unknown>, ask: type, text, isProtected })

	if (approval.decision === "approve") {
		task.approveAsk()
	} else if (approval.decision === "deny") {
		task.denyAsk()
	} else if (approval.decision === "timeout") {
		// Store the auto-approval timeout so it can be cancelled if user interacts
		task.autoApprovalTimeoutRef = setTimeout(() => {
			const { askResponse, text, images } = approval.fn()
			handleWebviewAskResponse(task, askResponse, text, images)
			task.autoApprovalTimeoutRef = undefined
		}, approval.timeout)
		timeouts.push(task.autoApprovalTimeoutRef)
	} else if (approval.decision === "ask") {
		task.askShownAt = Date.now() // Jabberwock: Store time to prevent accidental fast-clicks
	}

	// The state is mutable if the message is complete and the task will
	// block (via the `pWaitFor`).
	const isBlocking = !(task.askResponse !== undefined || task.lastMessageTs !== askTs)
	const isMessageQueued = !task.messageQueueService.isEmpty()
	// Keep queued user messages intact during command_output asks. Those asks
	// are terminal flow-control, not conversational turns.
	const shouldDrainQueuedMessageForAsk = type !== "command_output"
	const isStatusMutable = !partial && isBlocking && !isMessageQueued && approval.decision === "ask"

	if (isStatusMutable) {
		const statusMutationTimeout = 2_000

		if (isInteractiveAsk(type)) {
			timeouts.push(
				setTimeout(() => {
					const message = task.findMessageByTimestamp(askTs)

					if (message) {
						task.interactiveAsk = message
						task.emit(JabberwockEventName.TaskInteractive, task.taskId)
						provider?.postMessageToWebview({ type: "interactionRequired" })
					}
				}, statusMutationTimeout),
			)
		} else if (isResumableAsk(type)) {
			timeouts.push(
				setTimeout(() => {
					const message = task.findMessageByTimestamp(askTs)

					if (message) {
						task.resumableAsk = message
						task.emit(JabberwockEventName.TaskResumable, task.taskId)
						provider?.postMessageToWebview?.({ type: "idle" } as Record<string, unknown>)
					}
				}, statusMutationTimeout),
			)
		}
	}

	return new Promise<{ response: ClineAskResponse; text?: string; images?: string[] }>((resolve, reject) => {
		const checkInterval = setInterval(() => {
			if (task.askResponse !== undefined) {
				clearInterval(checkInterval)
				timeouts.forEach(clearTimeout)

				// When user responds, check if there's a queued message already
				// for a command_output ask and drain it.
				//
				// This is necessary because command_output asks are created when
				// waiting for terminal output. Once the user responds, we need to
				// drain any queued messages to ensure the new response is processed.
				if (shouldDrainQueuedMessageForAsk) {
					task.messageQueueService.dequeueMessage()
				}

				resolve({
					response: task.askResponse,
					text: task.askResponseText,
					images: task.askResponseImages,
				})
			}
		}, 100)
	})
}

/**
 * Handles the webview's response to an ask.
 */
export function handleWebviewAskResponse(task: Task, askResponse: ClineAskResponse, text?: string, images?: string[]) {
	// Jabberwock: Interruption Engineering - prevent accidental fast clicks
	if (askResponse === "yesButtonClicked" && task.askShownAt) {
		const timeSinceAsk = Date.now() - task.askShownAt
		if (timeSinceAsk < 500) {
			console.warn(`[Task] Ignoring accidental fast click (${timeSinceAsk}ms)`)
			return
		}
	}
	task.askShownAt = undefined

	// Clear any pending auto-approval timeout when user responds
	cancelAutoApprovalTimeout(task)

	task.askResponse = askResponse
	task.askResponseText = text
	task.askResponseImages = images

	// Create a checkpoint whenever the user sends a message.
	// Use allowEmpty=true to ensure a checkpoint is recorded even if there are no file changes.
	// Suppress the checkpoint_saved chat row for this particular checkpoint to keep the timeline clean.
	if (askResponse === "messageResponse") {
		void task.checkpointSave(false, true)
	}

	// Mark the last follow-up question as answered
	if (askResponse === "messageResponse" || askResponse === "yesButtonClicked") {
		// Find the last unanswered follow-up message using findLastIndex
		const lastFollowUpIndex = findLastIndex(
			task.clineMessages,
			(msg) => msg.type === "ask" && msg.ask === "followup" && !msg.isAnswered,
		)

		if (lastFollowUpIndex !== -1) {
			// Mark this follow-up as answered
			task.clineMessages[lastFollowUpIndex].isAnswered = true
			// Save the updated messages
			task.saveClineMessages().catch((error) => {
				console.error("Failed to save answered follow-up state:", error)
			})
		}
	}

	// Mark the last tool-approval ask as answered when user approves (or auto-approval)
	// Also mark any unanswered ask as answered when user denies, to prevent button reappearance
	if (askResponse === "yesButtonClicked" || askResponse === "noButtonClicked") {
		const lastUnansweredAskIndex = findLastIndex(
			task.clineMessages,
			(msg) =>
				msg.type === "ask" && ["tool", "command", "use_mcp_server"].includes(msg.ask ?? "") && !msg.isAnswered,
		)
		if (lastUnansweredAskIndex !== -1) {
			task.clineMessages[lastUnansweredAskIndex].isAnswered = true
			void task.updateClineMessage(task.clineMessages[lastUnansweredAskIndex])
			task.saveClineMessages().catch((error) => {
				console.error("Failed to save answered ask state:", error)
			})
		}
	}
}

/**
 * Approves the current ask with a "yes" response.
 */
export function approveAsk(task: Task, { text, images }: { text?: string; images?: string[] } = {}) {
	handleWebviewAskResponse(task, "yesButtonClicked", text, images)
}

/**
 * Denies the current ask with a "no" response.
 */
export function denyAsk(task: Task, { text, images }: { text?: string; images?: string[] } = {}) {
	handleWebviewAskResponse(task, "noButtonClicked", text, images)
}

/**
 * Supersedes the pending ask by generating a new unique timestamp.
 * This effectively invalidates the current ask.
 */
export function supersedePendingAsk(task: Task): void {
	task.lastMessageTs = task.generateUniqueTs()
}

/**
 * Cancels any pending auto-approval timeout.
 */
export function cancelAutoApprovalTimeout(task: Task): void {
	if (task.autoApprovalTimeoutRef) {
		getTimerQueue().cancel(task.autoApprovalTimeoutRef)
		task.autoApprovalTimeoutRef = undefined
	}
}

/**
 * Sends a "say" message to the user.
 *
 * NOTE: The bug fix — await task.taskModeReady at the top ensures the task mode
 * is initialized before any access to task.taskMode (sync getter) within this function.
 */
export async function say(
	task: Task,
	type: ClineSay,
	text?: string,
	images?: string[],
	partial?: boolean,
	checkpoint?: Record<string, unknown>,
	progressStatus?: ToolProgressStatus,
	options: {
		isNonInteractive?: boolean
	} = {},
	contextCondense?: ContextCondense,
	contextTruncation?: ContextTruncation,
): Promise<undefined> {
	// BUG FIX: Wait for task mode initialization before accessing task.taskMode
	await task.taskModeReady

	if (task.abort) {
		throw new Error(`[Jabberwock#say] task ${task.taskId}.${task.instanceId} aborted`)
	}

	if (partial !== undefined) {
		const lastMessage = task.clineMessages.at(-1)

		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && lastMessage.type === "say" && lastMessage.say === type

		if (partial) {
			if (isUpdatingPreviousPartial) {
				// Existing partial message, so update it.
				lastMessage.text = text
				lastMessage.images = images
				lastMessage.partial = partial
				lastMessage.progressStatus = progressStatus
				task.updateClineMessage(lastMessage)
			} else {
				// This is a new partial message, so add it with partial state.
				const sayTs = task.generateUniqueTs()

				if (!options.isNonInteractive) {
					task.lastMessageTs = sayTs
				}

				await task.addToClineMessages({
					mode: task.taskMode,
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
			// New now have a complete version of a previously partial message.
			// This is the complete version of a previously partial
			// message, so replace the partial with the complete version.
			if (isUpdatingPreviousPartial) {
				if (!options.isNonInteractive) {
					task.lastMessageTs = lastMessage.ts
				}

				lastMessage.text = text
				lastMessage.images = images
				lastMessage.partial = false
				lastMessage.progressStatus = progressStatus

				// Instead of streaming partialMessage events, we do a save
				// and post like normal to persist to disk.
				await task.saveClineMessages()

				// More performant than an entire `postStateToWebview`.
				task.updateClineMessage(lastMessage)
			} else {
				// This is a new and complete message, so add it like normal.
				const sayTs = task.generateUniqueTs()

				if (!options.isNonInteractive) {
					task.lastMessageTs = sayTs
				}

				await task.addToClineMessages({
					mode: task.taskMode,
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

		// A "non-interactive" message is a message is one that the user
		// does not need to respond to. We don't want these message types
		// to trigger an update to `lastMessageTs` since they can be created
		// asynchronously and could interrupt a pending ask.
		if (!options.isNonInteractive) {
			task.lastMessageTs = sayTs
		}

		await task.addToClineMessages({
			mode: task.taskMode,
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
 * Sends an error message saying a required parameter is missing.
 */
export async function sayAndCreateMissingParamError(
	task: Task,
	toolName: ToolName,
	paramName: string,
	relPath?: string,
): Promise<string> {
	await say(
		task,
		"error",
		`Jabberwock tried to use ${toolName}${
			relPath ? ` for '${relPath}'` : ""
		} but it wasn't provided values for the '${paramName}' parameter. You can retry with the proper parameter values.`,
	)
	return `Missing parameter: ${paramName}`
}
