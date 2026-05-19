import * as vscode from "vscode"
import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { ProviderSettingsEntry, ClineMessage } from "@jabberwock/types"
import type WorkspaceTracker from "../../../integrations/workspace/WorkspaceTracker"
import type { IBackendRootStore } from "../../store"
import { jabberwockLog } from "../../../utils/jabberwock-logger"
import {
	WebviewViewType,
	DisposablesType,
	PendingDomRequestsType,
	PendingActivePageRequestsType,
	PendingPushTimersType,
	StoreRefType,
} from "../../mst-custom-types"
// Dynamic import to avoid circular dependency: store.ts → webviewMessageHandler → handlers → store.ts
import { getNonce } from "../../../utils/getNonce"
import { getUri } from "../../../utils/getUri"

export const WindowManagerModel = types
	.model("WindowManager", {
		view: WebviewViewType,
		disposables: DisposablesType,
		webviewDisposables: DisposablesType,
		viewLaunched: types.boolean,
		workspaceStore: StoreRefType,
		workspaceTracker: StoreRefType,
		pendingDomRequests: PendingDomRequestsType,
		pendingActivePageRequests: PendingActivePageRequestsType,
		pendingPushTimers: PendingPushTimersType,
	})
	.actions((self) => ({
		setView(view: vscode.WebviewView | vscode.WebviewPanel | null) {
			self.view = view
		},
		setViewLaunched(val: boolean) {
			self.viewLaunched = val
		},
		setWorkspaceStore(store: Record<string, unknown> | null) {
			self.workspaceStore = store
		},
		setWorkspaceTracker(tracker: Record<string, unknown> | null) {
			self.workspaceTracker = tracker
		},
		addDisposable(d: vscode.Disposable) {
			self.disposables.push(d)
		},
		addWebviewDisposable(d: vscode.Disposable) {
			self.webviewDisposables.push(d)
		},
		clearWebviewDisposables() {
			self.webviewDisposables.splice(0, self.webviewDisposables.length)
		},
		setDomRequestCallback(
			requestId: string,
			callback: (result: string) => void,
			type: string,
			params: Record<string, unknown>,
		) {
			self.pendingDomRequests.set(requestId, {
				callback,
				meta: { requestId, type, params, timestamp: Date.now(), status: "pending" as const },
			})
		},
		resolveDomRequest(requestId: string, result: string) {
			const entry = self.pendingDomRequests.get(requestId)
			if (entry) {
				entry.meta.status = "resolved"
				entry.callback(result)
				self.pendingDomRequests.delete(requestId)
			}
		},
		setActivePageRequestCallback(requestId: string, callback: (activePage: string) => void) {
			self.pendingActivePageRequests.set(requestId, callback)
		},
		resolveActivePageRequest(requestId: string, activePage: string) {
			const cb = self.pendingActivePageRequests.get(requestId)
			if (cb) {
				cb(activePage)
				self.pendingActivePageRequests.delete(requestId)
			}
		},
		scheduleStatePush(callback: () => void, ms: number) {
			const existing = self.pendingPushTimers.get("push")
			if (existing) clearTimeout(existing)
			const timer = setTimeout(() => {
				self.pendingPushTimers.delete("push")
				callback()
			}, ms)
			self.pendingPushTimers.set("push", timer)
		},
	}))

export type IWindowManagerModel = Instance<typeof WindowManagerModel>

// ── Backward-compatible types and functions ──────────────────────────────────

export interface WindowManagerState {
	view: vscode.WebviewView | vscode.WebviewPanel | null
	disposables: vscode.Disposable[]
	webviewDisposables: vscode.Disposable[]
	viewLaunched: boolean
	workspaceStore: Record<string, unknown> | null
	workspaceTracker: WorkspaceTracker | null
	pendingDomRequests: Map<string, (result: string) => void>
	pendingActivePageRequests: Map<string, (activePage: string) => void>
}

const PUSH_DEBOUNCE_MS = 50

export function initWindowManagerState(_provider: EventBridge): void {
	// No-op — state is initialized via MST model defaults
}

