import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"

import { JabberwockEventName, type Notification, type JabberwockAPI } from "@jabberwock/types"

import { waitFor, sleep } from "../../helpers/utils"

export interface ToolTestEventHandlers {
	messageHandler: (event: { message: Notification }) => void
	taskStartedHandler: (id: string) => void
	taskCompletedHandler: (id: string) => void
	taskStarted: boolean
	taskCompleted: boolean
	toolExecuted: boolean
	toolExecutionDetails: string
	errorOccurred: string | null
}

export function createToolTestHandlers(
	api: JabberwockAPI,
	toolName: string,
	taskIdRef: { current: string },
): ToolTestEventHandlers {
	const state: ToolTestEventHandlers = {
		messageHandler: () => {},
		taskStartedHandler: () => {},
		taskCompletedHandler: () => {},
		taskStarted: false,
		taskCompleted: false,
		toolExecuted: false,
		toolExecutionDetails: "",
		errorOccurred: null,
	}

	state.messageHandler = ({ message }: { message: Notification }) => {
		if (message.type === "say" && message.say === "api_req_started") {
			if (message.text && message.text.includes(toolName)) {
				state.toolExecuted = true
				state.toolExecutionDetails = message.text
			}
		}
		if (message.type === "say" && message.say === "error") {
			state.errorOccurred = message.text || "Unknown error"
		}
	}

	state.taskStartedHandler = (id: string) => {
		if (id === taskIdRef.current) {
			state.taskStarted = true
		}
	}

	state.taskCompletedHandler = (id: string) => {
		if (id === taskIdRef.current) {
			state.taskCompleted = true
		}
	}

	api.on(JabberwockEventName.Message, state.messageHandler)
	api.on(JabberwockEventName.TaskStarted, state.taskStartedHandler)
	api.on(JabberwockEventName.TaskCompleted, state.taskCompletedHandler)

	return state
}

export function removeToolTestHandlers(api: JabberwockAPI, state: ToolTestEventHandlers): void {
	api.off(JabberwockEventName.Message, state.messageHandler)
	api.off(JabberwockEventName.TaskStarted, state.taskStartedHandler)
	api.off(JabberwockEventName.TaskCompleted, state.taskCompletedHandler)
}

export interface TaskConfig {
	mode?: string
	autoApprovalEnabled?: boolean
	alwaysAllowWrite?: boolean
	alwaysAllowReadOnly?: boolean
	alwaysAllowReadOnlyOutsideWorkspace?: boolean
	text: string
}

export function createTaskConfig(text: string): TaskConfig {
	return {
		mode: "code",
		autoApprovalEnabled: true,
		alwaysAllowWrite: true,
		alwaysAllowReadOnly: true,
		alwaysAllowReadOnlyOutsideWorkspace: true,
		text,
	}
}

export async function startToolTask(
	api: JabberwockAPI,
	toolName: string,
	text: string,
	_timeoutMs = 90_000,
): Promise<{ taskId: string; handlers: ToolTestEventHandlers }> {
	const taskIdRef = { current: "" }
	const handlers = createToolTestHandlers(api, toolName, taskIdRef)

	const config = createTaskConfig(text)
	taskIdRef.current = await api.startNewTask({ configuration: config })

	return { taskId: taskIdRef.current, handlers }
}

export async function waitForTask(handlers: ToolTestEventHandlers, timeoutMs = 90_000): Promise<void> {
	await waitFor(() => handlers.taskStarted, { timeout: timeoutMs })
	await waitFor(() => handlers.taskCompleted, { timeout: timeoutMs })
	await sleep(2000)
}

export async function findFileInWorkspace(
	fileName: string,
	tempDir?: string,
): Promise<{ filePath: string; content: string } | null> {
	const searchPaths: string[] = []

	if (tempDir) {
		searchPaths.push(path.join(tempDir, fileName))
	}

	// Check workspace directories created by runTest.ts
	try {
		const tmpFiles = await fs.readdir("/tmp")
		const workspaceDirs = tmpFiles.filter((f) => f.startsWith("jabberwock-test-workspace-"))
		for (const wsDir of workspaceDirs) {
			searchPaths.push(path.join("/tmp", wsDir, fileName))
		}
	} catch {
		// /tmp might not be accessible
	}

	searchPaths.push(path.join(process.cwd(), fileName))

	for (const filePath of searchPaths) {
		try {
			await fs.access(filePath)
			const content = await fs.readFile(filePath, "utf-8")
			return { filePath, content }
		} catch {
			// File not found at this path, continue searching
		}
	}

	return null
}

export async function findFileWithNestedPath(
	nestedPath: string,
): Promise<{ filePath: string; content: string } | null> {
	// Check workspace directories
	try {
		const tmpFiles = await fs.readdir("/tmp")
		const workspaceDirs = tmpFiles.filter((f) => f.startsWith("jabberwock-test-workspace-"))
		for (const wsDir of workspaceDirs) {
			const wsNestedPath = path.join("/tmp", wsDir, nestedPath)
			try {
				await fs.access(wsNestedPath)
				const content = await fs.readFile(wsNestedPath, "utf-8")
				return { filePath: wsNestedPath, content }
			} catch {
				// Check workspace root
				const fileName = path.basename(nestedPath)
				const wsFilePath = path.join("/tmp", wsDir, fileName)
				try {
					await fs.access(wsFilePath)
					const content = await fs.readFile(wsFilePath, "utf-8")
					return { filePath: wsFilePath, content }
				} catch {
					// Continue checking
				}
			}
		}
	} catch {
		// /tmp might not be accessible
	}

	return null
}

export function assertFileContent(
	result: { filePath: string; content: string } | null,
	fileName: string,
	expectedContent?: string,
): void {
	assert.ok(result, `File should have been created. Expected filename: ${fileName}`)
	if (expectedContent !== undefined) {
		assert.strictEqual(result.content.trim(), expectedContent, "File content should match expected content")
	}
}

export function assertToolExecuted(handlers: ToolTestEventHandlers, searchText?: string): void {
	assert.ok(handlers.toolExecuted, "Tool should have been executed")
	if (searchText) {
		assert.ok(handlers.toolExecutionDetails.includes(searchText), `Tool execution should include "${searchText}"`)
	}
}

export async function abortRunningTask(): Promise<void> {
	try {
		await globalThis.api.abortRunningTask()
	} catch {
		// Task might not be running
	}
}

export async function cleanupFile(filePath: string): Promise<void> {
	try {
		await fs.unlink(filePath)
	} catch {
		// File might not exist
	}
}

export async function runToolTest(
	api: JabberwockAPI,
	toolName: string,
	prompt: string,
	assertions: (handlers: ToolTestEventHandlers) => Promise<void>,
): Promise<void> {
	const { taskId: _taskId, handlers } = await startToolTask(api, toolName, prompt)
	try {
		await waitForTask(handlers)
		await assertions(handlers)
	} finally {
		removeToolTestHandlers(api, handlers)
	}
}
