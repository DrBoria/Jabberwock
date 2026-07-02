import { types, Instance, getParent } from "mobx-state-tree"
import type { Notification, AudioType } from "@jabberwock/types"
import type { IChatStore, IChatUIStore } from "../store"
import * as H from "./handlers"
import { processSimpleAsk, processComplexAsk, computeAskDerivedState } from "./orchestrators"

export const AskStore = types.model("AskStore", {}).actions((self) => {
	function getUI(): IChatUIStore {
		return getParent(self) as IChatStore
	}

	return {
		processAskMessage(
			messages: Notification[],
			currentTaskItem: { id?: string; parentTaskId?: string; ts?: number } | undefined,
			messageQueue: { id: string }[],
			inputValue: string,
			t: (key: string, options?: Record<string, unknown>) => string,
		): AudioType | undefined {
			const lastMessage = messages.at(-1)
			if (!lastMessage) return undefined
			const ui = getUI()
			let soundType: AudioType | undefined
			if (lastMessage.type === "ask" && lastMessage.isAnswered) H.clearAskUI(ui)
			else if (lastMessage.type === "ask") {
				const isPartial = lastMessage.partial === true
				soundType = processSimpleAsk(ui, lastMessage, isPartial, t)
				if (soundType === undefined)
					soundType = processComplexAsk(
						ui,
						lastMessage,
						isPartial,
						messageQueue,
						currentTaskItem,
						messages,
						t,
					)
			} else if (lastMessage.type === "say") H.handleSayMessage(ui, lastMessage)
			computeAskDerivedState(ui, messages, currentTaskItem, inputValue)
			return soundType
		},
		handleApiReqFailedAsk(t: (key: string, options?: Record<string, unknown>) => string): AudioType | undefined {
			return H.handleApiReqFailedAsk(getUI(), t)
		},
		handleMistakeLimitReachedAsk(
			t: (key: string, options?: Record<string, unknown>) => string,
		): AudioType | undefined {
			return H.handleMistakeLimitReachedAsk(getUI(), t)
		},
		handleFollowUpAsk(isPartial: boolean): AudioType | undefined {
			return H.handleFollowUpAsk(getUI(), isPartial)
		},
		handleToolAsk(
			isPartial: boolean,
			lastMessage: Notification,
			t: (key: string, options?: Record<string, unknown>) => string,
		): AudioType | undefined {
			return H.handleToolAsk(getUI(), isPartial, lastMessage, t)
		},
		handleCommandAsk(
			isPartial: boolean,
			t: (key: string, options?: Record<string, unknown>) => string,
		): AudioType | undefined {
			return H.handleCommandAsk(getUI(), isPartial, t)
		},
		handleCommandOutputAsk(t: (key: string, options?: Record<string, unknown>) => string): AudioType | undefined {
			return H.handleCommandOutputAsk(getUI(), t)
		},
		handleUseMcpServerAsk(
			isPartial: boolean,
			t: (key: string, options?: Record<string, unknown>) => string,
		): AudioType | undefined {
			return H.handleUseMcpServerAsk(getUI(), isPartial, t)
		},
		handleInteractiveAppAsk(isPartial: boolean): AudioType | undefined {
			return H.handleInteractiveAppAsk(getUI(), isPartial)
		},
		handleCompletionResultAsk(
			isPartial: boolean,
			messageQueue: { id: string }[],
			t: (key: string, options?: Record<string, unknown>) => string,
		): AudioType | undefined {
			return H.handleCompletionResultAsk(getUI(), isPartial, messageQueue, t)
		},
		handleResumeTaskAsk(
			currentTaskItem: { parentTaskId?: string } | undefined,
			messages: Notification[],
			t: (key: string, options?: Record<string, unknown>) => string,
		): AudioType | undefined {
			return H.handleResumeTaskAsk(getUI(), currentTaskItem, messages, t)
		},
		handleResumeCompletedTaskAsk(
			t: (key: string, options?: Record<string, unknown>) => string,
		): AudioType | undefined {
			return H.handleResumeCompletedTaskAsk(getUI(), t)
		},
		handleSayMessage(lastMessage: Notification): void {
			H.handleSayMessage(getUI(), lastMessage)
		},
		updateResumeTaskButton(
			messages: Notification[],
			currentTaskItem: { parentTaskId?: string } | undefined,
			t: (key: string, options?: Record<string, unknown>) => string,
		) {
			const ui = getUI()
			if (
				ui.currentAsk === "resume_task" &&
				currentTaskItem?.parentTaskId &&
				messages.some((msg) => msg.ask === "completion_result" || msg.say === "completion_result")
			) {
				ui.setPrimaryButtonText(t("chat:startNewTask.title"))
				ui.setSecondaryButtonText("")
			}
		},
		resetAskState() {
			const ui = getUI()
			ui.setCurrentAsk("")
			ui.setEnableButtons(false)
			ui.setPrimaryButtonText("")
			ui.setSecondaryButtonText("")
			ui.textArea.setSendingDisabled(false)
		},
	}
})

export type IAskStore = Instance<typeof AskStore>