/**
 * Lazy import to avoid circular dependency:
 * window-manager/store.ts → store.ts → foundation/store.ts → window-manager/store.ts (re-entrant)
 * This is only safe because getState() is always called inside function bodies,
 * never during module initialization.
 */
function lazyGetState(provider: EventBridge): { foundation: { windowManager: IWindowManagerModel } } {
	const storeModule = require("../../storeSingleton") as { getState: (p: EventBridge) => IBackendRootStore }
	const rootStore = storeModule.getState(provider)
	return rootStore as { foundation: { windowManager: IWindowManagerModel } }
}

export function getWindowManagerState(provider: EventBridge): IWindowManagerModel {
	return lazyGetState(provider).foundation.windowManager as IWindowManagerModel
}

/**
 * Gets or lazily creates the WorkspaceTracker for the given provider.
 */
export async function getWorkspaceTracker(provider: EventBridge): Promise<WorkspaceTracker | undefined> {
	const state = getWindowManagerState(provider)
	if (!state.workspaceTracker) {
		const { default: WorkspaceTracker } = await import("../../../integrations/workspace/WorkspaceTracker")
		// StoreRefType's runtime check accepts any non-null object.
		// Package the tracker in an object literal (assignable to Record<string, unknown>)
		// and unwrap it on read.
		state.setWorkspaceTracker({ __tracker: new WorkspaceTracker(provider) })
	}
	const holder = state.workspaceTracker
	return holder && typeof holder === "object" && "__tracker" in holder
		? (holder as { __tracker: WorkspaceTracker }).__tracker
		: undefined
}

