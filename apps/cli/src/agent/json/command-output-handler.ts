import type { JsonEvent } from "@/types/json-events.js"
import { COMMAND_OUTPUT_EXIT_GRACE_MS } from "./emitter-utils.js"

export class CommandOutputHandler {
	activeCommandToolUseId: number | undefined
	private previousCommandOutputByToolUseId = new Map<number, string>()
	private statusDrivenCommandOutputIds = new Set<number>()
	private completedCommandOutputIds = new Set<number>()
	private pendingCommandCompletionByToolUseId = new Map<number, { exitCode?: number; timer: NodeJS.Timeout }>()

	constructor(
		private emitEvent: (event: JsonEvent) => void,
		private mode: string,
	) {}

	private computeCommandOutputDelta(commandId: number, fullOutput: string | undefined): string | null {
		const normalized = fullOutput ?? ""
		const previous = this.previousCommandOutputByToolUseId.get(commandId) || ""
		if (normalized === previous) return null
		this.previousCommandOutputByToolUseId.set(commandId, normalized)
		return normalized.startsWith(previous) ? normalized.slice(previous.length) : normalized
	}

	private clearPendingCommandCompletion(commandId: number): void {
		const pending = this.pendingCommandCompletionByToolUseId.get(commandId)
		if (!pending) return
		clearTimeout(pending.timer)
		this.pendingCommandCompletionByToolUseId.delete(commandId)
	}

	private emitCommandOutputEventCleanup(commandId: number): void {
		this.clearPendingCommandCompletion(commandId)
		this.previousCommandOutputByToolUseId.delete(commandId)
		this.statusDrivenCommandOutputIds.delete(commandId)
		this.completedCommandOutputIds.add(commandId)
		if (this.activeCommandToolUseId === commandId) {
			this.activeCommandToolUseId = undefined
		}
	}

	private emitCommandOutputEventStreamJson(
		commandId: number,
		fullOutput: string | undefined,
		isDone: boolean,
		exitCode?: number,
	): void {
		const outputDelta = this.computeCommandOutputDelta(commandId, fullOutput)
		const event: JsonEvent = {
			type: "tool_result",
			id: commandId,
			subtype: "command",
			tool_result: { name: "execute_command" },
		}
		if (outputDelta !== null && outputDelta.length > 0) {
			event.tool_result = { name: "execute_command", output: outputDelta }
		}
		if (isDone && exitCode !== undefined) {
			event.tool_result = { ...(event.tool_result ?? { name: "execute_command" }), exitCode }
		}
		if (isDone) {
			event.done = true
			this.emitCommandOutputEventCleanup(commandId)
		}
		if (!isDone && outputDelta === null) return
		this.emitEvent(event)
	}

	private emitCommandOutputEvent(
		commandId: number,
		fullOutput: string | undefined,
		isDone: boolean,
		exitCode?: number,
	): void {
		if (this.mode === "stream-json") {
			this.emitCommandOutputEventStreamJson(commandId, fullOutput, isDone, exitCode)
			return
		}
		this.emitEvent({
			type: "tool_result",
			id: commandId,
			subtype: "command",
			tool_result: {
				name: "execute_command",
				output: fullOutput,
				...(isDone && exitCode !== undefined ? { exitCode } : {}),
			},
			...(isDone ? { done: true } : {}),
		})
		if (isDone) this.emitCommandOutputEventCleanup(commandId)
	}

	emitCommandOutputChunk(outputSnapshot: string): void {
		const commandId = this.activeCommandToolUseId
		if (commandId === undefined) return
		this.statusDrivenCommandOutputIds.add(commandId)
		this.emitCommandOutputEvent(commandId, outputSnapshot, false)
	}

	markCommandOutputExited(exitCode?: number): void {
		const commandId = this.activeCommandToolUseId
		if (commandId === undefined) return
		this.statusDrivenCommandOutputIds.add(commandId)
		this.clearPendingCommandCompletion(commandId)
		const timer = setTimeout(() => {
			if (!this.pendingCommandCompletionByToolUseId.has(commandId)) return
			this.pendingCommandCompletionByToolUseId.delete(commandId)
			this.emitCommandOutputEvent(commandId, undefined, true, exitCode)
		}, COMMAND_OUTPUT_EXIT_GRACE_MS)
		timer.unref?.()
		this.pendingCommandCompletionByToolUseId.set(commandId, { exitCode, timer })
	}

	emitCommandOutputDone(exitCode?: number): void {
		const commandId = this.activeCommandToolUseId
		if (commandId === undefined) return
		this.statusDrivenCommandOutputIds.add(commandId)
		this.emitCommandOutputEvent(commandId, undefined, true, exitCode)
	}

	handleToolUseAskCommand(msg: { ts: number; text?: string; partial?: boolean }, _isDone: boolean): void {
		if (this.activeCommandToolUseId !== undefined && this.activeCommandToolUseId !== msg.ts) {
			const pending = this.pendingCommandCompletionByToolUseId.get(this.activeCommandToolUseId)
			if (pending) {
				clearTimeout(pending.timer)
				this.pendingCommandCompletionByToolUseId.delete(this.activeCommandToolUseId)
				this.emitCommandOutputEvent(this.activeCommandToolUseId, undefined, true, pending.exitCode)
			}
		}
		this.activeCommandToolUseId = msg.ts
	}

	handleCommandOutputMessage(msg: { ts: number; text?: string; partial?: boolean }, isDone: boolean): void {
		const commandId = this.activeCommandToolUseId ?? msg.ts
		if (this.completedCommandOutputIds.has(commandId)) return
		const pending = this.pendingCommandCompletionByToolUseId.get(commandId)
		if (pending) {
			if (!isDone) return
			clearTimeout(pending.timer)
			this.pendingCommandCompletionByToolUseId.delete(commandId)
			this.emitCommandOutputEvent(commandId, msg.text, true, pending.exitCode)
			return
		}
		if (this.statusDrivenCommandOutputIds.has(commandId)) return
		this.emitCommandOutputEvent(commandId, msg.text, isDone)
	}
}
