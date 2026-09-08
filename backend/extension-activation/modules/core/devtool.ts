import * as vscode from "vscode"

import { getSnapshot } from "mobx-state-tree"
import {
	Devtool,
	createDevtoolBridge,
	registerDomResponseHandler,
	createFrontendBridge,
	diagnosticsManager,
} from "@jabberwock/devtool"
import { Package } from "@shared/package"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getBackendRootStore } from "@features/storeSingleton"
import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"

export async function setupDevtool(provider: EventBridge, outputChannel: vscode.OutputChannel): Promise<void> {
	try {
		const devtoolEnabled = vscode.workspace.getConfiguration(Package.name).get<boolean>("devtool", true)
		if (!devtoolEnabled) {
			console.log(`[extension] DevTool disabled by setting`)
			return
		}

		const devtoolPort = vscode.workspace.getConfiguration(Package.name).get<number>("devtoolServerPort", 60060)
		const backendStore = getBackendRootStore()

		try {
			registerDomResponseHandler(
				(type, handler) => {
					onWebviewMessage(type, (p, message) => {
						handler(p, { ...message })
					})
				},
				(requestId, result) => {
					backendStore.foundation.windowManager.resolveDomRequest(requestId, result)
				},
			)

			const devtoolProvider = toDevtoolBridgeProvider(provider)
			const frontendBridge = createFrontendBridge({
				postMessageToWebview: (message) =>
					provider.postMessageToWebview(
						message as import("@features/foundation/window-manager/store").WebviewOutboundMessage,
					),
				setDomRequestCallback: (requestId, callback) =>
					devtoolProvider.setDomRequestCallback(requestId, callback),
			})

			const bridge = createDevtoolBridge(
				devtoolProvider,
				{
					getMstStore: () => {
						const snapshot = getSnapshot(backendStore) as Record<string, unknown>
						return snapshot as {
							foundation: { windowManager: Record<string, unknown> }
							chat: Record<string, unknown>
							settings: Record<string, unknown>
						}
					},
				},
				frontendBridge,
			)
			const devtool = new Devtool(bridge, undefined, devtoolPort)
			await devtool.start()
			diagnosticsManager.registerConsoleInterceptor()
			console.log(`[extension] DevTool WebSocket server started on port ${devtoolPort}`)
			outputChannel.appendLine(`[DevTool] WebSocket MCP server listening on ws://127.0.0.1:${devtoolPort}/ws`)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			console.warn(`[jabberwock] [extension] Failed to start DevTool server:`, err)
			outputChannel.appendLine(`[DevTool] Failed to start server on port ${devtoolPort}: ${msg}`)
			vscode.window.showWarningMessage(
				`DevTool server failed to start on port ${devtoolPort}: ${msg}. ` +
					`Check that port ${devtoolPort} is not in use.`,
			)
		}
	} catch (error) {
		console.warn(`[jabberwock] [extension] Error initializing DevTool:`, error)
	}
}

function toDevtoolBridgeProvider(provider: EventBridge) {
	const rootStore = () => getBackendRootStore()

	return {
		getActivePage: (requestId: string) => {
			provider.postMessageToWebview({
				type: "action",
				action: "getActivePage",
				requestId,
			} as import("@features/foundation/window-manager/store").WebviewOutboundMessage)
		},
		findElement: async (selector: string, depth?: number, maxChildren?: number, command?: string) => {
			const wm = rootStore().foundation.windowManager
			const requestId = Math.random().toString(36).substring(7)

			return new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`Timeout waiting for DOM response (findElement, req: ${requestId})`))
				}, 10000)

				wm.setDomRequestCallback(
					requestId,
					(result: string) => {
						clearTimeout(timeout)
						resolve(result)
					},
					command ?? "findElementById",
					{ selector, depth, maxChildren, command },
				)

				provider.postMessageToWebview({
					type: "action",
					action: command ?? "findElementById",
					requestId,
					selector,
					depth: depth ?? 0,
					maxChildren: maxChildren ?? 0,
				})
			})
		},

		getModes: () => {
			return [] as string[]
		},

		postMessageToWebview: (type: string, payload?: Record<string, unknown>) => {
			provider.postMessageToWebview({
				type,
				...payload,
			} as import("@features/foundation/window-manager/store").WebviewOutboundMessage)
		},

		setDomRequestCallback: (requestId: string, callback: (result: string) => void) => {
			const wm = rootStore().foundation.windowManager
			wm.setDomRequestCallback(requestId, callback, "dom-request-callback", { requestId })
		},

		setActivePageRequestCallback: (requestId: string, callback: (result: string) => void) => {
			rootStore().foundation.windowManager.setActivePageRequestCallback(requestId, callback)
		},

		getMode: () => {
			return "unknown"
		},

		// D4g-2 (batch 1): host command adapter - the devtool bridge executes host commands through
		// this slot instead of importing "vscode" in the shared devtool package (plan section 3.2 Strategy C).
		executeCommand: async (command: string, args?: unknown) => {
			await vscode.commands.executeCommand(command, ...(Array.isArray(args) ? args : []))
		},
		// D4g-2 (batch 1): extension version for the devtool getExtensionInfo tool.
		getExtensionVersion: () => {
			const ext = vscode.extensions.getExtension("rooveterinaryinc.roo-cline")
			return ext?.packageJSON?.version
		},

		getTaskWithId: undefined,
	}
}