export async function resolveWebviewView(provider: EventBridge, webviewView: vscode.WebviewView | vscode.WebviewPanel) {
	let state: IWindowManagerModel
	try {
		state = getWindowManagerState(provider)
		state.setView(webviewView)
	} catch (error) {
		const errorMessage = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error)
		console.error(`[resolveWebviewView] Error:`, errorMessage)
		// Show error in webview instead of throwing to VS Code's generic dialog
		if (webviewView?.webview) {
			webviewView.webview.html = getErrorHtml(errorMessage)
			return
		}
		throw error
	}

	const webview = webviewView.webview
	webview.options = {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(provider.context.extensionUri, "webview-ui", "build")],
	}

	// Set up message listener with error handling to prevent unhandled promise
	// rejections from breaking the webview message channel (which would cause
	// Settings to stop opening, DevTool to disconnect, and messages to fail).
	const messageDisposable = webview.onDidReceiveMessage(async (message: Record<string, unknown>) => {
		try {
			const { webviewMessageHandler } = await import("../../../core/webview/webviewMessageHandler")
			await webviewMessageHandler(provider, message)
		} catch (error) {
			console.error(
				`[resolveWebviewView] Unhandled error processing message:`,
				error instanceof Error ? error.message : String(error),
			)
		}
	})
	state.addDisposable(messageDisposable)

	// Handle webview disposal
	state.addWebviewDisposable(
		webviewView.onDidDispose(() => {
			state.webviewDisposables.forEach((d) => d.dispose())
			state.clearWebviewDisposables()
			if (state.view === webviewView) {
				state.setView(null)
			}
		}),
	)

	// Set HTML content (HMR in dev mode, build assets in production)
	if (provider.context.extensionMode === vscode.ExtensionMode.Development) {
		webview.html = getHMRHtmlContent(provider, webview)
	} else {
		webview.html = getHtmlContent(provider, webview)
	}

	// Load persisted API configuration from ProviderSettingsManager and include it
	// in the initial state so the webview doesn't show the welcome screen unnecessarily.
	// Also auto-select the first config profile when none is currently selected.
	let initialState: Record<string, unknown> = {}
	try {
		if (provider.providerSettingsManager) {
			const psm = provider.providerSettingsManager
			let currentConfigName = provider.contextProxy?.getGlobalState?.("currentApiConfigName")

			// Load the list of API configs for the config selector UI
			let listApiConfig = [] as ProviderSettingsEntry[]
			try {
				listApiConfig = await psm.listConfig()
				initialState.listApiConfigMeta = listApiConfig
			} catch (_e) {
				// Non-critical: config list is loaded on-demand
			}

			// Auto-select the first config profile when none is currently selected
			if (!currentConfigName && listApiConfig.length > 0) {
				const firstName = listApiConfig[0].name
				try {
					await provider.contextProxy?.updateGlobalState?.("currentApiConfigName", firstName)
					currentConfigName = firstName
				} catch (_e) {
					// Non-critical
				}
			}

			if (currentConfigName) {
				const profile = await psm.getProfile({ name: currentConfigName })
				if (profile) {
					const { name: _, ...apiConfiguration } = profile
					initialState.apiConfiguration = apiConfiguration
				}
			}
		}
	} catch (error) {
		// Non-critical
	}

	// Send initial state to webview (with persisted config if available)
	await postStateToWebview(provider, Object.keys(initialState).length > 0 ? initialState : undefined)

	// Mark the webview as fully launched — this enables API methods (sendMessage,
	// resumeTask, isReady, waitForWebviewLaunch) to route through the webview
	// instead of falling back to headless mode.
	state.setViewLaunched(true)

	// Initialize code index status subscription for the current workspace
	;(provider as { codeIndexManager?: { updateSubscription?: () => void } }).codeIndexManager?.updateSubscription?.()

	// Listen for active editor changes to update code index status
	const activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor(() => {
		;(
			provider as { codeIndexManager?: { updateSubscription?: () => void } }
		).codeIndexManager?.updateSubscription?.()
	})
	state.addWebviewDisposable(activeEditorSubscription)

	// Listen for visibility changes
	if ("onDidChangeViewState" in webviewView) {
		const viewStateDisposable = webviewView.onDidChangeViewState(() => {
			if (state.view?.visible) {
				postMessageToWebview(provider, { type: "action", action: "didBecomeVisible" })
			}
		})
		state.addWebviewDisposable(viewStateDisposable)
	} else if ("onDidChangeVisibility" in webviewView) {
		const visibilityDisposable = webviewView.onDidChangeVisibility(() => {
			if (state.view?.visible) {
				postMessageToWebview(provider, { type: "action", action: "didBecomeVisible" })
			}
		})
		state.addWebviewDisposable(visibilityDisposable)
	}

	// Listen for configuration changes (e.g., color theme)
	const configDisposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
		if (e.affectsConfiguration("workbench.colorTheme")) {
			const { getTheme } = await import("../../../integrations/theme/getTheme")
			await postMessageToWebview(provider, { type: "theme", text: JSON.stringify(await getTheme()) })
		}
	})
	state.addWebviewDisposable(configDisposable)
}

