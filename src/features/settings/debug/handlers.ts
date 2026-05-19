import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { fileExistsAtPath } from "../../../utils/fs"
import { generateErrorDiagnostics } from "../../diagnostics/handlers"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	requestOpenAiCodexRateLimits: async (provider, message) => {
		try {
			const { openAiCodexOAuthManager } = await import("../../../integrations/openai-codex/oauth")
			const accessToken = await openAiCodexOAuthManager.getAccessToken()

			if (!accessToken) {
				provider.postMessageToWebview({
					type: "openAiCodexRateLimits",
					error: "Not authenticated with OpenAI Codex",
				})
				return
			}

			const accountId = await openAiCodexOAuthManager.getAccountId()
			const { fetchOpenAiCodexRateLimitInfo } = await import("../../../integrations/openai-codex/rate-limits")
			const rateLimits = await fetchOpenAiCodexRateLimitInfo(accessToken, { accountId })

			provider.postMessageToWebview({
				type: "openAiCodexRateLimits",
				values: rateLimits,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Error fetching OpenAI Codex rate limits: ${errorMessage}`)
			provider.postMessageToWebview({
				type: "openAiCodexRateLimits",
				error: errorMessage,
			})
		}
	},

	openDebugApiHistory: async (provider, message) => {
		const currentTask = provider.getCurrentTask()
		if (!currentTask) {
			vscode.window.showErrorMessage("No active task to view history for")
			return
		}

		try {
			const { getTaskDirectoryPath } = await import("../../../utils/storage")
			const globalStoragePath = provider.contextProxy.globalStorageUri.fsPath
			const taskDirPath = await getTaskDirectoryPath(globalStoragePath, currentTask.taskId)

			const fileName = "api_conversation_history.json"
			const sourceFilePath = path.join(taskDirPath, fileName)

			// Check if file exists
			if (!(await fileExistsAtPath(sourceFilePath))) {
				vscode.window.showErrorMessage(`File not found: ${fileName}`)
				return
			}

			// Read the source file
			const content = await fs.readFile(sourceFilePath, "utf8")
			let jsonContent: unknown

			try {
				jsonContent = JSON.parse(content)
			} catch {
				vscode.window.showErrorMessage(`Failed to parse ${fileName}`)
				return
			}

			// Prettify the JSON
			const prettifiedContent = JSON.stringify(jsonContent, null, 2)

			// Create a temporary file
			const tmpDir = os.tmpdir()
			const timestamp = Date.now()
			const tempFileName = `jabberwock-debug-api-${currentTask.taskId.slice(0, 8)}-${timestamp}.json`
			const tempFilePath = path.join(tmpDir, tempFileName)

			await fs.writeFile(tempFilePath, prettifiedContent, "utf8")

			// Open the temp file in VS Code
			const doc = await vscode.workspace.openTextDocument(tempFilePath)
			await vscode.window.showTextDocument(doc, { preview: true })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Error opening debug history: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to open debug history: ${errorMessage}`)
		}
	},

	openDebugUiHistory: async (provider, message) => {
		const currentTask = provider.getCurrentTask()
		if (!currentTask) {
			vscode.window.showErrorMessage("No active task to view history for")
			return
		}

		try {
			const { getTaskDirectoryPath } = await import("../../../utils/storage")
			const globalStoragePath = provider.contextProxy.globalStorageUri.fsPath
			const taskDirPath = await getTaskDirectoryPath(globalStoragePath, currentTask.taskId)

			const fileName = "ui_messages.json"
			const sourceFilePath = path.join(taskDirPath, fileName)

			// Check if file exists
			if (!(await fileExistsAtPath(sourceFilePath))) {
				vscode.window.showErrorMessage(`File not found: ${fileName}`)
				return
			}

			// Read the source file
			const content = await fs.readFile(sourceFilePath, "utf8")
			let jsonContent: unknown

			try {
				jsonContent = JSON.parse(content)
			} catch {
				vscode.window.showErrorMessage(`Failed to parse ${fileName}`)
				return
			}

			// Prettify the JSON
			const prettifiedContent = JSON.stringify(jsonContent, null, 2)

			// Create a temporary file
			const tmpDir = os.tmpdir()
			const timestamp = Date.now()
			const tempFileName = `jabberwock-debug-ui-${currentTask.taskId.slice(0, 8)}-${timestamp}.json`
			const tempFilePath = path.join(tmpDir, tempFileName)

			await fs.writeFile(tempFilePath, prettifiedContent, "utf8")

			// Open the temp file in VS Code
			const doc = await vscode.workspace.openTextDocument(tempFilePath)
			await vscode.window.showTextDocument(doc, { preview: true })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Error opening debug history: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to open debug history: ${errorMessage}`)
		}
	},

	downloadErrorDiagnostics: async (provider, message) => {
		const currentTask = provider.getCurrentTask()
		if (!currentTask) {
			vscode.window.showErrorMessage("No active task to generate diagnostics for")
			return
		}

		await generateErrorDiagnostics({
			taskId: currentTask.taskId,
			globalStoragePath: provider.contextProxy.globalStorageUri.fsPath,
			values: message.values,
			log: (msg: string) => provider.log(msg),
		})
	},
}
