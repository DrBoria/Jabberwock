import { describe, expect, it, vi, beforeEach } from "vitest"

// Isolate the prefill store so we only assert on the chat side-effect.
vi.mock("@src/features/api/prefill", () => ({
	prefillStore: {
		reset: vi.fn(),
		set: vi.fn(),
	},
}))

import { handlePrefillProgress } from "./helpers"
import { prefillStore } from "@src/features/api/prefill"

const resetMock = prefillStore.reset as ReturnType<typeof vi.fn>
const setMock = prefillStore.set as ReturnType<typeof vi.fn>

function makeChat() {
	return { setIsStreaming: vi.fn() }
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe("handlePrefillProgress", () => {
	it("returns false for unrelated messages", () => {
		const chat = makeChat()
		expect(handlePrefillProgress({ type: "streamChunk" } as never, chat)).toBe(false)
		expect(chat.setIsStreaming).not.toHaveBeenCalled()
	})

	it("sets isStreaming(true) on a real prefill (percent >= 0)", () => {
		const chat = makeChat()
		const handled = handlePrefillProgress({ type: "prefillProgress", taskId: "task-1", percent: 42 } as never, chat)
		expect(handled).toBe(true)
		expect(setMock).toHaveBeenCalledWith("task-1", 42)
		expect(chat.setIsStreaming).toHaveBeenCalledWith(true)
	})

	it("does NOT set isStreaming for indeterminate prefill (percent < 0)", () => {
		const chat = makeChat()
		handlePrefillProgress({ type: "prefillProgress", taskId: "task-1", percent: -1 } as never, chat)
		expect(setMock).toHaveBeenCalledWith("task-1", null)
		expect(chat.setIsStreaming).not.toHaveBeenCalled()
	})

	it("resets the store and leaves isStreaming alone when percent is null", () => {
		const chat = makeChat()
		handlePrefillProgress({ type: "prefillProgress", taskId: "task-1", percent: null } as never, chat)
		expect(resetMock).toHaveBeenCalled()
		expect(setMock).not.toHaveBeenCalled()
		expect(chat.setIsStreaming).not.toHaveBeenCalled()
	})

	it("handles a real prefill without a chat store (no crash)", () => {
		const handled = handlePrefillProgress({ type: "prefillProgress", taskId: "task-1", percent: 7 } as never)
		expect(handled).toBe(true)
		expect(setMock).toHaveBeenCalledWith("task-1", 7)
	})
})
