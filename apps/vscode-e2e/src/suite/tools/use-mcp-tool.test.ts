import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"

import { JabberwockEventName } from "@jabberwock/types"

import { waitFor, sleep } from "../helpers/utils"
import { setDefaultSuiteTimeout } from "../helpers/test-utils"
import {
	setupTestHooks,
	type MCPMessageState,
	type TestFiles,
	createMCPMessageHandler,
	getMCPTaskConfig,
	assertNoErrorResponse,
} from "./helpers/test-helpers"

suite.skip("Jabberwock use_mcp_tool Tool", function () {
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let testFiles: TestFiles

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jabberwock-test-mcp-"))
		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir

		testFiles = {
			simple: path.join(workspaceDir, `mcp-test-${Date.now()}.txt`),
			testData: path.join(workspaceDir, `mcp-data-${Date.now()}.json`),
			mcpConfig: path.join(workspaceDir, ".jabberwock", "mcp.json"),
		}

		await fs.writeFile(testFiles.simple, "Initial content for MCP test")
		await fs.writeFile(testFiles.testData, JSON.stringify({ test: "data", value: 42 }))

		const rooDir = path.join(workspaceDir, ".jabberwock")
		await fs.mkdir(rooDir, { recursive: true })
		await fs.writeFile(
			testFiles.mcpConfig,
			JSON.stringify({
				mcpServers: {
					time: {
						command: "uvx",
						args: ["mcp-server-time"],
						alwaysAllow: ["get_current_time", "convert_time"],
					},
				},
			}),
		)
	})

	suiteTeardown(async () => {
		try {
			await globalThis.api.abortRunningTask()
		} catch {
			/* ignore */
		}
		for (const filePath of Object.values(testFiles)) {
			try {
				await fs.unlink(filePath)
			} catch {
				/* ignore */
			}
		}
		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir
		try {
			await fs.rm(path.join(workspaceDir, ".jabberwock"), { recursive: true, force: true })
		} catch {
			/* ignore */
		}
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	setupTestHooks()

	async function setupMCPConfigForFilesystem() {
		const mcpConfigUri = vscode.Uri.file(testFiles.mcpConfig)
		try {
			const document = await vscode.workspace.openTextDocument(mcpConfigUri)
			const editor = await vscode.window.showTextDocument(document)
			const edit = new vscode.WorkspaceEdit()
			edit.replace(
				mcpConfigUri,
				new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
				document
					.getText()
					.replace(
						'"alwaysAllow": []',
						'"alwaysAllow": ["read_file","read_multiple_files","write_file","edit_file","create_directory","list_directory","directory_tree","move_file","search_files","get_file_info","list_allowed_directories"]',
					),
			)
			await vscode.workspace.applyEdit(edit)
			await editor.document.save()
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
		} catch {
			/* VSCode ops may fail */
		}
	}

	test("Should request MCP filesystem read_file tool and complete successfully", async function () {
		const api = globalThis.api
		const state: MCPMessageState = {
			mcpToolRequested: false,
			mcpToolName: null,
			mcpServerResponse: null,
			attemptCompletionCalled: false,
			errorOccurred: null,
		}
		const messageHandler = createMCPMessageHandler(state)
		api.on(JabberwockEventName.Message, messageHandler)

		await setupMCPConfigForFilesystem()
		await sleep(5000)

		const fileName = path.basename(testFiles.simple)
		try {
			await api.startNewTask(getMCPTaskConfig(`Use MCP filesystem read_file to read "${fileName}".`))
			await waitFor(() => state.attemptCompletionCalled, { timeout: 45_000 })
			assert.ok(state.mcpToolRequested, "use_mcp_tool should have been requested")
			assert.strictEqual(state.mcpToolName, "read_file", "Should have used read_file")
			assert.ok(state.mcpServerResponse, "Should have received server response")
			const resp = state.mcpServerResponse as string
			assert.ok(resp.includes("Initial content for MCP test"), "Response should contain file content")
			assertNoErrorResponse(state, resp)
		} finally {
			api.off(JabberwockEventName.Message, messageHandler)
		}
	})

	test("Should request MCP filesystem write_file tool and complete successfully", async function () {
		const api = globalThis.api
		const state: MCPMessageState = {
			mcpToolRequested: false,
			mcpToolName: null,
			mcpServerResponse: null,
			attemptCompletionCalled: false,
			errorOccurred: null,
		}
		const messageHandler = createMCPMessageHandler(state)
		api.on(JabberwockEventName.Message, messageHandler)

		const newFileName = `mcp-write-test-${Date.now()}.txt`
		try {
			await api.startNewTask(
				getMCPTaskConfig(
					`Use MCP filesystem write_file to create "${newFileName}" with content "Hello from MCP!".`,
				),
			)
			await waitFor(() => state.attemptCompletionCalled, { timeout: 45_000 })
			assert.ok(state.mcpToolRequested, "use_mcp_tool should have been requested")
			assert.strictEqual(state.mcpToolName, "write_file", "Should have used write_file")
			assert.ok(state.mcpServerResponse, "Should have received server response")
			const resp = state.mcpServerResponse as string
			const hasSuccess = ["success", "created", "written", "successfully"].some((w) =>
				resp.toLowerCase().includes(w),
			)
			const hasFileName = resp.includes(newFileName) || resp.includes("mcp-write-test")
			assert.ok(hasSuccess || hasFileName, `Response should indicate success. Got: ${resp.substring(0, 150)}`)
			assertNoErrorResponse(state, resp)
		} finally {
			api.off(JabberwockEventName.Message, messageHandler)
		}
	})

	test("Should request MCP filesystem list_directory tool and complete successfully", async function () {
		const api = globalThis.api
		const state: MCPMessageState = {
			mcpToolRequested: false,
			mcpToolName: null,
			mcpServerResponse: null,
			attemptCompletionCalled: false,
			errorOccurred: null,
		}
		const messageHandler = createMCPMessageHandler(state)
		api.on(JabberwockEventName.Message, messageHandler)

		try {
			await api.startNewTask(getMCPTaskConfig("Use MCP filesystem list_directory to list the current directory."))
			await waitFor(() => state.attemptCompletionCalled, { timeout: 45_000 })
			assert.ok(state.mcpToolRequested, "use_mcp_tool should have been requested")
			assert.strictEqual(state.mcpToolName, "list_directory", "Should have used list_directory")
			assert.ok(state.mcpServerResponse, "Should have received server response")
			const resp = state.mcpServerResponse as string
			assert.ok(
				resp.includes("mcp-test-") || resp.includes(path.basename(testFiles.simple)),
				"Response should contain test file",
			)
			assert.ok(
				["name", "type", "file", "directory", ".txt", ".json"].some((w) => resp.includes(w)),
				"Should contain structure indicators",
			)
			assertNoErrorResponse(state, resp)
		} finally {
			api.off(JabberwockEventName.Message, messageHandler)
		}
	})

	test.skip("Should request MCP filesystem directory_tree tool and complete successfully", () => {})
	test.skip("Should handle MCP server error gracefully and complete task", () => {})
	test.skip("Should validate MCP request message format and complete successfully", () => {})
})
