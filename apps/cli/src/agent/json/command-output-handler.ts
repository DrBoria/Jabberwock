import type { JsonEvent } from "@/types/json-events.js"
import { COMMAND_OUTPUT_EXIT_GRACE_MS } from "./delta.js"

export function createCommandOutputHandler(emitEvent: (event: JsonEvent) => void, mode: string) {
	let activeCommandToolUseId: number | undefined
	const previousCommandOutputByToolUseId = new Map<number, string>()
	const statusDrivenCommandOutputIds = new Set<number>()
	const completedCommandOutputIds = new Set<number>()
	const pendingCommandCompletionByToolUseId = new Map<number, { exitCode?: number; timer: NodeJS.Timeout }>()

	function computeCommandOutputDelta(commandId: number, fullOutput: string | undefined): string | null {
		const normalized = fullOutput ?? ""
		const previous = previousCommandOutputByToolUseId.get(commandId) || ""
		if (normalized === previous) return null
		previousCommandOutputByToolUseId.set(commandId, normalized)
		return normalized.startsWith(previous) ? normalized.slice(previous.length) : normalized
	}

	function clearPendingCommandCompletion(commandId: number): void {
		const pending = pendingCommandCompletionByToolUseId.get(commandId)
		if (!pending) return
		clearTimeout(pending.timer)
		pendingCommandCompletionByToolUseId.delete(commandId)
	}

	function emitCommandOutputEventCleanup(commandId: number): void {
		clearPendingCommandCompletion(commandId)
		previousCommandOutputByToolUseId.delete(commandId)
		statusDrivenCommandOutputIds.delete(commandId)
		completedCommandOutputIds.add(commandId)
		if (activeCommandToolUseId === commandId) {
			activeCommandToolUseId = undefined
		}
	}

	function emitCommandOutputEventStreamJson(
		commandId: number,
		fullOutput: string | undefined,
		isDone: boolean,
		exitCode?: number,
	): void {
		const outputDelta = computeCommandOutputDelta(commandId, fullOutput)
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
			emitCommandOutputEventCleanup(commandId)
		}
		if (!isDone && outputDelta === null) return
		emitEvent(event)
	}

	function emitCommandOutputEvent(
		commandId: number,
		fullOutput: string | undefined,
		isDone: boolean,
		exitCode?: number,
	): void {
		if (mode === "stream-json") {
			emitCommandOutputEventStreamJson(commandId, fullOutput, isDone, exitCode)
			return
		}
		emitEvent({
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
		if (isDone) emitCommandOutputEventCleanup(commandId)
	}

	function emitCommandOutputChunk(outputSnapshot: string): void {
		const commandId = activeCommandToolUseId
		if (commandId === undefined) return
		statusDrivenCommandOutputIds.add(commandId)
		emitCommandOutputEvent(commandId, outputSnapshot, false)
	}

	function markCommandOutputExited(exitCode?: number): void {
		const commandId = activeCommandToolUseId
		if (commandId === undefined) return
		statusDrivenCommandOutputIds.add(commandId)
		clearPendingCommandCompletion(commandId)
		const timer = setTimeout(() => {
			if (!pendingCommandCompletionByToolUseId.has(commandId)) return
			pendingCommandCompletionByToolUseId.delete(commandId)
			emitCommandOutputEvent(commandId, undefined, true, exitCode)
		}, COMMAND_OUTPUT_EXIT_GRACE_MS)
		timer.unref?.()
		pendingCommandCompletionByToolUseId.set(commandId, { exitCode, timer })
	}

	function emitCommandOutputDone(exitCode?: number): void {
		const commandId = activeCommandToolUseId
		if (commandId === undefined) return
		statusDrivenCommandOutputIds.add(commandId)
		emitCommandOutputEvent(commandId, undefined, true, exitCode)
	}

	function handleToolUseAskCommand(msg: { ts: number; text?: string; partial?: boolean }, _isDone: boolean): void {
		if (activeCommandToolUseId !== undefined && activeCommandToolUseId !== msg.ts) {
			const pending = pendingCommandCompletionByToolUseId.get(activeCommandToolUseId)
			if (pending) {
				clearTimeout(pending.timer)
				pendingCommandCompletionByToolUseId.delete(activeCommandToolUseId)
				emitCommandOutputEvent(activeCommandToolUseId, undefined, true, pending.exitCode)
			}
		}
		activeCommandToolUseId = msg.ts
	}

	function handleCommandOutputMessage(msg: { ts: number; text?: string; partial?: boolean }, isDone: boolean): void {
		const commandId = activeCommandToolUseId ?? msg.ts
		if (completedCommandOutputIds.has(commandId)) return
		const pending = pendingCommandCompletionByToolUseId.get(commandId)
		if (pending) {
			if (!isDone) return
			clearTimeout(pending.timer)
			pendingCommandCompletionByToolUseId.delete(commandId)
			emitCommandOutputEvent(commandId, msg.text, true, pending.exitCode)
			return
		}
		if (statusDrivenCommandOutputIds.has(commandId)) return
		emitCommandOutputEvent(commandId, msg.text, isDone)
	}

	return {
		get activeCommandToolUseId() {
			return activeCommandToolUseId
		},
		set activeCommandToolUseId(value: number | undefined) {
			activeCommandToolUseId = value
		},
		emitCommandOutputChunk,
		markCommandOutputExited,
		emitCommandOutputDone,
		handleToolUseAskCommand,
		handleCommandOutputMessage,
	}
}

/** CommandOutputHandler instance type */
export type CommandOutputHandler = ReturnType<typeof createCommandOutputHandler>
