import * as assert from "assert"

import { type Notification } from "@jabberwock/types"

import { sleep } from "../../helpers/utils"

// === Common setup/teardown hooks for tool tests ===

export function setupTestHooks(): void {
	setup(async () => {
		try {
			await globalThis.api.abortRunningTask()
		} catch {
			/* ignore */
		}
		await sleep(100)
	})
	teardown(async () => {
		try {
			await globalThis.api.abortRunningTask()
		} catch {
			/* ignore */
		}
		await sleep(100)
	})
}

// === Test file helpers ===

export interface TestFileEntry {
	name: string
	content: string
	path: string
}

export function ensureTestFile(testFiles: Record<string, TestFileEntry>, key: string): TestFileEntry {
	if (!testFiles[key]) testFiles[key] = { name: `test-${key}-${Date.now()}.txt`, content: "", path: "" }
	return testFiles[key]
}

// === MCP tool test helpers ===

export interface MCPMessageState {
	mcpToolRequested: boolean
	mcpToolName: string | null
	mcpServerResponse: string | null
	attemptCompletionCalled: boolean
	errorOccurred: string | null
}

export interface TestFiles {
	simple: string
	testData: string
	mcpConfig: string
}

export function handleSayMessage(state: MCPMessageState, say: string | undefined, text: string | undefined): void {
	if (say === "mcp_server_response") state.mcpServerResponse = text ?? null
	else if (say === "completion_result") state.attemptCompletionCalled = true
	else if (say === "error") state.errorOccurred = text ?? null
}

export function createMCPMessageHandler(state: MCPMessageState) {
	return ({ message }: { message: Notification }) => {
		if (message.type === "ask" && message.ask === "use_mcp_server") {
			state.mcpToolRequested = true
			if (message.text) {
				try {
					state.mcpToolName = JSON.parse(message.text).toolName
				} catch {
					/* ignore */
				}
			}
		}
		if (message.type === "say") {
			handleSayMessage(state, message.say, message.text)
		}
	}
}

export function getMCPTaskConfig(text: string) {
	return {
		configuration: {
			mode: "code" as const,
			autoApprovalEnabled: true,
			alwaysAllowMcp: true,
			mcpEnabled: true,
		},
		text,
	}
}

export function assertNoErrorResponse(state: MCPMessageState, responseText: string): void {
	const isError = responseText.toLowerCase().includes("error") || responseText.toLowerCase().includes("failed")
	assert.ok(!isError, `Response should not contain errors. Got: ${responseText.substring(0, 100)}`)
	assert.ok(state.attemptCompletionCalled, "Task should have completed with attempt_completion")
	assert.strictEqual(state.errorOccurred, null, "No errors should have occurred")
}

// === Generic API request message handler factory ===

export interface ApiRequestHandlerState {
	errorOccurred: string | null
	toolCalled: boolean
	callCount: number
	lastRequest: string
}

export function createApiRequestHandler(toolName: string) {
	const state: ApiRequestHandlerState = {
		errorOccurred: null,
		toolCalled: false,
		callCount: 0,
		lastRequest: "",
	}

	const handler = ({ message }: { message: Notification }) => {
		if (message.type === "say" && message.say === "error") {
			state.errorOccurred = message.text ?? null
			return
		}
		if (message.type !== "say" || message.say !== "api_req_started" || !message.text) return
		try {
			const d = JSON.parse(message.text)
			if (typeof d.request === "string" && d.request.includes(toolName)) {
				state.toolCalled = true
				state.lastRequest = d.request
				state.callCount++
			}
		} catch {
			/* ignore */
		}
	}

	return { state, handler }
}

// === Task config factories ===

export function getExecuteTaskConfig(text: string) {
	return {
		configuration: {
			mode: "code" as const,
			autoApprovalEnabled: true,
			alwaysAllowExecute: true,
			allowedCommands: ["*"],
			terminalShellIntegrationDisabled: true,
		},
		text,
	}
}

export function getReadOnlyTaskConfig(text: string) {
	return {
		configuration: {
			mode: "code" as const,
			autoApprovalEnabled: true,
			alwaysAllowReadOnly: true,
			alwaysAllowReadOnlyOutsideWorkspace: true,
		},
		text,
	}
}

// === Task started handler factory ===

export function createTaskStartedHandler(getTestId: () => string) {
	const state = { taskStarted: false }
	const handler = (id: string) => {
		if (id === getTestId()) state.taskStarted = true
	}
	return { state, handler }
}
