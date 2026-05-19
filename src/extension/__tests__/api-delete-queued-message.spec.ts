import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"

import { deleteQueuedMessage } from "../../features/chat/api-methods"
import { EventBridge } from "../../core/webview/EventBridge"

vi.mock("vscode")
vi.mock("../../core/webview/EventBridge")

describe("API - DeleteQueuedMessage Command", () => {
	let mockOutputChannel: vscode.OutputChannel
	let mockProvider: EventBridge
	let mockRemoveMessage: ReturnType<typeof vi.fn>
	let mockLog: ReturnType<typeof vi.fn>

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
		} as unknown as vscode.OutputChannel

		mockRemoveMessage = vi.fn().mockReturnValue(true)

		mockProvider = {
			context: {} as vscode.ExtensionContext,
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
			getCurrentTaskStack: vi.fn().mockReturnValue([]),
			getCurrentTask: vi.fn().mockReturnValue({
				messageQueueService: {
					removeMessage: mockRemoveMessage,
				},
			}),
			taskStack: [{}],
			viewLaunched: true,
		} as unknown as EventBridge

		mockLog = vi.fn()
	})

	it("should remove a queued message by id", () => {
		const messageId = "msg-abc-123"

		deleteQueuedMessage(mockProvider, messageId)

		expect(mockRemoveMessage).toHaveBeenCalledWith(messageId)
		expect(mockRemoveMessage).toHaveBeenCalledTimes(1)
	})

	it("should handle missing current task gracefully", () => {
		;(mockProvider.getCurrentTask as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
		// Clear taskStack to simulate no current task
		mockProvider.taskStack.length = 0

		// Should not throw
		expect(() => deleteQueuedMessage(mockProvider, "msg-abc-123")).not.toThrow()
		expect(mockRemoveMessage).not.toHaveBeenCalled()
	})

	it("should handle non-existent message id gracefully", () => {
		mockRemoveMessage.mockReturnValue(false)

		// Should not throw even when removeMessage returns false
		expect(() => deleteQueuedMessage(mockProvider, "non-existent-id")).not.toThrow()
		expect(mockRemoveMessage).toHaveBeenCalledWith("non-existent-id")
	})
})
