import type { Notification } from "@jabberwock/types"
import type { JsonEvent } from "@/types/json-events.js"
import type { CommandOutputHandler } from "./command-output-handler.js"
import type { JsonEmitterState } from "./delta.js"
import {
	getContentToSend,
	isEmptyStreamingDelta,
	buildTextEvent,
	computeStructuredDelta,
	parseToolInfo,
} from "./delta.js"

export function createJsonAskHandler(
	state: JsonEmitterState,
	emitEvent: (event: JsonEvent) => void,
	mode: string,
	commandOutputHandler: CommandOutputHandler,
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

	function computeStructuredDeltaFn(msgId: number, fullContent: string | undefined): string | null {
		return computeStructuredDelta(state.previousToolUseContent, msgId, fullContent)
	}

	function isStreamingPartial(msg: Notification): boolean {
		return mode === "stream-json" && msg.partial === true
	}

	function handleAskType(msg: Notification, isDone: boolean): void {
		if (!msg.ask) return
		handleAskMessage(msg, isDone)
	}

	function handleFollowupAsk(msg: Notification, isDone: boolean): void {
		const contentToSend = getContentToSendFn(msg.ts, msg.text, getPartial(msg))
		if (msg.partial && isEmptyStreamingDeltaCheck(contentToSend)) return
		emitEvent(buildTextEvent("assistant", msg.ts, contentToSend, isDone, "followup"))
	}

	function handleCompletionResultAsk(msg: Notification): void {
		if (msg.text && !msg.partial) state.completionResultContent = msg.text
	}

	function handleDefaultAsk(msg: Notification, isDone: boolean, ask: string): void {
		if (!msg.text) return
		const contentToSend = getContentToSendFn(msg.ts, msg.text, getPartial(msg))
		if (msg.partial && isEmptyStreamingDeltaCheck(contentToSend)) return
		emitEvent(buildTextEvent("assistant", msg.ts, contentToSend, isDone, ask))
	}

	function handleAskMessage(msg: Notification, isDone: boolean): void {
		const ask = msg.ask as string
		if (ask === "tool" || ask === "command" || ask === "use_mcp_server") {
			handleToolUseAsk(msg, ask === "use_mcp_server" ? "mcp" : (ask as "tool" | "command"), isDone)
			return
		}
		if (ask === "followup") {
			handleFollowupAsk(msg, isDone)
			return
		}
		if (ask === "command_output") return
		if (ask === "completion_result") {
			handleCompletionResultAsk(msg)
			return
		}
		handleDefaultAsk(msg, isDone, ask)
	}

	function handleToolUseAsk(msg: Notification, subtype: "tool" | "command" | "mcp", isDone: boolean): void {
		if (subtype === "command") {
			commandOutputHandler.handleToolUseAskCommand(msg, isDone)
			emitToolUseCommandContent(msg, isDone)
			return
		}
		if (subtype === "mcp") {
			handleToolUseAskMcp(msg, isDone)
			return
		}
		handleToolUseAskTool(msg, isDone)
	}

	function emitToolUseCommandContent(msg: Notification, isDone: boolean): void {
		if (isStreamingPartial(msg)) {
			const commandDelta = computeStructuredDeltaFn(msg.ts, msg.text)
			if (commandDelta === null) return
			emitEvent({
				type: "tool_use",
				id: msg.ts,
				subtype: "command",
				content: commandDelta,
				tool_use: { name: "execute_command", input: { command: commandDelta } },
			})
			return
		}
		emitEvent({
			type: "tool_use",
			id: msg.ts,
			subtype: "command",
			tool_use: { name: "execute_command", input: { command: msg.text } },
			...(isDone ? { done: true } : {}),
		})
	}

	function handleToolUseAskMcp(msg: Notification, isDone: boolean): void {
		if (isStreamingPartial(msg)) {
			const mcpDelta = computeStructuredDeltaFn(msg.ts, msg.text)
			if (mcpDelta === null) return
			emitEvent({
				type: "tool_use",
				id: msg.ts,
				subtype: "mcp",
				content: mcpDelta,
				tool_use: { name: "mcp_server" },
			})
			return
		}
		emitEvent({
			type: "tool_use",
			id: msg.ts,
			subtype: "mcp",
			tool_use: { name: "mcp_server", input: { raw: msg.text } },
			...(isDone ? { done: true } : {}),
		})
	}

	function handleToolUseAskTool(msg: Notification, isDone: boolean): void {
		if (isStreamingPartial(msg)) {
			const toolDelta = computeStructuredDeltaFn(msg.ts, msg.text)
			if (toolDelta === null) return
			emitEvent({
				type: "tool_use",
				id: msg.ts,
				subtype: "tool",
				content: toolDelta,
				tool_use: { name: parseToolInfo(msg.text)?.name ?? "unknown_tool" },
			})
			return
		}
		const toolInfo = parseToolInfo(msg.text)
		emitEvent({
			type: "tool_use",
			id: msg.ts,
			subtype: "tool",
			tool_use: toolInfo ?? { name: "unknown_tool", input: { raw: msg.text } },
			...(isDone ? { done: true } : {}),
		})
	}

	function handleTaskCompleted(event: { message?: { ts: number; text?: string }; success: boolean }): void {
		const resultContent = event.message?.text || state.completionResultContent || state.lastAssistantText
		emitEvent({
			type: "result",
			id: event.message?.ts ?? Date.now(),
			content: resultContent,
			done: true,
			success: event.success,
			cost: state.lastCost,
		})
		state.completionResultContent = undefined
		state.lastAssistantText = undefined
	}

	function handleError(error: Error): void {
		emitEvent({ type: "error", id: Date.now(), content: error.message })
	}

	return { handleAskType, handleTaskCompleted, handleError }
}

/** JsonAskHandler instance type */
export type JsonAskHandler = ReturnType<typeof createJsonAskHandler>
