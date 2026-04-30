import pWaitFor from "p-wait-for"

import {
	type ClineAsk,
	type ClineSay,
	type ToolProgressStatus,
	type ContextCondense,
	type ContextTruncation,
	type ToolName,
	type ClineMessage,
	type ClineApiReqCancelReason,
	JabberwockEventName,
	isIdleAsk,
	isInteractiveAsk,
	isResumableAsk,
	QueuedMessage,
} from "@jabberwock/types"

import { findLastIndex } from "../../../../shared/array"
import { ClineAskResponse } from "../../../../shared/WebviewMessage"
import { formatResponse } from "../../../prompts/responses"
import { checkAutoApproval, type CheckAutoApprovalResult } from "../../../auto-approval"
import { diagnosticsManager } from "../../../devtools/DiagnosticsManager"
import { AskIgnoredError } from "../../../task/AskIgnoredError"
import { Task } from "../../../task/Task"

/**
 * Extracted from Task.ask() — handles the ask/say lifecycle for user interactions.
 */

import { createTimerQueueStore } from "../../foundation/timer-queue/store"

let _timerQueue: ReturnType<typeof createTimerQueueStore> | undefined

function getTimerQueue(): ReturnType<typeof createTimerQueueStore> {
	if (!_timerQueue) {
		_timerQueue = createTimerQueueStore()
	}
	return _timerQueue
}

