import { useCallback, type MutableRefObject } from "react"
import type { NotificationAsk, Notification } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import {
	isCompletionResult,
	isSubtaskWithCompletionResult,
	isRestartOnSecondary,
	isCommandOrTool,
	hasInput,
} from "./message-action-utils"

export function useMessageActionsButtons(
	currentAsk: NotificationAsk | undefined,
	currentTaskItem: { parentTaskId?: string; id?: string } | undefined,
	messages: Notification[],
	isStreaming: boolean,
	userRespondedRef: MutableRefObject<boolean>,
	onSetSendingDisabled: (v: boolean) => void,
	onSetClineAsk: (v: NotificationAsk | undefined) => void,
	onSetEnableButtons: (v: boolean) => void,
	onSetPrimaryButtonText: (v: string | undefined) => void,
	onSetSecondaryButtonText: (v: string | undefined) => void,
	onSetInputValue: (v: string) => void,
	onSetSelectedImages: (v: string[]) => void,
) {
	const startNewTask = useCallback(() => {
		onSetInputValue("")
		onSetSelectedImages([])
		rootStore.chat.clearTask()
	}, [onSetInputValue, onSetSelectedImages])

	const handlePrimaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			userRespondedRef.current = true
			if (isCompletionResult(currentAsk)) {
				startNewTask()
				return
			}
			if (currentAsk === "command_output") {
				rootStore.settings.terminalOperation("continue")
			} else {
				if (currentAsk === "resume_task" && isSubtaskWithCompletionResult(currentTaskItem, messages)) {
					startNewTask()
					return
				}
				if (hasInput(text, images)) {
					rootStore.chat.respondToAsk("yesButtonClicked", text?.trim(), images)
					onSetInputValue("")
					onSetSelectedImages([])
				} else {
					rootStore.chat.respondToAsk("yesButtonClicked")
				}
			}
			onSetSendingDisabled(true)
			onSetClineAsk(undefined)
			onSetEnableButtons(false)
			onSetPrimaryButtonText(undefined)
			onSetSecondaryButtonText(undefined)
		},
		[
			currentAsk,
			startNewTask,
			currentTaskItem,
			messages,
			userRespondedRef,
			onSetSendingDisabled,
			onSetClineAsk,
			onSetEnableButtons,
			onSetPrimaryButtonText,
			onSetSecondaryButtonText,
			onSetInputValue,
			onSetSelectedImages,
		],
	)

	const handleSecondaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			userRespondedRef.current = true
			if (isStreaming && !currentAsk) {
				rootStore.chat.cancelTask()
				return
			}
			if (isRestartOnSecondary(currentAsk) || currentAsk === "resume_task") {
				startNewTask()
			} else if (currentAsk === "command_output") {
				rootStore.settings.terminalOperation("abort")
			} else if (isCommandOrTool(currentAsk) || currentAsk === "use_mcp_server") {
				if (hasInput(text, images)) {
					rootStore.chat.respondToAsk("noButtonClicked", text?.trim(), images)
					onSetInputValue("")
					onSetSelectedImages([])
				} else {
					rootStore.chat.respondToAsk("noButtonClicked")
				}
			}
			onSetSendingDisabled(true)
			onSetClineAsk(undefined)
			onSetEnableButtons(false)
		},
		[
			currentAsk,
			startNewTask,
			isStreaming,
			userRespondedRef,
			onSetSendingDisabled,
			onSetClineAsk,
			onSetEnableButtons,
			onSetInputValue,
			onSetSelectedImages,
		],
	)

	return { handlePrimaryButtonClick, handleSecondaryButtonClick, startNewTask }
}