function getHtmlContent(provider: EventBridge, webview: vscode.Webview): string {
	const nonce = getNonce()
	const scriptUri = getUri(webview, provider.context.extensionUri, ["webview-ui", "build", "assets", "index.js"])
	const styleUri = getUri(webview, provider.context.extensionUri, ["webview-ui", "build", "assets", "index.css"])

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval' https://file+.vscode-resource.vscode-cdn.net 'nonce-${nonce}'; connect-src 'self' https: http:">
	<link rel="stylesheet" type="text/css" href="${styleUri}">
	<title>Jabberwock</title>
</head>
<body>
	<div id="root"></div>
	<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

/**
 * Returns HTML content pointing to the Vite dev server for HMR during development.
 */
function getHMRHtmlContent(provider: EventBridge, webview: vscode.Webview): string {
	const nonce = getNonce()
	const scriptUri = getUri(webview, provider.context.extensionUri, ["webview-ui", "build", "assets", "index.js"])
	const styleUri = getUri(webview, provider.context.extensionUri, ["webview-ui", "build", "assets", "index.css"])

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval' https://file+.vscode-resource.vscode-cdn.net 'nonce-${nonce}'; connect-src 'self' https: http:">
	<link rel="stylesheet" type="text/css" href="${styleUri}">
	<title>Jabberwock</title>
</head>
<body>
	<div id="root"></div>
	<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

/**
 * Returns HTML content for displaying an error message in the webview.
 */
function getErrorHtml(errorMessage: string): string {
	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Jabberwock Error</title>
	<style>
		body { padding: 20px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
		.error { color: var(--vscode-errorForeground); }
		.details {
			margin-top: 12px;
			padding: 12px;
			background: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			border-radius: 4px;
			font-family: monospace;
			white-space: pre-wrap;
			word-break: break-all;
			font-size: 12px;
		}
	</style>
</head>
<body>
	<h2 class="error">Failed to load Jabberwock</h2>
	<p>An unexpected error occurred. Please try reloading the window.</p>
	<div class="details">${escapeHtml(errorMessage)}</div>
</body>
</html>`
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// ── Debounced state push ──────────────────────────────────────────────────
// Prevents rapid consecutive calls (e.g., 3 per runMainLoop iteration) from
// flooding the webview with redundant state updates. Only the LAST call in a
// 50ms window is delivered.

export function scheduleStatePush(provider: EventBridge, state?: Record<string, unknown>): void {
	const stateModel = lazyGetState(provider).foundation.windowManager as IWindowManagerModel
	stateModel.scheduleStatePush(() => {
		postStateToWebview(provider, state)
	}, PUSH_DEBOUNCE_MS)
}

export function postMessageToWebview(provider: EventBridge, message: unknown) {
	const state = getWindowManagerState(provider)
	if (state.view) {
		state.view.webview.postMessage(message)
	} else {
		const msg = message as Record<string, unknown>
		console.warn(`[DEBUG:POSTMSG] postMessageToWebview SKIPPED - no provider.view! type=${msg?.type}`)
	}
}

/**
 * Posts the current state to the webview.
 */
export async function postStateToWebview(
	provider: EventBridge,
	additionalState?: Record<string, unknown>,
): Promise<void> {
	const state = getWindowManagerState(provider)

	// Always enrich the state with apiConfiguration and listApiConfigMeta so that
	// callers who pass no args (or minimal state) don't accidentally send an empty
	// "state: {}" message to the webview, which would trigger unnecessary re-renders
	// and potentially cause cascading postMessage loops.
	const enrichedState = { ...(additionalState ?? {}) }

	// Always include currentApiConfigName so the webview has the latest selection
	if (!enrichedState.currentApiConfigName) {
		const currentConfigName = provider.contextProxy?.getGlobalState?.("currentApiConfigName")
		if (currentConfigName) {
			enrichedState.currentApiConfigName = currentConfigName
		}
	}

	if (!enrichedState.apiConfiguration || !enrichedState.listApiConfigMeta) {
		try {
			const { getBackendRootStore } = await import("../../storeSingleton")
			const store = getBackendRootStore()
			const apiConfig = store.settings.apiConfig

			if (!enrichedState.listApiConfigMeta && apiConfig.listApiConfigMeta) {
				enrichedState.listApiConfigMeta = apiConfig.listApiConfigMeta
			}
			if (!enrichedState.apiConfiguration && apiConfig.apiProvider) {
				enrichedState.apiConfiguration = apiConfig.toProviderSettings()
			}
		} catch {
			// Non-critical — state push continues without enrichment
		}
	}

	// NEVER send empty state — doing so causes the webview to re-render
	// pointlessly and can trigger cascading postMessage loops.
	if (Object.keys(enrichedState).length === 0) {
		return
	}

	const messages = enrichedState.clineMessages as ClineMessage[] | undefined
	if (messages && messages.length > 0) {
		const lastMessage = messages[messages.length - 1]
		const lastMessageType = `${lastMessage.type}:${lastMessage.say ?? lastMessage.ask ?? "unknown"}`
		jabberwockLog.log("state:clineMessages", {
			count: messages.length,
			lastMessageType,
			hasPendingAsks: messages.some((m) => m.type === "ask"),
		})
	}

	if (state.view) {
		await provider.postMessageToWebview({ type: "state", state: enrichedState })
	} else {
		console.warn(`[DEBUG:POSTMSG] postStateToWebview SKIPPED - no provider.view!`)
	}
}

/**
 * Posts full state minus clineMessages to the webview.
 * Loads api configuration, settings, and currentApiConfigName from the provider.
 */
export async function postStateToWebviewWithoutClineMessages(provider: EventBridge): Promise<void> {
	const state: Record<string, unknown> = {}
	try {
		const psm = provider.providerSettingsManager
		if (psm) {
			state.listApiConfigMeta = await psm.listConfig()
			const currentConfigName = provider.contextProxy?.getGlobalState?.("currentApiConfigName")
			if (currentConfigName) {
				const profile = await psm.getProfile({ name: currentConfigName })
				if (profile) {
					const { name: _, ...apiConfig } = profile
					state.apiConfiguration = apiConfig
				}
			}
		}

		// Include settings from contextProxy
		const settings = provider.contextProxy?.getValues?.()
		if (settings) {
			Object.assign(state, settings)
		}

		// Include currentApiConfigName for UI state
		const currentConfigName = provider.contextProxy?.getGlobalState?.("currentApiConfigName")
		if (currentConfigName) {
			state.currentApiConfigName = currentConfigName
		}
	} catch {
		// Non-critical
	}

	await postStateToWebview(provider, Object.keys(state).length > 0 ? state : undefined)
}

/**
 * Alias for postStateToWebviewWithoutClineMessages.
 * Posts state to webview excluding task history / cline messages.
 */
export async function postStateToWebviewWithoutTaskHistory(provider: EventBridge): Promise<void> {
	await postStateToWebviewWithoutClineMessages(provider)
}

/**
 * Refreshes the workspace.
 */
export async function refreshWorkspace(provider: EventBridge): Promise<void> {
	await vscode.commands.executeCommand("workbench.action.reloadWindow")
}

/**
 * Handles mode switching: updates global state, loads/saves API config per mode,
 * updates task mode, and posts updated state to webview.
 */
export async function handleModeSwitch(provider: EventBridge, modeSlug: string): Promise<void> {
	// 1. Check lockApiConfigAcrossModes (read-time override)
	const lockApiConfig = (provider.contextProxy as { getValue?: (key: string) => unknown }).getValue?.(
		"lockApiConfigAcrossModes",
	)

	// 2. Update global state mode
	await provider.updateGlobalState("mode", modeSlug)

	// 3. If not locked, handle mode-specific API config
	if (!lockApiConfig) {
		const psm = provider.providerSettingsManager
		if (psm) {
			const modeConfigId = await psm.getModeConfigId(modeSlug)
			if (modeConfigId) {
				const profiles = await psm.listConfig()
				const profile = profiles.find((p) => p.id === modeConfigId)
				if (profile) {
					const { activateProviderProfile } = await import("../../settings/api-config/store")
					await activateProviderProfile(provider, { name: profile.name })
					await provider.updateGlobalState("currentApiConfigName", profile.name)
				}
			} else {
				// Save current config as default for new mode
				const currentConfigName = provider.contextProxy?.getGlobalState?.("currentApiConfigName")
				if (currentConfigName) {
					const profiles = await psm.listConfig()
					const currentProfile = profiles.find((p) => p.name === currentConfigName)
					if (currentProfile) {
						await psm.setModeConfig(modeSlug, currentProfile.id)
					}
				}
			}
		}
	}

	// 4. Update task mode if task exists
	const currentTask = provider.getCurrentTask()
	if (currentTask?.setTaskMode) {
		currentTask.setTaskMode(modeSlug)
	}

	// 5. Update task history metadata with new mode
	if (currentTask) {
		try {
			const { updateTaskHistory } = await import("../../history/store")
			const historyItem = {
				id: currentTask.taskId,
				mode: modeSlug,
			}
			await updateTaskHistory(provider, historyItem)
		} catch {
			// Non-critical — history update is best-effort
		}
	}

	// 6. Post state to webview
	await postStateToWebview(provider)
}

export function resolveActivePageRequest(provider: EventBridge, requestId: string, activePage: string) {
	const stateModel = lazyGetState(provider).foundation.windowManager as IWindowManagerModel
	stateModel.resolveActivePageRequest(requestId, activePage)
}