export async function ask(
	task: Task,
	type: ClineAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
	const t: any = task

	// If this Cline instance was aborted by the provider, then the only
	// thing keeping us alive is a promise still running in the background,
	// in which case we don't want to send its result to the webview as it
	// is attached to a new instance of Cline now. So we can safely ignore
	// the result of any active promises, and this class will be
	// deallocated. (Although we set Cline = undefined in provider, that
	// simply removes the reference to this instance, but the instance is
	// still alive until this promise resolves or rejects.)
	if (t.abort) {
		throw new Error(`[Jabberwock#ask] task ${t.taskId}.${t.instanceId} aborted`)
	}

	let askTs: number

	if (partial !== undefined) {
		const lastMessage = t.clineMessages.at(-1)

		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type

		if (partial) {
			if (isUpdatingPreviousPartial) {
				// Existing partial message, so update it.
				lastMessage.text = text
				lastMessage.partial = partial
				lastMessage.progressStatus = progressStatus
				lastMessage.isProtected = isProtected
				// TODO: Be more efficient about saving and posting only new
				// data or one whole message at a time so ignore partial for
				// saves, and only post parts of partial message instead of
				// whole array in new listener.
				t.updateClineMessage(lastMessage)
				// console.log("Task#ask: current ask promise was ignored (#1)")
				throw new AskIgnoredError("updating existing partial")
			} else {
				// This is a new partial message, so add it with partial
				// state.
				askTs = t.generateUniqueTs()
				t.lastMessageTs = askTs
				await t.addToClineMessages({
					mode: t.taskMode,
					ts: askTs,
					type: "ask",
					ask: type,
					text,
					partial,
					isProtected,
				})
				// console.log("Task#ask: current ask promise was ignored (#2)")
				throw new AskIgnoredError("new partial")
			}
		} else {
			if (isUpdatingPreviousPartial) {
				// This is the complete version of a previously partial
				// message, so replace the partial with the complete version.
				t.askResponse = undefined
				t.askResponseText = undefined
				t.askResponseImages = undefined

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
				t.lastMessageTs = askTs
				lastMessage.text = text
				lastMessage.partial = false
				lastMessage.progressStatus = progressStatus
				lastMessage.isProtected = isProtected
				await t.saveClineMessages()
				t.updateClineMessage(lastMessage)
			} else {
				// This is a new and complete message, so add it like normal.
				t.askResponse = undefined
				t.askResponseText = undefined
				t.askResponseImages = undefined
				askTs = t.generateUniqueTs()
				t.lastMessageTs = askTs
				await t.addToClineMessages({
					mode: t.taskMode,
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
		t.askResponse = undefined
		t.askResponseText = undefined
		t.askResponseImages = undefined
		askTs = t.generateUniqueTs()
		t.lastMessageTs = askTs
		await t.addToClineMessages({ mode: t.taskMode, ts: askTs, type: "ask", ask: type, text, isProtected })

		// [TODO-LOG] Ask created — model is waiting for user response
		const askLogMsg = `[TODO-LOG] [Task] Ask created (taskId: ${t.taskId}, type: ${type})`
		console.log(askLogMsg)
		diagnosticsManager.log(askLogMsg, "info")
	}

	let timeoutIds: string[] = []

	// Automatically approve if the ask according to the user's settings.
	const provider = t.providerRef.deref()
	const state = provider ? await provider.getState() : undefined
	const approval = await checkAutoApproval({ state, ask: type, text, isProtected })

	const approvalHandlers: Record<string, () => void> = {
		approve: () => t.approveAsk(),
		deny: () => t.denyAsk(),
		timeout: () => {
			const timeoutApproval = approval as Extract<CheckAutoApprovalResult, { decision: "timeout" }>
			// Store the auto-approval timeout so it can be cancelled if user interacts
			const autoApprovalId = `auto-approval-${t.taskId}-${Date.now()}`
			getTimerQueue().schedule({
				id: autoApprovalId,
				label: "Auto-approval timeout",
				timeoutMs: timeoutApproval.timeout,
			})
			t.autoApprovalTimeoutRef = autoApprovalId
			getTimerQueue()
				.createAbortPromise(autoApprovalId)
				.then(() => {
					const { askResponse, text, images } = timeoutApproval.fn()
					handleWebviewAskResponse(task, askResponse, text, images)
					t.autoApprovalTimeoutRef = undefined
				})
			timeoutIds.push(autoApprovalId)
		},
		ask: () => {
			t.askShownAt = Date.now() // Jabberwock: Store time to prevent accidental fast-clicks
		},
	}

	const approvalHandler = approvalHandlers[approval.decision]
	if (approvalHandler) {
		approvalHandler()
	}

	// The state is mutable if the message is complete and the task will
	// block (via the `pWaitFor`).
	const isBlocking = !(t.askResponse !== undefined || t.lastMessageTs !== askTs)
	const isMessageQueued = !t.messageQueueService.isEmpty()
	// Keep queued user messages intact during command_output asks. Those asks
	// are terminal flow-control, not conversational turns.
	const shouldDrainQueuedMessageForAsk = type !== "command_output"
	const isStatusMutable = !partial && isBlocking && !isMessageQueued && approval.decision === "ask"

	if (isStatusMutable) {
		const statusMutationTimeout = 2_000

		const statusMutationHandlers: Record<
			string,
			{ label: string; event: JabberwockEventName; postMessage?: boolean }
		> = {
			interactive: {
				label: "Interactive ask timeout",
				event: JabberwockEventName.TaskInteractive,
				postMessage: true,
			},
			resumable: { label: "Resumable ask timeout", event: JabberwockEventName.TaskResumable },
			idle: { label: "Idle ask timeout", event: JabberwockEventName.TaskIdle },
		}

		let statusKey: string | undefined
		if (isInteractiveAsk(type)) statusKey = "interactive"
		else if (isResumableAsk(type)) statusKey = "resumable"
		else if (isIdleAsk(type)) statusKey = "idle"

		if (statusKey) {
			const config = statusMutationHandlers[statusKey]
			const timeoutId = `${statusKey}-ask-${t.taskId}-${Date.now()}`
			getTimerQueue().schedule({
				id: timeoutId,
				label: config.label,
				timeoutMs: statusMutationTimeout,
			})
			getTimerQueue()
				.createAbortPromise(timeoutId)
				.then(() => {
					const message = t.findMessageByTimestamp(askTs)

					if (message) {
						;(t as any)[`${statusKey}Ask`] = message
						t.emit(config.event, t.taskId)
						if (config.postMessage) {
							provider?.postMessageToWebview({ type: "interactionRequired" })
						}
					}
				})
			timeoutIds.push(timeoutId)
		}
	} else if (isMessageQueued && shouldDrainQueuedMessageForAsk) {
		const message = t.messageQueueService.dequeueMessage()

		if (message) {
			// Tool approval asks need yesButtonClicked; other asks use messageResponse
			const toolAskTypes = new Set(["tool", "command", "use_mcp_server"])
			const responseType = toolAskTypes.has(type) ? "yesButtonClicked" : "messageResponse"
			handleWebviewAskResponse(task, responseType, message.text, message.images)
		}
	}

	// Wait for askResponse to be set
	await pWaitFor(
		() => {
			if (t.askResponse !== undefined || t.lastMessageTs !== askTs) {
				return true
			}

			// If a queued message arrives while we're blocked on an ask (e.g. a follow-up
			// suggestion click that was incorrectly queued due to UI state), consume it
			// immediately so the task doesn't hang.
			if (shouldDrainQueuedMessageForAsk && !t.messageQueueService.isEmpty()) {
				const message = t.messageQueueService.dequeueMessage()
				if (message) {
					const toolAskTypes = new Set(["tool", "command", "use_mcp_server"])
					const responseType = toolAskTypes.has(type) ? "yesButtonClicked" : "messageResponse"
					handleWebviewAskResponse(task, responseType, message.text, message.images)
				}
			}

			return false
		},
		{ interval: 100 },
	)

	if (t.lastMessageTs !== askTs) {
		// Could happen if we send multiple asks in a row i.e. with
		// command_output. It's important that when we know an ask could
		// fail, it is handled gracefully.
		throw new AskIgnoredError("superseded")
	}

	const result = { response: t.askResponse!, text: t.askResponseText, images: t.askResponseImages }
	t.askResponse = undefined
	t.askResponseText = undefined
	t.askResponseImages = undefined

	// Cancel the timeouts if they are still running.
	timeoutIds.forEach((id) => getTimerQueue().cancel(id))

	// Switch back to an active state.
	if (t.idleAsk || t.resumableAsk || t.interactiveAsk) {
		t.idleAsk = undefined
		t.resumableAsk = undefined
		t.interactiveAsk = undefined
		t.emit(JabberwockEventName.TaskActive, t.taskId)
	}

	t.emit(JabberwockEventName.TaskAskResponded)
	return result
}

export function handleWebviewAskResponse(task: Task, askResponse: ClineAskResponse, text?: string, images?: string[]) {
	const t: any = task

	// Jabberwock: Interruption Engineering - prevent accidental fast clicks
	if (askResponse === "yesButtonClicked" && t.askShownAt) {
		const timeSinceAsk = Date.now() - t.askShownAt
		if (timeSinceAsk < 500) {
			console.warn(`[Task] Ignoring accidental fast click (${timeSinceAsk}ms)`)
			return
		}
	}
	t.askShownAt = undefined

	// Clear any pending auto-approval timeout when user responds
	t.cancelAutoApprovalTimeout()

	t.askResponse = askResponse
	t.askResponseText = text
	t.askResponseImages = images

	// Mark the last follow-up question as answered
	const markFollowUpAnswered = () => {
		const lastFollowUpIndex = findLastIndex(
			t.clineMessages,
			(msg: ClineMessage) => msg.type === "ask" && msg.ask === "followup" && !msg.isAnswered,
		)
		if (lastFollowUpIndex !== -1) {
			t.clineMessages[lastFollowUpIndex].isAnswered = true
			t.saveClineMessages().catch((error: any) => {
				console.error("Failed to save answered follow-up state:", error)
			})
		}
	}

	// Mark the last tool-approval ask as answered when user approves (or auto-approval)
	const markToolAskAnswered = () => {
		const lastToolAskIndex = findLastIndex(
			t.clineMessages,
			(msg: ClineMessage) => msg.type === "ask" && msg.ask === "tool" && !msg.isAnswered,
		)
		if (lastToolAskIndex !== -1) {
			t.clineMessages[lastToolAskIndex].isAnswered = true
			void t.updateClineMessage(t.clineMessages[lastToolAskIndex])
			t.saveClineMessages().catch((error: any) => {
				console.error("Failed to save answered tool-ask state:", error)
			})
		}
	}

	const responseHandlers: Record<string, () => void> = {
		messageResponse: () => {
			// Create a checkpoint whenever the user sends a message.
			// Use allowEmpty=true to ensure a checkpoint is recorded even if there are no file changes.
			// Suppress the checkpoint_saved chat row for this particular checkpoint to keep the timeline clean.
			void t.checkpointSave(false, true)
			markFollowUpAnswered()
		},
		yesButtonClicked: () => {
			markFollowUpAnswered()
			markToolAskAnswered()
		},
	}

	const handler = responseHandlers[askResponse]
	if (handler) {
		handler()
	}
}

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
	const t: any = task

	if (t.abort) {
		throw new Error(`[Jabberwock#say] task ${t.taskId}.${t.instanceId} aborted`)
	}

	if (partial !== undefined) {
		const lastMessage = t.clineMessages.at(-1)

		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && lastMessage.type === "say" && lastMessage.say === type

		if (partial) {
			if (isUpdatingPreviousPartial) {
				// Existing partial message, so update it.
				lastMessage.text = text
				lastMessage.images = images
				lastMessage.partial = partial
				lastMessage.progressStatus = progressStatus
				t.updateClineMessage(lastMessage)
			} else {
				// This is a new partial message, so add it with partial state.
				const sayTs = t.generateUniqueTs()

				if (!options.isNonInteractive) {
					t.lastMessageTs = sayTs
				}

				await t.addToClineMessages({
					mode: t.taskMode,
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
					t.lastMessageTs = lastMessage.ts
				}

				lastMessage.text = text
				lastMessage.images = images
				lastMessage.partial = false
				lastMessage.progressStatus = progressStatus

				// Instead of streaming partialMessage events, we do a save
				// and post like normal to persist to disk.
				await t.saveClineMessages()

				// More performant than an entire `postStateToWebview`.
				t.updateClineMessage(lastMessage)
			} else {
				// This is a new and complete message, so add it like normal.
				const sayTs = t.generateUniqueTs()

				if (!options.isNonInteractive) {
					t.lastMessageTs = sayTs
				}

				await t.addToClineMessages({
					mode: t.taskMode,
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
		const sayTs = t.generateUniqueTs()

		// A "non-interactive" message is a message is one that the user
		// does not need to respond to. We don't want these message types
		// to trigger an update to `lastMessageTs` since they can be created
		// asynchronously and could interrupt a pending ask.
		if (!options.isNonInteractive) {
			t.lastMessageTs = sayTs
		}

		await t.addToClineMessages({
			mode: t.taskMode,
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

export async function sayAndCreateMissingParamError(
	task: Task,
	toolName: ToolName,
	paramName: string,
	relPath?: string,
) {
	const t: any = task
	await say(
		task,
		"error",
		`Jabberwock tried to use ${toolName}${
			relPath ? ` for '${relPath.toPosix()}'` : ""
		} without value for required parameter '${paramName}'. Retrying...`,
	)
	return formatResponse.toolError(formatResponse.missingToolParameterError(paramName))
}
