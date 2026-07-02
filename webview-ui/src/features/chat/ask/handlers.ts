import type { Notification, SayToolData, AudioType } from "@jabberwock/types"
import type { IChatUIStore } from "../store"
import { getToolButtonLabels } from "./tool-labels"

export function handleApiReqFailedAsk(
	ui: IChatUIStore,
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	ui.textArea.setSendingDisabled(true)
	ui.setCurrentAsk("api_req_failed")
	ui.setEnableButtons(true)
	ui.setPrimaryButtonText(t("chat:retry.title"))
	ui.setSecondaryButtonText(t("chat:startNewTask.title"))
	return "progress_loop"
}

export function handleMistakeLimitReachedAsk(
	ui: IChatUIStore,
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	ui.textArea.setSendingDisabled(false)
	ui.setCurrentAsk("mistake_limit_reached")
	ui.setEnableButtons(true)
	ui.setPrimaryButtonText(t("chat:proceedAnyways.title"))
	ui.setSecondaryButtonText(t("chat:startNewTask.title"))
	return "progress_loop"
}

export function handleFollowUpAsk(ui: IChatUIStore, isPartial: boolean): AudioType | undefined {
	ui.textArea.setSendingDisabled(isPartial)
	ui.setCurrentAsk("followup")
	ui.setEnableButtons(true)
	ui.setPrimaryButtonText("")
	ui.setSecondaryButtonText("")
	return undefined
}

export function handleToolAsk(
	ui: IChatUIStore,
	isPartial: boolean,
	lastMessage: Notification,
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	ui.textArea.setSendingDisabled(isPartial)
	ui.setCurrentAsk("tool")
	ui.setEnableButtons(!isPartial)
	try {
		const tool = JSON.parse(lastMessage.text || "{}") as SayToolData
		const { primary, secondary } = getToolButtonLabels(tool, t)
		ui.setPrimaryButtonText(primary)
		ui.setSecondaryButtonText(secondary)
	} catch {
		ui.setPrimaryButtonText(t("chat:approve.title"))
		ui.setSecondaryButtonText(t("chat:reject.title"))
	}
	return undefined
}

export function handleCommandAsk(
	ui: IChatUIStore,
	isPartial: boolean,
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	ui.textArea.setSendingDisabled(isPartial)
	ui.setCurrentAsk("command")
	ui.setEnableButtons(!isPartial)
	ui.setPrimaryButtonText(t("chat:runCommand.title"))
	ui.setSecondaryButtonText(t("chat:reject.title"))
	return undefined
}

export function handleCommandOutputAsk(
	ui: IChatUIStore,
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	ui.textArea.setSendingDisabled(false)
	ui.setCurrentAsk("command_output")
	ui.setEnableButtons(true)
	ui.setPrimaryButtonText(t("chat:proceedWhileRunning.title"))
	ui.setSecondaryButtonText(t("chat:killCommand.title"))
	return undefined
}

export function handleUseMcpServerAsk(
	ui: IChatUIStore,
	isPartial: boolean,
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	ui.textArea.setSendingDisabled(isPartial)
	ui.setCurrentAsk("use_mcp_server")
	ui.setEnableButtons(!isPartial)
	ui.setPrimaryButtonText(t("chat:approve.title"))
	ui.setSecondaryButtonText(t("chat:reject.title"))
	return undefined
}

export function handleInteractiveAppAsk(ui: IChatUIStore, isPartial: boolean): AudioType | undefined {
	ui.textArea.setSendingDisabled(isPartial)
	ui.setCurrentAsk("")
	ui.setEnableButtons(false)
	ui.setPrimaryButtonText("")
	ui.setSecondaryButtonText("")
	return undefined
}

export function handleCompletionResultAsk(
	ui: IChatUIStore,
	isPartial: boolean,
	messageQueue: { id: string }[],
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	const soundType = !isPartial && messageQueue.length === 0 ? ("celebration" as AudioType) : undefined
	ui.textArea.setSendingDisabled(isPartial)
	ui.setCurrentAsk("completion_result")
	ui.setEnableButtons(!isPartial)
	ui.setPrimaryButtonText(t("chat:startNewTask.title"))
	ui.setSecondaryButtonText("")
	return soundType
}

export function handleResumeTaskAsk(
	ui: IChatUIStore,
	currentTaskItem: { parentTaskId?: string } | undefined,
	messages: Notification[],
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	ui.textArea.setSendingDisabled(false)
	ui.setCurrentAsk("resume_task")
	ui.setEnableButtons(true)
	const isCompletedSubtask =
		currentTaskItem?.parentTaskId &&
		messages.some((msg) => msg.ask === "completion_result" || msg.say === "completion_result")
	ui.setPrimaryButtonText(isCompletedSubtask ? t("chat:startNewTask.title") : t("chat:resumeTask.title"))
	ui.setSecondaryButtonText(isCompletedSubtask ? "" : t("chat:terminate.title"))
	return undefined
}

export function handleResumeCompletedTaskAsk(
	ui: IChatUIStore,
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	ui.textArea.setSendingDisabled(false)
	ui.setCurrentAsk("resume_completed_task")
	ui.setEnableButtons(true)
	ui.setPrimaryButtonText(t("chat:startNewTask.title"))
	ui.setSecondaryButtonText("")
	return undefined
}

export function handleSayMessage(ui: IChatUIStore, lastMessage: Notification): void {
	switch (lastMessage.say) {
		case "api_req_retry_delayed":
		case "api_req_rate_limit_wait":
			ui.textArea.setSendingDisabled(true)
			break
		case "api_req_started":
			ui.textArea.setSendingDisabled(true)
			ui.setCurrentAsk("")
			ui.setEnableButtons(false)
			ui.setPrimaryButtonText("")
			ui.setSecondaryButtonText("")
			break
	}
}

export function clearAskUI(ui: IChatUIStore): void {
	ui.setCurrentAsk("")
	ui.setEnableButtons(false)
	ui.setPrimaryButtonText("")
	ui.setSecondaryButtonText("")
}
