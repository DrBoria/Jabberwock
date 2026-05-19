import * as vscode from "vscode"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage, ExtensionMessage } from "@jabberwock/types"
import { getWindowManagerState } from "../../foundation/window-manager/store"

import { postStateToWebview } from "../../foundation/window-manager/store"

type MessagePayload = WebviewMessage & { [key: string]: unknown }
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	devtoolStatus: async (provider, message) => {
		const { Package } = await import("../../../shared/package")
		const config = vscode.workspace.getConfiguration(Package.name)
		const current = config.get<boolean>("devtool", false)
		await config.update("devtool", !current, vscode.ConfigurationTarget.Global)
	},

	webviewLog: async (provider, message) => {
		const { diagnosticsManager } = await import("@jabberwock/devtool")
		diagnosticsManager.log(message.text || "")
	},

	domResponse: async (provider, message) => {
		if ((message as MessagePayload).requestId) {
			console.log(
				`[DEBUG: DOM] Extension: Received domResponse for ${(message as MessagePayload).requestId} (text: ${((message as MessagePayload).text || "").length} chars)`,
			)
			// Debug: check pendingDomRequests before resolving
			const pendingRequests = getWindowManagerState(provider)?.pendingDomRequests
			if (pendingRequests) {
				const requestId = (message as MessagePayload).requestId
				console.log(
					`[DEBUG: DOM] pendingDomRequests size before resolve: ${pendingRequests.size}, has requestId: ${requestId != null ? pendingRequests.has(requestId) : false}`,
				)
			} else {
				console.log(`[DEBUG: DOM] CRITICAL: pendingDomRequests is undefined on WindowManagerState!`)
			}
			const requestId = (message as MessagePayload).requestId
			if (requestId) {
				getWindowManagerState(provider)
					.pendingDomRequests.get(requestId)
					?.callback((message as MessagePayload).text || "")
			}
		} else {
			console.log(`[DEBUG: DOM] Extension: Received invalid domResponse (missing requestId)`)
		}
	},

	webviewError: async (provider, message) => {
		if (message.text) {
			const { diagnosticsManager } = await import("@jabberwock/devtool")
			diagnosticsManager.log(`[WEBVIEW_ERROR] ${message.text}`, "error")
			vscode.window.showErrorMessage(`Webview Error: ${message.text}`)
		}
	},

	/**
	 * Handles fetchUrl requests from the webview DevTools.
	 * The webview's browser `fetch()` is blocked by CORS for cross-origin URLs,
	 * but the extension host (Node.js) has no CORS restrictions.
	 * We fetch the URL here and return the HTML content back to the webview.
	 */
	fetchUrl: async (provider, message) => {
		const url = (message as MessagePayload).url
		const requestId = (message as MessagePayload).requestId
		if (!url || !requestId) return
		try {
			const response = await fetch(url)
			const html = await response.text()
			await provider.postMessageToWebview({
				type: "fetchUrlResponse",
				requestId,
				text: html,
			})
		} catch (err) {
			await provider.postMessageToWebview({
				type: "fetchUrlResponse",
				requestId,
				text: "",
				error: `fetchUrl error: ${err instanceof Error ? err.message : String(err)}`,
			})
		}
	},

	LOCATOR_OPEN_FILE: async (provider, message) => {
		const locatorPayload = (message as MessagePayload).locatorPayload
		if (locatorPayload) {
			const { filePath, line, column } = locatorPayload
			const globalSettings = provider.contextProxy.getValues()
			const locatorPrefix =
				globalSettings.locatorTarget && globalSettings.locatorTarget.trim() !== ""
					? globalSettings.locatorTarget
					: "code"

			console.log(
				`[LOCATOR] Editor open requested for ${filePath} at ${line}:${column} using prefix ${locatorPrefix}`,
			)
			try {
				const targetLine = isNaN(line) ? 1 : line
				const targetColumn = isNaN(column) ? 1 : column

				// Construct Custom URI (e.g. code://file/path/to/file:line:col)
				const uriString = `${locatorPrefix}://file${filePath}:${targetLine}:${targetColumn}`
				const uri = vscode.Uri.parse(uriString)

				await vscode.env.openExternal(uri)
			} catch (error) {
				console.error("LocatorJS Bridge Error:", error)
				vscode.window.showErrorMessage(
					`LocatorJS: Failed to open file using protocol ${locatorPrefix}: ${error}`,
				)
			}
		}
	},

	locatorTarget: async (provider, message) => {
		if (message.text) {
			const target = message.text as string
			await provider.contextProxy.setValue("locatorTarget", target)
			await postStateToWebview(provider)
		}
	},
}
