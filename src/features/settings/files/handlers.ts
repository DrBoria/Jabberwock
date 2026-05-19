import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { openFile } from "../../../integrations/misc/open-file"
import { openImage, saveImage } from "../../../integrations/misc/image-handler"
import { openMention } from "../../../core/mentions"
import { resolveDefaultSaveUri, saveLastExportPath } from "../../../utils/export"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	openImage: async (provider, message) => {
		openImage(message.text!, { values: message.values })
	},

	saveImage: async (provider, message) => {
		const dataUri = message.dataUri
		if (dataUri) {
			const matches = dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
			if (!matches) {
				// Let saveImage handle invalid URI error
				saveImage(dataUri, vscode.Uri.file(""))
				return
			}
			const format = matches[1]
			const defaultFileName = `img_${Date.now()}.${format}`

			const defaultUri = await resolveDefaultSaveUri(
				provider.contextProxy,
				"lastImageSavePath",
				defaultFileName,
				{
					useWorkspace: false,
					fallbackDir: path.join(os.homedir(), "Downloads"),
				},
			)

			const savedUri = await saveImage(dataUri, defaultUri)

			if (savedUri) {
				await saveLastExportPath(provider.contextProxy, "lastImageSavePath", savedUri)
			}
		}
	},

	openFile: async (provider, message) => {
		const getCurrentCwd = () => {
			return provider.getCurrentTask()?.cwd || provider.cwd
		}
		let filePath: string = message.text!
		if (!path.isAbsolute(filePath)) {
			filePath = path.join(getCurrentCwd(), filePath)
		}
		openFile(filePath, message.values as { create?: boolean; content?: string; line?: number })
	},

	readFileContent: async (provider, message) => {
		const getCurrentCwd = () => {
			return provider.getCurrentTask()?.cwd || provider.cwd
		}
		const relPath = message.text || ""
		if (!relPath) {
			provider.postMessageToWebview({
				type: "fileContent",
				fileContent: { path: relPath, content: null, error: "No path provided" },
			})
			return
		}
		try {
			const cwd = getCurrentCwd()
			if (!cwd) {
				provider.postMessageToWebview({
					type: "fileContent",
					fileContent: { path: relPath, content: null, error: "No workspace path available" },
				})
				return
			}
			const absPath = path.resolve(cwd, relPath)
			// Workspace-boundary validation: prevent path traversal attacks
			if (isPathOutsideWorkspace(absPath)) {
				provider.postMessageToWebview({
					type: "fileContent",
					fileContent: { path: relPath, content: null, error: "Path is outside workspace" },
				})
				return
			}
			const content = await fs.readFile(absPath, "utf-8")
			provider.postMessageToWebview({ type: "fileContent", fileContent: { path: relPath, content } })
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err)
			provider.postMessageToWebview({
				type: "fileContent",
				fileContent: { path: relPath, content: null, error: errorMsg },
			})
		}
	},

	openExternal: async (provider, message) => {
		if (message.url) {
			vscode.env.openExternal(vscode.Uri.parse(message.url))
		}
	},

	openMention: async (provider, message) => {
		const getCurrentCwd = () => {
			return provider.getCurrentTask()?.cwd || provider.cwd
		}
		openMention(getCurrentCwd(), message.text)
	},
}
