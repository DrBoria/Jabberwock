import type { NotificationAsk, Notification } from "@jabberwock/types"

export interface MessageActions {
	handleSendMessage: (text: string, images: string[]) => void
	handlePrimaryButtonClick: (text?: string, images?: string[]) => void
	handleSecondaryButtonClick: (text?: string, images?: string[]) => void
	handleChatReset: (shouldPostMessage?: boolean) => void
	startNewTask: () => void
	markFollowUpAsAnswered: () => void
	handleStopTask: () => void
	handleEnqueueCurrentMessage: (text: string, images: string[]) => void
	handleSetChatBoxMessage: (text: string, images: string[]) => void
	handleSuggestionClick: (
		suggestion: { answer: string; mode?: string; id?: string },
		event: React.MouseEvent | undefined,
		_store: { navigateToNode: (id: string) => void },
		alwaysAllowModeSwitch: boolean,
	) => void
	handleBatchFileResponse: (response: { [key: string]: boolean }) => void
	handleFollowUpUnmount: () => void
}

export const isMessageBlocked = (
	sendingDisabled: boolean,
	isStreaming: boolean,
	messageQueueLength: number,
	currentAsk: NotificationAsk | undefined,
): boolean => sendingDisabled || isStreaming || messageQueueLength > 0 || currentAsk === "command_output"

export const hasInput = (text: string | undefined, images: string[] | undefined): boolean =>
	!!(text?.trim() || (images && images.length > 0))

export const isSubtaskWithCompletionResult = (
	currentTaskItem: { parentTaskId?: string; id?: string } | undefined,
	messages: Notification[],
): boolean =>
	!!(
		currentTaskItem?.parentTaskId &&
		messages.some((msg) => msg.ask === "completion_result" || msg.say === "completion_result")
	)

export const isCompletionResult = (currentAsk: NotificationAsk | undefined): boolean =>
	currentAsk === "completion_result" || currentAsk === "resume_completed_task"

export const isRestartOnSecondary = (currentAsk: NotificationAsk | undefined): boolean =>
	currentAsk === "api_req_failed" || currentAsk === "mistake_limit_reached"

export const isCommandOrTool = (currentAsk: NotificationAsk | undefined): boolean =>
	currentAsk === "command" || currentAsk === "tool"
