import { useCallback } from "react"
import { randomUUID } from "crypto"
import type { WebviewMessage } from "@jabberwock/types"

import { getGlobalCommand } from "../../../lib/utils/commands.js"

import { useCLIStore, cliStore } from "../../store.js"
import { uiStateStore } from "../../stores/uiStateStore.js"

export interface UseTaskSubmitOptions {
	sendToExtension: ((msg: WebviewMessage) => void) | null
	runTask: ((prompt: string) => Promise<void>) | null
	seenMessageIds: React.MutableRefObject<Set<string>>
	firstTextMessageSkipped: React.MutableRefObject<boolean>
}

export interface UseTaskSubmitReturn {
	handleSubmit: (text: string) => Promise<void>
	handleApprove: () => void
	handleReject: () => void
}

function handleGlobalCommand(
	trimmedText: string,
	sendToExtension: ((msg: WebviewMessage) => void) | null,
	seenMessageIds: React.MutableRefObject<Set<string>>,
	firstTextMessageSkipped: React.MutableRefObject<boolean>,
): boolean {
	if (!trimmedText.startsWith("/")) {
		return false
	}

	const commandMatch = trimmedText.match(/^\/(\w+)(?:\s|$)/)
	if (!commandMatch?.[1]) {
		return false
	}

	const globalCommand = getGlobalCommand(commandMatch[1])
	if (globalCommand?.action !== "clearTask") {
		return false
	}

	cliStore.reset()
	seenMessageIds.current.clear()
	firstTextMessageSkipped.current = false
	sendToExtension?.({ type: "clearTask" })
	sendToExtension?.({ type: "requestCommands" })
	sendToExtension?.({ type: "requestModes" })
	return true
}

async function handlePendingAskResponse(
	trimmedText: string,
	sendToExtension: ((msg: WebviewMessage) => void) | null,
): Promise<void> {
	const store = cliStore
	const uiStore = uiStateStore

	store.addMessage({ id: randomUUID(), role: "user", content: trimmedText })
	sendToExtension?.({
		type: "askResponse",
		askResponse: "messageResponse",
		text: trimmedText,
	})
	store.pendingAsk = null
	uiStore.showCustomInput = false
	uiStore.isTransitioningToCustomInput = false
	store.isLoading = true
}

async function handleNewTask(trimmedText: string, runTask: ((prompt: string) => Promise<void>) | null): Promise<void> {
	const store = cliStore

	store.hasStartedTask = true
	store.isLoading = true
	store.addMessage({ id: randomUUID(), role: "user", content: trimmedText })

	try {
		if (runTask) {
			await runTask(trimmedText)
		}
	} catch (err) {
		store.error = err instanceof Error ? err.message : String(err)
		store.isLoading = false
	}
}

async function handleContinueTask(
	trimmedText: string,
	isComplete: boolean,
	sendToExtension: ((msg: WebviewMessage) => void) | null,
): Promise<void> {
	const store = cliStore

	if (isComplete) {
		store.isComplete = false
	}

	store.isLoading = true
	store.addMessage({ id: randomUUID(), role: "user", content: trimmedText })
	sendToExtension?.({
		type: "askResponse",
		askResponse: "messageResponse",
		text: trimmedText,
	})
}

/**
 * Hook to handle task submission, user responses, and approvals.
 *
 * Responsibilities:
 * - Process user message submissions
 * - Detect and handle global commands (like /new)
 * - Handle pending ask responses
 * - Start new tasks or continue existing ones
 * - Handle Y/N approval responses
 */
export function useTaskSubmit({
	sendToExtension,
	runTask,
	seenMessageIds,
	firstTextMessageSkipped,
}: UseTaskSubmitOptions): UseTaskSubmitReturn {
	const { pendingAsk, hasStartedTask, isComplete } = useCLIStore()

	const handleSubmit = useCallback(
		async (text: string) => {
			if (!sendToExtension || !text.trim()) {
				return
			}

			const trimmedText = text.trim()

			if (trimmedText === "__CUSTOM__") {
				return
			}

			if (handleGlobalCommand(trimmedText, sendToExtension, seenMessageIds, firstTextMessageSkipped)) {
				return
			}

			if (pendingAsk) {
				await handlePendingAskResponse(trimmedText, sendToExtension)
			} else if (!hasStartedTask) {
				await handleNewTask(trimmedText, runTask)
			} else {
				await handleContinueTask(trimmedText, isComplete, sendToExtension)
			}
		},
		[sendToExtension, runTask, pendingAsk, hasStartedTask, isComplete, seenMessageIds, firstTextMessageSkipped],
	)

	const handleApprove = useCallback(() => {
		if (!sendToExtension) {
			return
		}

		sendToExtension({ type: "askResponse", askResponse: "yesButtonClicked" })
		cliStore.pendingAsk = null
		cliStore.isLoading = true
	}, [sendToExtension])

	const handleReject = useCallback(() => {
		if (!sendToExtension) {
			return
		}

		sendToExtension({ type: "askResponse", askResponse: "noButtonClicked" })
		cliStore.pendingAsk = null
		cliStore.isLoading = true
	}, [sendToExtension])

	return {
		handleSubmit,
		handleApprove,
		handleReject,
	}
}
