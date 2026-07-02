import type { ExtensionBridge } from "./bridge.js"
import { MessageInterceptor } from "./utils/interceptor.js"
import * as vscode from "vscode"
import type { BackendStore, FrontendBridge } from "./mst/types.js"
import { registerGlobalErrorHandlers, nextRequestId, DevtoolBridgeProvider } from "./factories/factory-helpers.js"
import { handleGetConsole, handleSearchConsole } from "./factories/factory-console.js"
import { createDomBridgeMethods } from "./factories/factory-dom.js"
import { createStateMethods } from "./factories/factory-state.js"

/**
 * Creates an ExtensionBridge from a DevtoolBridgeProvider implementation.
 * The bridge provides all MCP tool handlers with typed methods.
 */
export function createDevtoolBridge(
	provider: DevtoolBridgeProvider,
	backendStore?: BackendStore,
	frontendBridge?: FrontendBridge,
): ExtensionBridge {
	registerGlobalErrorHandlers()

	const interceptor = new MessageInterceptor({
		executeVscodeCommand: async (command: string, args: unknown) => {
			await vscode.commands.executeCommand(command, ...(Array.isArray(args) ? args : []))
			return ""
		},
		getActivePage: async () => {
			const requestId = nextRequestId()
			return new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("getActivePage timed out"))
				}, 10_000)
				provider.setActivePageRequestCallback(requestId, (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				})
				provider.postMessageToWebview("action", { action: "getActivePage", requestId })
			})
		},
	} as ExtensionBridge)

	const domMethods = createDomBridgeMethods(provider)

	return {
		async executeVscodeCommand(command: string, args?: unknown): Promise<string> {
			await vscode.commands.executeCommand(command, ...(Array.isArray(args) ? args : []))
			return JSON.stringify({ success: true, command })
		},

		async getActivePage() {
			const requestId = nextRequestId()
			return new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("getActivePage timed out"))
				}, 10_000)
				provider.setActivePageRequestCallback(requestId, (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				})
				provider.postMessageToWebview("action", { action: "getActivePage", requestId })
			})
		},

		async getConsole({ env, level, limit = 10, cursor = 0, search }) {
			return handleGetConsole({ env, level, limit, cursor, search }, frontendBridge)
		},

		async searchConsole({ env, query, level, limit = 10, cursor = 0 }) {
			return handleSearchConsole({ env, query, level, limit, cursor }, frontendBridge)
		},

		...createStateMethods(provider, backendStore, frontendBridge, interceptor),

		...domMethods,
	}
}
