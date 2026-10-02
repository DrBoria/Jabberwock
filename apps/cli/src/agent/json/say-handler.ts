import type { Notification } from "@jabberwock/types"
import type { JsonEvent } from "@/types/json-events.js"
import type { AgentStateChangeEvent } from "../events/types.js"
import { AgentLoopState } from "../state/types.js"
import type { CommandOutputHandler } from "./command-output-handler.js"
import type { JsonAskHandler } from "./ask-handler.js"
import type { JsonEmitterState } from "./delta.js"
import {
	SKIP_SAY_TYPES,
	REASONING_KEY_OFFSET,
	getContentToSend,
	isEmptyStreamingDelta,
	buildTextEvent,
	isUserFeedback,
	parseApiReqCost,
} from "./delta.js"

export function createJsonSayHandler(
	state: JsonEmitterState,
	emitEvent: (event: JsonEvent) => void,
	mode: string,
	commandOutputHandler: CommandOutputHandler,
	askHandler: JsonAskHandler,
) {
	function getPartial(msg: Notification): boolean {
		return msg.partial ?? false
	}

	function isEmptyStreamingDeltaCheck(content: string | null): boolean {
		return isEmptyStreamingDelta(mode, content)
	}

	function getContentToSendFn(msgId: number, text: string | undefined, isPartial: boolean): string | null {
		return getContentToSend(mode, state.previousContent, msgId, text, isPartial)
	}

	function handleStateChange(event: AgentStateChangeEvent): void {
		if (
			event.previousState.state === AgentLoopState.NO_TASK &&
			event.currentState.state !== AgentLoopState.NO_TASK
		) {
			state.expectPromptEchoAsUser = true
		}
	}

	function handleMessage(msg: Notification, _isUpdate: boolean): void {
		const isDone = !msg.partial
		if (mode === "json" && msg.partial) return
		if (isDone && state.seenMessageIds.has(msg.ts)) return
		if (isDone) {
			state.seenMessageIds.add(msg.ts)
			state.previousContent.delete(msg.ts)
			state.previousToolUseContent.delete(msg.ts)
		}
		if (msg.type === "say") {
			handleSayType(msg, isDone)
			return
		}
		if (msg.type === "ask") {
			askHandler.handleAskType(msg, isDone)
		}
	}

	function handleSayType(msg: Notification, isDone: boolean): void {
		if (!msg.say) return
		const contentToSend = getContentToSendFn(msg.ts, msg.text, getPartial(msg))
		if (msg.partial && isEmptyStreamingDeltaCheck(contentToSend)) return
		handleSayMessage(msg, contentToSend, isDone)
	}

	function handleSayText(msg: Notification, contentToSend: string | null, isDone: boolean): void {
		if (state.expectPromptEchoAsUser) {
			emitEvent(buildTextEvent("user", msg.ts, contentToSend, isDone))
			if (isDone) state.expectPromptEchoAsUser = false
		} else {
			emitEvent(buildTextEvent("assistant", msg.ts, contentToSend, isDone))
			if (msg.text) state.lastAssistantText = msg.text
		}
	}

	function handleSayUserFeedback(msg: Notification, contentToSend: string | null, isDone: boolean): void {
		emitEvent(buildTextEvent("user", msg.ts, contentToSend, isDone))
		if (isDone) state.expectPromptEchoAsUser = false
	}

	function handleSayApiReqStarted(msg: Notification): void {
		const cost = parseApiReqCost(msg.text)
		if (cost) state.lastCost = cost
	}

	function handleSayCompletionResult(msg: Notification): void {
		if (msg.text && !msg.partial) state.completionResultContent = msg.text
	}

	function handleSayError(msg: Notification, contentToSend: string | null): void {
		emitEvent({ type: "error", id: msg.ts, content: contentToSend ?? undefined })
	}

	function handleSayDefault(msg: Notification, contentToSend: string | null, isDone: boolean, say: string): void {
		if (SKIP_SAY_TYPES.has(say) || !msg.text) return
		emitEvent(buildTextEvent("assistant", msg.ts, contentToSend, isDone, say))
	}

	function handleSayMessage(msg: Notification, contentToSend: string | null, isDone: boolean): void {
		const say = msg.say as string
		if (say === "text") {
			handleSayText(msg, contentToSend, isDone)
			return
		}
		if (say === "reasoning") {
			handleReasoningMessage(msg, isDone)
			return
		}
		if (say === "error") {
			handleSayError(msg, contentToSend)
			return
		}
		if (say === "command_output") {
			commandOutputHandler.handleCommandOutputMessage(msg, isDone)
			return
		}
		if (isUserFeedback(say)) {
			handleSayUserFeedback(msg, contentToSend, isDone)
			return
		}
		if (say === "api_req_started") {
			handleSayApiReqStarted(msg)
			return
		}
		if (say === "mcp_server_response") {
			emitEvent({
				type: "tool_result",
				subtype: "mcp",
				tool_result: { name: "mcp_server", output: msg.text },
			})
			return
		}
		if (say === "completion_result") {
			handleSayCompletionResult(msg)
			return
		}
		handleSayDefault(msg, contentToSend, isDone, say)
	}

	function handleReasoningMessage(msg: Notification, isDone: boolean): void {
		const reasoningContent = msg.reasoning || msg.text
		const reasoningKey = msg.ts + REASONING_KEY_OFFSET
		const reasoningDelta = getContentToSendFn(reasoningKey, reasoningContent, getPartial(msg))
		if (msg.partial && isEmptyStreamingDeltaCheck(reasoningDelta)) return
		if (!msg.partial) state.previousContent.delete(reasoningKey)
		emitEvent(buildTextEvent("thinking", msg.ts, reasoningDelta, isDone))
	}

	return { handleStateChange, handleMessage }
}

/** JsonSayHandler instance type */
export type JsonSayHandler = ReturnType<typeof createJsonSayHandler>
