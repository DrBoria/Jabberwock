import { useCallback, useRef } from "react"
import type { ExtensionMessage, NotificationAsk, NotificationSay } from "@jabberwock/types"

import { useCLIStore, cliStore } from "../../store.js"
import {
	shouldSkipSay,
	shouldSkipAsk,
	getSayRole,
	processNonInteractiveAsk,
	parseAskContent,
} from "../../utils/message-processors.js"
import {
	processResumeTask,
	processCompletionResult,
	handleStateExtension,
	handleMessageUpdatedExtension,
} from "../../utils/extension-handlers.js"
import type { FileResult, SlashCommandResult, ModeResult } from "../../components/autocomplete/index.js"

export interface UseMessageHandlersOptions {
	nonInteractive: boolean
}

export interface UseMessageHandlersReturn {
	handleExtensionMessage: (msg: ExtensionMessage) => void
	seenMessageIds: React.MutableRefObject<Set<string>>
	pendingCommandRef: React.MutableRefObject<string | null>
	firstTextMessageSkipped: React.MutableRefObject<boolean>
}

export function useMessageHandlers({ nonInteractive }: UseMessageHandlersOptions): UseMessageHandlersReturn {
	const {
		addMessage,
		setFileSearchResults,
		setAllSlashCommands,
		setAvailableModes,
		setTaskHistory,
		currentTodos,
		setTodos,
	} = useCLIStore()

	const seenMessageIds = useRef<Set<string>>(new Set())
	const firstTextMessageSkipped = useRef(false)
	const pendingCommandRef = useRef<string | null>(null)

	const handleSayMessage = useCallback(
		(ts: number, say: NotificationSay, text: string, partial: boolean) => {
			const messageId = ts.toString()
			const isResuming = cliStore.isResumingTask

			if (shouldSkipSay(say, messageId, firstTextMessageSkipped, isResuming, seenMessageIds, partial)) {
				return
			}

			const { role, toolName, toolDisplayName, toolDisplayOutput, toolData } = getSayRole(
				say,
				text,
				pendingCommandRef,
			)

			seenMessageIds.current.add(messageId)

			addMessage({
				id: messageId,
				role,
				content: text ?? "",
				toolName,
				toolDisplayName,
				toolDisplayOutput,
				partial,
				originalType: say,
				toolData,
			})
		},
		[addMessage],
	)

	const handleAskMessage = useCallback(
		(ts: number, ask: NotificationAsk, text: string, partial: boolean) => {
			const messageId = ts.toString()

			if (shouldSkipAsk(messageId, ask, partial, seenMessageIds)) {
				return
			}

			if (ask === "resume_task" || ask === "resume_completed_task") {
				processResumeTask(messageId, seenMessageIds)
				return
			}

			if (ask === "completion_result") {
				processCompletionResult(ts, text, messageId, addMessage, seenMessageIds)
				return
			}

			if (ask === "command") {
				pendingCommandRef.current = text
			}

			if (nonInteractive && ask !== "followup") {
				processNonInteractiveAsk(messageId, ask, text, seenMessageIds, currentTodos, setTodos, addMessage)
				return
			}

			const { questionText, suggestions } = parseAskContent(ask, text)

			seenMessageIds.current.add(messageId)

			cliStore.pendingAsk = {
				id: messageId,
				type: ask,
				content: questionText,
				suggestions,
			}
		},
		[addMessage, nonInteractive, currentTodos, setTodos],
	)

	const handleExtensionMessage = useCallback(
		(msg: ExtensionMessage) => {
			if (msg.type === "state") {
				handleStateExtension(msg, handleSayMessage, handleAskMessage)
				return
			}

			if (msg.type === "messageUpdated") {
				handleMessageUpdatedExtension(msg, handleSayMessage, handleAskMessage)
				return
			}

			if (msg.type === "fileSearchResults") {
				setFileSearchResults(msg.results as FileResult[])
				return
			}

			if (msg.type === "commands") {
				setAllSlashCommands(msg.commands as SlashCommandResult[])
				return
			}

			if (msg.type === "modes") {
				setAvailableModes(msg.modes as ModeResult[])
				return
			}

			if (msg.type === "routerModels" && msg.routerModels) {
				cliStore.routerModels = msg.routerModels
			}
		},
		[
			handleSayMessage,
			handleAskMessage,
			setFileSearchResults,
			setAllSlashCommands,
			setAvailableModes,
			setTaskHistory,
		],
	)

	return {
		handleExtensionMessage,
		seenMessageIds,
		pendingCommandRef,
		firstTextMessageSkipped,
	}
}
