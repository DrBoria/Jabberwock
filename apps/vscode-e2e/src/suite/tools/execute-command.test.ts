import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import { JabberwockEventName, type Notification } from "@jabberwock/types"

import { waitFor, sleep, waitUntilCompleted } from "../helpers/utils"
import { setDefaultSuiteTimeout } from "../helpers/test-utils"
import { setupTestHooks, ensureTestFile, createApiRequestHandler, getExecuteTaskConfig } from "./helpers/test-helpers"

suite.skip("Jabberwock execute_command Tool", function () {
	setDefaultSuiteTimeout(this)

	let workspaceDir: string
	const testFiles: Record<string, { name: string; content: string; path: string }> = {}

	suiteSetup(async () => {
		const wf = vscode.workspace.workspaceFolders
		if (!wf?.length) throw new Error("No workspace folder found")
		workspaceDir = wf[0]!.uri.fsPath
		for (const [, file] of Object.entries(testFiles)) {
			file.path = path.join(workspaceDir, file.name)
			if (file.content) await fs.writeFile(file.path, file.content)
		}
	})

	suiteTeardown(async () => {
		try {
			await globalThis.api.abortRunningTask()
		} catch {
			/* ignore */
		}
		for (const [, file] of Object.entries(testFiles)) {
			try {
				await fs.unlink(file.path)
			} catch {
				/* ignore */
			}
		}
		try {
			await fs.rmdir(path.join(workspaceDir, "test-subdir"))
		} catch {
			/* ignore */
		}
	})

	setupTestHooks()

	test("Should execute simple echo command", async function () {
		const api = globalThis.api
		const testFile = ensureTestFile(testFiles, "simpleEcho")
		let taskStarted = false
		const { state, handler: mh } = createApiRequestHandler("execute_command")

		const sh = (id: string) => {
			if (id === testId) taskStarted = true
		}
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskStarted, sh)

		let testId: string
		try {
			testId = await api.startNewTask(
				getExecuteTaskConfig(`Use execute_command to run: echo "Hello from test" > ${testFile.name}`),
			)
			await waitFor(() => taskStarted, { timeout: 45_000 })
			await waitUntilCompleted({ api, taskId: testId, timeout: 60_000 })
			assert.strictEqual(state.errorOccurred, null, `Error occurred: ${state.errorOccurred}`)
			assert.ok(state.toolCalled, "execute_command tool should have been called")
			const content = await fs.readFile(testFile.path, "utf-8")
			assert.ok(content.includes("Hello from test"), "File should contain the echoed text")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskStarted, sh)
		}
	})

	test("Should execute command with custom working directory", async function () {
		const api = globalThis.api
		let taskStarted = false
		let cwdUsed = false
		const { state, handler: baseHandler } = createApiRequestHandler("execute_command")

		const subDir = path.join(workspaceDir, "test-subdir")
		await fs.mkdir(subDir, { recursive: true })

		const mh = ({ message }: { message: Notification }) => {
			baseHandler({ message })
			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				try {
					const d = JSON.parse(message.text)
					if (typeof d.request === "string" && d.request.includes("test-subdir")) cwdUsed = true
				} catch {
					/* ignore */
				}
			}
		}

		const sh = (id: string) => {
			if (id === testId) taskStarted = true
		}
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskStarted, sh)

		let testId: string
		try {
			testId = await api.startNewTask(
				getExecuteTaskConfig(
					`Use execute_command with cwd: ${subDir} to run: echo "Test in subdirectory" > output.txt`,
				),
			)
			await waitFor(() => taskStarted, { timeout: 45_000 })
			await waitUntilCompleted({ api, taskId: testId, timeout: 60_000 })
			assert.strictEqual(state.errorOccurred, null, `Error occurred: ${state.errorOccurred}`)
			assert.ok(state.toolCalled, "execute_command tool should have been called")
			assert.ok(cwdUsed, "Command should have used the subdirectory as cwd")
			const outputPath = path.join(subDir, "output.txt")
			const content = await fs.readFile(outputPath, "utf-8")
			assert.ok(content.includes("Test in subdirectory"), "File should contain the echoed text")
			await fs.unlink(outputPath)
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskStarted, sh)
			try {
				await fs.rmdir(subDir)
			} catch {
				/* ignore */
			}
		}
	})

	test("Should execute multiple commands sequentially", async function () {
		const api = globalThis.api
		const testFile = ensureTestFile(testFiles, "multiCommand")
		let taskStarted = false
		const { state, handler: mh } = createApiRequestHandler("execute_command")

		const sh = (id: string) => {
			if (id === testId) taskStarted = true
		}
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskStarted, sh)

		let testId: string
		try {
			testId = await api.startNewTask(
				getExecuteTaskConfig(
					`Run these commands sequentially:\n1. echo "Line 1" > ${testFile.name}\n2. echo "Line 2" >> ${testFile.name}`,
				),
			)
			await waitFor(() => taskStarted, { timeout: 90_000 })
			await waitUntilCompleted({ api, taskId: testId, timeout: 90_000 })
			assert.strictEqual(state.errorOccurred, null, `Error: ${state.errorOccurred}`)
			assert.ok(state.callCount >= 2, `Should be called >=2 times, was ${state.callCount}`)
			const content = await fs.readFile(testFile.path, "utf-8")
			assert.ok(content.includes("Line 1"), "Should contain first line")
			assert.ok(content.includes("Line 2"), "Should contain second line")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskStarted, sh)
		}
	})

	test("Should handle long-running commands", async function () {
		const api = globalThis.api
		let taskStarted = false
		const { state, handler: mh } = createApiRequestHandler("execute_command")

		const sh = (id: string) => {
			if (id === testId) taskStarted = true
		}
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskStarted, sh)

		let testId: string
		try {
			const sleepCmd = process.platform === "win32" ? "timeout /t 3 /nobreak" : "sleep 3"
			testId = await api.startNewTask(
				getExecuteTaskConfig(`Run: ${sleepCmd} && echo "Command completed after delay"`),
			)
			await waitFor(() => taskStarted, { timeout: 45_000 })
			await waitUntilCompleted({ api, taskId: testId, timeout: 45_000 })
			await sleep(1000)
			assert.strictEqual(state.errorOccurred, null, `Error: ${state.errorOccurred}`)
			assert.ok(state.toolCalled, "execute_command tool should have been called")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskStarted, sh)
		}
	})
})
