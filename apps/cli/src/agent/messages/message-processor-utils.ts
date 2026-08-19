import type { Notification } from "@jabberwock/types"
import { debugLog } from "@jabberwock/core/cli"
import type { TypedEventEmitter } from "../events/typed-emitter.js"
import type { AgentStateChangeEvent, WaitingForInputEvent, TaskCompletedEvent } from "../events/types.js"
import {
	isSignificantStateChange,
	transitionedToWaiting,
	transitionedToRunning,
	streamingStarted,
	streamingEnded,
	taskCompleted,
} from "../events/state-detectors.js"
import type { AgentStateInfo } from "../state/index.js"

export function buildStateUpdateInfo(
	previousState: AgentStateInfo,
	currentState: AgentStateInfo,
	messages: Notification[],
): Record<string, unknown> {
	const lastMsg = messages[messages.length - 1]
	const lastMsgInfo = lastMsg
		? {
				msgType: lastMsg.type === "ask" ? `ask:${lastMsg.ask}` : `say:${lastMsg.say}`,
				partial: lastMsg.partial,
				textPreview: lastMsg.text?.substring(0, 50),
			}
		: null
	return {
		messageCount: messages.length,
		lastMessage: lastMsgInfo,
		stateTransition: `${previousState.state} → ${currentState.state}`,
		currentAsk: currentState.currentAsk,
		isWaitingForInput: currentState.isWaitingForInput,
		isStreaming: currentState.isStreaming,
		isRunning: currentState.isRunning,
	}
}

export function emitStateChangeEvents(
	emitter: TypedEventEmitter,
	emitAllStateChanges: boolean,
	previousState: AgentStateInfo,
	currentState: AgentStateInfo,
): void {
	const isSignificant = isSignificantStateChange(previousState, currentState)

	if (emitAllStateChanges || isSignificant) {
		emitter.emit("stateChange", {
			previousState,
			currentState,
			isSignificantChange: isSignificant,
		} as AgentStateChangeEvent)
	}

	if (transitionedToWaiting(previousState, currentState) && currentState.currentAsk && currentState.lastMessage) {
		debugLog("[MessageProcessor] EMIT waitingForInput", {
			ask: currentState.currentAsk,
			action: currentState.requiredAction,
		})
		emitter.emit("waitingForInput", {
			ask: currentState.currentAsk,
			stateInfo: currentState,
			message: currentState.lastMessage,
		} as WaitingForInputEvent)
	}

	if (transitionedToRunning(previousState, currentState)) {
		debugLog("[MessageProcessor] EMIT resumedRunning")
		emitter.emit("resumedRunning", undefined as void)
	}
	if (streamingStarted(previousState, currentState)) {
		debugLog("[MessageProcessor] EMIT streamingStarted")
		emitter.emit("streamingStarted", undefined as void)
	}
	if (streamingEnded(previousState, currentState)) {
		debugLog("[MessageProcessor] EMIT streamingEnded")
		emitter.emit("streamingEnded", undefined as void)
	}

	if (taskCompleted(previousState, currentState)) {
		const success = ["completion_result", "resume_completed_task"].includes(currentState.currentAsk as string)
		debugLog("[MessageProcessor] EMIT taskCompleted", { success })
		emitter.emit("taskCompleted", {
			success,
			stateInfo: currentState,
			message: currentState.lastMessage,
		} as TaskCompletedEvent)
	}
}

export function emitNewMessageEvents(emitter: TypedEventEmitter, messages: Notification[]): void {
	const lastMessage = messages[messages.length - 1]
	if (lastMessage) {
		emitter.emit("message", lastMessage)
	}
}
