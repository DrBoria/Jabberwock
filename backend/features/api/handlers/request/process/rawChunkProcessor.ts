import type {
	ApiStreamToolCallStartChunk,
	ApiStreamToolCallDeltaChunk,
	ApiStreamToolCallEndChunk,
} from "@api/transform/stream"

/**
 * Event types returned from "raw" chunk processing.
 */
export type ToolCallStreamEvent = ApiStreamToolCallStartChunk | ApiStreamToolCallDeltaChunk | ApiStreamToolCallEndChunk

type TrackedChunk = {
	id: string
	name: string
	hasStarted: boolean
	deltaBuffer: string[]
}

/**
 * Per-stream raw chunk tracking state (keyed by index from "API" stream).
 *
 * Create one instance per stream via `RawChunkTracker()` in the stream
 * orchestrator (handleStream) and pass it to all consumers via parameters.
 * No module-level state — each stream owns its tracker.
 *
 * Lifecycle:
 * 1. Created in handleStream() before stream processing
 * 2. processRawChunk() called from "tool_call_partial" chunk handler
 * 3. finalize() called from finalizeToolCalls() after stream ends
 * 4. clear() called from resetStreamingState() before next stream
 */
export function RawChunkTracker() {
	const tracker = new Map<number, TrackedChunk>()

	function ensureTracked(index: number, id?: string, name?: string): TrackedChunk | undefined {
		let tracked = tracker.get(index)
		if (id && !tracked) {
			tracked = {
				id,
				name: name || "",
				hasStarted: false,
				deltaBuffer: [],
			}
			tracker.set(index, tracked)
		}
		return tracked
	}

	function emitStartIfNeeded(tracked: TrackedChunk, events: ToolCallStreamEvent[]): void {
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

	function emitDelta(tracked: TrackedChunk, args: string, events: ToolCallStreamEvent[]): void {
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
	 * Process a raw tool call chunk from "the" API stream.
	 * Handles tracking, buffering, and emits start/delta/end events.
	 */
	function processRawChunk(chunk: {
		index: number
		id?: string
		name?: string
		arguments?: string
	}): ToolCallStreamEvent[] {
		const events: ToolCallStreamEvent[] = []
		const { index, id, name, arguments: args } = chunk

		const tracked = ensureTracked(index, id, name)
		if (!tracked) {
			return events
		}

		if (name) {
			tracked.name = name
		}

		emitStartIfNeeded(tracked, events)

		if (args) {
			emitDelta(tracked, args, events)
		}

		return events
	}

	/**
	 * Process stream finish reason.
	 * Emits end events when finish_reason is 'tool_calls'.
	 */
	function processFinishReason(finishReason: string | null | undefined): ToolCallStreamEvent[] {
		const events: ToolCallStreamEvent[] = []

		if (finishReason === "tool_calls" && tracker.size > 0) {
			for (const [, tracked] of tracker.entries()) {
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
	function finalize(): ToolCallStreamEvent[] {
		const events: ToolCallStreamEvent[] = []

		if (tracker.size > 0) {
			for (const [, tracked] of tracker.entries()) {
				if (tracked.hasStarted) {
					events.push({
						type: "tool_call_end",
						id: tracked.id,
					})
				}
			}
			tracker.clear()
		}

		return events
	}

	/**
	 * Clear all raw chunk tracking state.
	 */
	function clear(): void {
		tracker.clear()
	}

	return { processRawChunk, processFinishReason, finalize, clear }
}

/** RawChunkTracker instance type */
export type RawChunkTracker = ReturnType<typeof RawChunkTracker>
