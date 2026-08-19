import type {
	ApiStreamToolCallStartChunk,
	ApiStreamToolCallDeltaChunk,
	ApiStreamToolCallEndChunk,
} from "@api/transform/stream"

/**
 * Event types returned from raw chunk processing.
 */
export type ToolCallStreamEvent = ApiStreamToolCallStartChunk | ApiStreamToolCallDeltaChunk | ApiStreamToolCallEndChunk

/**
 * Per-stream raw chunk tracking state (keyed by index from API stream).
 *
 * Create one instance per stream via `new RawChunkTracker()` in the stream
 * orchestrator (handleStream) and pass it to all consumers via parameters.
 * No module-level state — each stream owns its tracker.
 *
 * Lifecycle:
 * 1. Created in handleStream() before stream processing
 * 2. processRawChunk() called from tool_call_partial chunk handler
 * 3. finalize() called from finalizeToolCalls() after stream ends
 * 4. clear() called from resetStreamingState() before next stream
 */
export class RawChunkTracker {
	private readonly tracker = new Map<
		number,
		{
			id: string
			name: string
			hasStarted: boolean
			deltaBuffer: string[]
		}
	>()

	/**
	 * Process a raw tool call chunk from the API stream.
	 * Handles tracking, buffering, and emits start/delta/end events.
	 */
	processRawChunk(chunk: { index: number; id?: string; name?: string; arguments?: string }): ToolCallStreamEvent[] {
		const events: ToolCallStreamEvent[] = []
		const { index, id, name, arguments: args } = chunk

		const tracked = this.ensureTracked(index, id, name)
		if (!tracked) {
			return events
		}

		if (name) {
			tracked.name = name
		}

		this.emitStartIfNeeded(tracked, events)

		if (args) {
			this.emitDelta(tracked, args, events)
		}

		return events
	}

	private ensureTracked(
		index: number,
		id?: string,
		name?: string,
	): { id: string; name: string; hasStarted: boolean; deltaBuffer: string[] } | undefined {
		let tracked = this.tracker.get(index)
		if (id && !tracked) {
			tracked = {
				id,
				name: name || "",
				hasStarted: false,
				deltaBuffer: [],
			}
			this.tracker.set(index, tracked)
		}
		return tracked
	}

	private emitStartIfNeeded(
		tracked: { id: string; name: string; hasStarted: boolean; deltaBuffer: string[] },
		events: ToolCallStreamEvent[],
	): void {
		if (!tracked.hasStarted && tracked.name) {
			events.push({
				type: "tool_call_start",
				id: tracked.id,
				name: tracked.name,
			})
			tracked.hasStarted = true

			for (const bufferedDelta of tracked.deltaBuffer) {
				events.push({
					type: "tool_call_delta",
					id: tracked.id,
					delta: bufferedDelta,
				})
			}
			tracked.deltaBuffer = []
		}
	}

	private emitDelta(
		tracked: { id: string; name: string; hasStarted: boolean; deltaBuffer: string[] },
		args: string,
		events: ToolCallStreamEvent[],
	): void {
		if (tracked.hasStarted) {
			events.push({
				type: "tool_call_delta",
				id: tracked.id,
				delta: args,
			})
		} else {
			tracked.deltaBuffer.push(args)
		}
	}

	/**
	 * Process stream finish reason.
	 * Emits end events when finish_reason is 'tool_calls'.
	 */
	processFinishReason(finishReason: string | null | undefined): ToolCallStreamEvent[] {
		const events: ToolCallStreamEvent[] = []

		if (finishReason === "tool_calls" && this.tracker.size > 0) {
			for (const [, tracked] of this.tracker.entries()) {
				events.push({
					type: "tool_call_end",
					id: tracked.id,
				})
			}
		}

		return events
	}

	/**
	 * Finalize any remaining tool calls that weren't explicitly ended.
	 * Should be called at the end of stream processing.
	 */
	finalize(): ToolCallStreamEvent[] {
		const events: ToolCallStreamEvent[] = []

		if (this.tracker.size > 0) {
			for (const [, tracked] of this.tracker.entries()) {
				if (tracked.hasStarted) {
					events.push({
						type: "tool_call_end",
						id: tracked.id,
					})
				}
			}
			this.tracker.clear()
		}

		return events
	}

	/**
	 * Clear all raw chunk tracking state.
	 */
	clear(): void {
		this.tracker.clear()
	}
}
