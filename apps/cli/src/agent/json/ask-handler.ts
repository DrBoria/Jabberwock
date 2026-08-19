import type { Notification } from "@jabberwock/types"
import type { JsonEvent } from "@/types/json-events.js"
import type { CommandOutputHandler } from "./command-output-handler.js"
import type { JsonEmitterState } from "./emitter-utils.js"
import {
	getContentToSend,
	isEmptyStreamingDelta,
	buildTextEvent,
	computeStructuredDelta,
	parseToolInfo,
} from "./emitter-utils.js"

export class JsonAskHandler {
	constructor(
		private state: JsonEmitterState,
		private emitEvent: (event: JsonEvent) => void,
		private mode: string,
		private commandOutputHandler: CommandOutputHandler,
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

	private computeStructuredDeltaFn(msgId: number, fullContent: string | undefined): string | null {
		return computeStructuredDelta(this.state.previousToolUseContent, msgId, fullContent)
	}

	private isStreamingPartial(msg: Notification): boolean {
		return this.mode === "stream-json" && msg.partial === true
	}

	handleAskType(msg: Notification, isDone: boolean): void {
		if (!msg.ask) return
		this.handleAskMessage(msg, isDone)
	}

	private handleFollowupAsk(msg: Notification, isDone: boolean): void {
		const contentToSend = this.getContentToSend(msg.ts, msg.text, this.getPartial(msg))
		if (msg.partial && this.isEmptyStreamingDelta(contentToSend)) return
		this.emitEvent(buildTextEvent("assistant", msg.ts, contentToSend, isDone, "followup"))
	}

	private handleCompletionResultAsk(msg: Notification): void {
		if (msg.text && !msg.partial) this.state.completionResultContent = msg.text
	}

	private handleDefaultAsk(msg: Notification, isDone: boolean, ask: string): void {
		if (!msg.text) return
		const contentToSend = this.getContentToSend(msg.ts, msg.text, this.getPartial(msg))
		if (msg.partial && this.isEmptyStreamingDelta(contentToSend)) return
		this.emitEvent(buildTextEvent("assistant", msg.ts, contentToSend, isDone, ask))
	}

	private handleAskMessage(msg: Notification, isDone: boolean): void {
		const ask = msg.ask as string
		if (ask === "tool" || ask === "command" || ask === "use_mcp_server") {
			this.handleToolUseAsk(msg, ask === "use_mcp_server" ? "mcp" : (ask as "tool" | "command"), isDone)
			return
		}
		if (ask === "followup") {
			this.handleFollowupAsk(msg, isDone)
			return
		}
		if (ask === "command_output") return
		if (ask === "completion_result") {
			this.handleCompletionResultAsk(msg)
			return
		}
		this.handleDefaultAsk(msg, isDone, ask)
	}

	private handleToolUseAsk(msg: Notification, subtype: "tool" | "command" | "mcp", isDone: boolean): void {
		if (subtype === "command") {
			this.commandOutputHandler.handleToolUseAskCommand(msg, isDone)
			this.emitToolUseCommandContent(msg, isDone)
			return
		}
		if (subtype === "mcp") {
			this.handleToolUseAskMcp(msg, isDone)
			return
		}
		this.handleToolUseAskTool(msg, isDone)
	}

	private emitToolUseCommandContent(msg: Notification, isDone: boolean): void {
		if (this.isStreamingPartial(msg)) {
			const commandDelta = this.computeStructuredDeltaFn(msg.ts, msg.text)
			if (commandDelta === null) return
			this.emitEvent({
				type: "tool_use",
				id: msg.ts,
				subtype: "command",
				content: commandDelta,
				tool_use: { name: "execute_command", input: { command: commandDelta } },
			})
			return
		}
		this.emitEvent({
			type: "tool_use",
			id: msg.ts,
			subtype: "command",
			tool_use: { name: "execute_command", input: { command: msg.text } },
			...(isDone ? { done: true } : {}),
		})
	}

	private handleToolUseAskMcp(msg: Notification, isDone: boolean): void {
		if (this.isStreamingPartial(msg)) {
			const mcpDelta = this.computeStructuredDeltaFn(msg.ts, msg.text)
			if (mcpDelta === null) return
			this.emitEvent({
				type: "tool_use",
				id: msg.ts,
				subtype: "mcp",
				content: mcpDelta,
				tool_use: { name: "mcp_server" },
			})
			return
		}
		this.emitEvent({
			type: "tool_use",
			id: msg.ts,
			subtype: "mcp",
			tool_use: { name: "mcp_server", input: { raw: msg.text } },
			...(isDone ? { done: true } : {}),
		})
	}

	private handleToolUseAskTool(msg: Notification, isDone: boolean): void {
		if (this.isStreamingPartial(msg)) {
			const toolDelta = this.computeStructuredDeltaFn(msg.ts, msg.text)
			if (toolDelta === null) return
			this.emitEvent({
				type: "tool_use",
				id: msg.ts,
				subtype: "tool",
				content: toolDelta,
				tool_use: { name: parseToolInfo(msg.text)?.name ?? "unknown_tool" },
			})
			return
		}
		const toolInfo = parseToolInfo(msg.text)
		this.emitEvent({
			type: "tool_use",
			id: msg.ts,
			subtype: "tool",
			tool_use: toolInfo ?? { name: "unknown_tool", input: { raw: msg.text } },
			...(isDone ? { done: true } : {}),
		})
	}

	handleTaskCompleted(event: { message?: { ts: number; text?: string }; success: boolean }): void {
		const resultContent = event.message?.text || this.state.completionResultContent || this.state.lastAssistantText
		this.emitEvent({
			type: "result",
			id: event.message?.ts ?? Date.now(),
			content: resultContent,
			done: true,
			success: event.success,
			cost: this.state.lastCost,
		})
		this.state.completionResultContent = undefined
		this.state.lastAssistantText = undefined
	}

	handleError(error: Error): void {
		this.emitEvent({ type: "error", id: Date.now(), content: error.message })
	}
}
