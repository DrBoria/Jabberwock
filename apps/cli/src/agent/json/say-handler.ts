import type { Notification } from "@jabberwock/types"
import type { JsonEvent } from "@/types/json-events.js"
import type { AgentStateChangeEvent } from "../events/types.js"
import { AgentLoopState } from "../state/agent-state-types.js"
import type { CommandOutputHandler } from "./command-output-handler.js"
import type { JsonAskHandler } from "./ask-handler.js"
import type { JsonEmitterState } from "./emitter-utils.js"
import {
	SKIP_SAY_TYPES,
	REASONING_KEY_OFFSET,
	getContentToSend,
	isEmptyStreamingDelta,
	buildTextEvent,
	isUserFeedback,
	parseApiReqCost,
} from "./emitter-utils.js"

export class JsonSayHandler {
	constructor(
		private state: JsonEmitterState,
		private emitEvent: (event: JsonEvent) => void,
		private mode: string,
		private commandOutputHandler: CommandOutputHandler,
		private askHandler: JsonAskHandler,
	) {}

	private getPartial(msg: Notification): boolean {
		return msg.partial ?? false
	}

	private isEmptyStreamingDelta(content: string | null): boolean {
		return isEmptyStreamingDelta(this.mode, content)
	}

	private getContentToSend(msgId: number, text: string | undefined, isPartial: boolean): string | null {
		return getContentToSend(this.mode, this.state.previousContent, msgId, text, isPartial)
	}

	handleStateChange(event: AgentStateChangeEvent): void {
		if (
			event.previousState.state === AgentLoopState.NO_TASK &&
			event.currentState.state !== AgentLoopState.NO_TASK
		) {
			this.state.expectPromptEchoAsUser = true
		}
	}

	handleMessage(msg: Notification, _isUpdate: boolean): void {
		const isDone = !msg.partial
		if (this.mode === "json" && msg.partial) return
		if (isDone && this.state.seenMessageIds.has(msg.ts)) return
		if (isDone) {
			this.state.seenMessageIds.add(msg.ts)
			this.state.previousContent.delete(msg.ts)
			this.state.previousToolUseContent.delete(msg.ts)
		}
		if (msg.type === "say") {
			this.handleSayType(msg, isDone)
			return
		}
		if (msg.type === "ask") {
			this.askHandler.handleAskType(msg, isDone)
		}
	}

	private handleSayType(msg: Notification, isDone: boolean): void {
		if (!msg.say) return
		const contentToSend = this.getContentToSend(msg.ts, msg.text, this.getPartial(msg))
		if (msg.partial && this.isEmptyStreamingDelta(contentToSend)) return
		this.handleSayMessage(msg, contentToSend, isDone)
	}

	private handleSayText(msg: Notification, contentToSend: string | null, isDone: boolean): void {
		if (this.state.expectPromptEchoAsUser) {
			this.emitEvent(buildTextEvent("user", msg.ts, contentToSend, isDone))
			if (isDone) this.state.expectPromptEchoAsUser = false
		} else {
			this.emitEvent(buildTextEvent("assistant", msg.ts, contentToSend, isDone))
			if (msg.text) this.state.lastAssistantText = msg.text
		}
	}

	private handleSayUserFeedback(msg: Notification, contentToSend: string | null, isDone: boolean): void {
		this.emitEvent(buildTextEvent("user", msg.ts, contentToSend, isDone))
		if (isDone) this.state.expectPromptEchoAsUser = false
	}

	private handleSayApiReqStarted(msg: Notification): void {
		const cost = parseApiReqCost(msg.text)
		if (cost) this.state.lastCost = cost
	}

	private handleSayCompletionResult(msg: Notification): void {
		if (msg.text && !msg.partial) this.state.completionResultContent = msg.text
	}

	private handleSayError(msg: Notification, contentToSend: string | null): void {
		this.emitEvent({ type: "error", id: msg.ts, content: contentToSend ?? undefined })
	}

	private handleSayDefault(msg: Notification, contentToSend: string | null, isDone: boolean, say: string): void {
		if (SKIP_SAY_TYPES.has(say) || !msg.text) return
		this.emitEvent(buildTextEvent("assistant", msg.ts, contentToSend, isDone, say))
	}

	private handleSayMessage(msg: Notification, contentToSend: string | null, isDone: boolean): void {
		const say = msg.say as string
		if (say === "text") {
			this.handleSayText(msg, contentToSend, isDone)
			return
		}
		if (say === "reasoning") {
			this.handleReasoningMessage(msg, isDone)
			return
		}
		if (say === "error") {
			this.handleSayError(msg, contentToSend)
			return
		}
		if (say === "command_output") {
			this.commandOutputHandler.handleCommandOutputMessage(msg, isDone)
			return
		}
		if (isUserFeedback(say)) {
			this.handleSayUserFeedback(msg, contentToSend, isDone)
			return
		}
		if (say === "api_req_started") {
			this.handleSayApiReqStarted(msg)
			return
		}
		if (say === "mcp_server_response") {
			this.emitEvent({
				type: "tool_result",
				subtype: "mcp",
				tool_result: { name: "mcp_server", output: msg.text },
			})
			return
		}
		if (say === "completion_result") {
			this.handleSayCompletionResult(msg)
			return
		}
		this.handleSayDefault(msg, contentToSend, isDone, say)
	}

	private handleReasoningMessage(msg: Notification, isDone: boolean): void {
		const reasoningContent = msg.reasoning || msg.text
		const reasoningKey = msg.ts + REASONING_KEY_OFFSET
		const reasoningDelta = this.getContentToSend(reasoningKey, reasoningContent, this.getPartial(msg))
		if (msg.partial && this.isEmptyStreamingDelta(reasoningDelta)) return
		if (!msg.partial) this.state.previousContent.delete(reasoningKey)
		this.emitEvent(buildTextEvent("thinking", msg.ts, reasoningDelta, isDone))
	}
}
