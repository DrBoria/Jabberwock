import * as vscode from "vscode"
import * as path from "path"
import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../features/foundation/webview/EventBridge"
import type { ProviderSettingsEntry, Notification } from "@jabberwock/types"
import WorkspaceTracker from "../../../integrations/workspace/WorkspaceTracker"
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
import { getNonce } from "../../../utils/getNonce"
import { getUri } from "../../../utils/getUri"
import { getBackendRootStore } from "@features/storeSingleton"
import { getTheme } from "../../../integrations/theme/getTheme"
import { activateProviderProfile } from "../../settings/models/api-config-store"
import { setupSyncer } from "./syncer"
import { updateTaskHistory } from "../../history/actions"
import { getVscodeContext } from "../../foundation/vscode/context"
import { getSettingsAccess } from "@utils/settings-access"
import { getProviderSettingsManager } from "../../settings/models/ProviderSettingsManager"

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
		setWorkspaceStore(store: WorkspaceStoreData) {
			self.workspaceStore = store
		},
		setWorkspaceTracker(tracker: WorkspaceStoreData) {
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
			params: { [key: string]: unknown },
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
		clearPendingPushTimers() {
			for (const [, timer] of self.pendingPushTimers) {
				clearTimeout(timer)
			}
			self.pendingPushTimers.clear()
		},
	}))

export type IWindowManagerModel = Instance<typeof WindowManagerModel>

export type WorkspaceStoreData = { [key: string]: unknown } | null

/** Payload type for WebviewOutboundMessage "state" variant */
export type WebviewStatePayload = { [key: string]: unknown }

// ── Backward-compatible types and functions ──────────────────────────────────

export interface WindowManagerState {
	view: vscode.WebviewView | vscode.WebviewPanel | null
	disposables: vscode.Disposable[]
	webviewDisposables: vscode.Disposable[]
	viewLaunched: boolean
	workspaceStore: WorkspaceStoreData
	workspaceTracker: WorkspaceTracker | null
	pendingDomRequests: Map<string, (result: string) => void>
	pendingActivePageRequests: Map<string, (activePage: string) => void>
}

const PUSH_DEBOUNCE_MS = 50

export function initWindowManagerState(_provider: EventBridge): void {
	// No-op — state is initialized via MST model defaults
}

function lazyGetState(provider: EventBridge): { foundation: { windowManager: IWindowManagerModel } } {
	const rootStore = getBackendRootStore()
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
		// StoreRefType's runtime check accepts any non-null object.
		// Package the tracker in an object literal (assignable to { [key: string]: unknown })
		// and unwrap it on read.
		state.setWorkspaceTracker({ __tracker: new WorkspaceTracker(provider) })
	}
	const holder = state.workspaceTracker
	return holder && typeof holder === "object" && "__tracker" in holder
		? (holder as { __tracker: WorkspaceTracker }).__tracker
		: undefined
}

// Type for webview message handler function
export type WebviewMessageHandler = (provider: EventBridge, message: { [key: string]: unknown }) => Promise<void>

export async function resolveWebviewView(
	provider: EventBridge,
	webviewView: vscode.WebviewView | vscode.WebviewPanel,
	messageHandler?: WebviewMessageHandler,
) {
	let state: IWindowManagerModel
	try {
		state = getWindowManagerState(provider)
		state.setView(webviewView)
	} catch (error) {
		const errorMessage = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error)
		console.error(`[jabberwock] [resolveWebviewView] Error:`, errorMessage)
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
		localResourceRoots: [
			vscode.Uri.file(path.join(path.dirname(getVscodeContext().extensionUri.fsPath), "webview-ui", "build")),
		],
	}

	// Set up message listener with error handling to prevent unhandled promise
	// rejections from breaking the webview message channel (which would cause
	// Settings to stop opening, DevTool to disconnect, and messages to fail).
	const handler =
		messageHandler ??
		(async (_provider, _message) => {
			console.warn(
				"[jabberwock] [resolveWebviewView] No message handler registered — messages are not being processed",
			)
		})
	const messageDisposable = webview.onDidReceiveMessage(async (message: { [key: string]: unknown }) => {
		try {
			await handler(provider, message)
		} catch (error) {
			console.error(
				`[jabberwock] [resolveWebviewView] Unhandled error processing message:`,
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
	if (getVscodeContext().extensionMode === vscode.ExtensionMode.Development) {
		webview.html = getHMRHtmlContent(provider, webview)
	} else {
		webview.html = getHtmlContent(provider, webview)
	}

	// Load persisted API configuration from ProviderSettingsManager and include it
	// in the initial state so the webview doesn't show the welcome screen unnecessarily.
	// Also auto-select the first config profile when none is currently selected.
	let initialState: WebviewStatePayload = {}
	try {
		const psm = getProviderSettingsManager()
		if (psm) {
			let currentConfigName = getVscodeContext().getGlobalState("currentApiConfigName")

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
					await getVscodeContext().updateGlobalState("currentApiConfigName", firstName)
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

	// ── Wire up reactive syncer ────────────────────────────────────────
	// Reactions push state to webview when activeTaskId, isRunning,
	// or the active task's notifications array change — eliminating
	// many imperative postStateToWebview calls.
	const syncerDisposer = setupSyncer(provider, getBackendRootStore())
	state.addWebviewDisposable({ dispose: syncerDisposer })

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
			await postMessageToWebview(provider, { type: "theme", text: JSON.stringify(await getTheme()) })
		}
	})
	state.addWebviewDisposable(configDisposable)
}

function getHtmlContent(provider: EventBridge, webview: vscode.Webview): string {
	const nonce = getNonce()
	const buildVersion = Date.now().toString(36)
	const workspaceRootUri = vscode.Uri.file(path.resolve(getVscodeContext().extensionUri.fsPath, ".."))
	const scriptUri =
		String(getUri(webview, workspaceRootUri, ["webview-ui", "build", "assets", "index.js"])) + `?v=${buildVersion}`
	const styleUri =
		String(getUri(webview, workspaceRootUri, ["webview-ui", "build", "assets", "index.css"])) + `?v=${buildVersion}`

	const isDev = getVscodeContext().extensionMode === vscode.ExtensionMode.Development
	const cspMeta = isDev
		? ""
		: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} 'wasm-unsafe-eval'; connect-src 'self' https: http:">`

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	${cspMeta}
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
 * Returns HTML content loading from build assets for development mode.
 * Functionally identical to getHtmlContent — both load from webview-ui/build output.
 * Using build assets instead of Vite dev server avoids CSP issues with localhost
 * that can cause an empty DOM in VS Code's webview.
 */
function getHMRHtmlContent(provider: EventBridge, webview: vscode.Webview): string {
	try {
		// Read the Vite dev server port persisted by the vite.config.ts persistPortPlugin
		const vitePortPath = path.join(path.dirname(getVscodeContext().extensionUri.fsPath), "webview-ui", ".vite-port")
		const { existsSync, readFileSync } = require("fs") as typeof import("fs")
		if (!existsSync(vitePortPath)) {
			console.warn("[jabberwock] .vite-port not found, falling back to production build")
			return getHtmlContent(provider, webview)
		}

		const port = Number(readFileSync(vitePortPath, "utf-8").trim())
		if (Number.isNaN(port) || port <= 0) {
			console.warn("[jabberwock] Invalid .vite-port value, falling back to production build")
			return getHtmlContent(provider, webview)
		}

		// Verify Vite is actually running on that port
		try {
			const { execSync } = require("child_process") as typeof import("child_process")
			execSync(`lsof -i :${port} 2>/dev/null`, { timeout: 1000 })
		} catch {
			console.warn("[jabberwock] Vite dev server not running, falling back to production build")
			return getHtmlContent(provider, webview)
		}

		const nonce = getNonce()

		// Dev mode: no CSP restrictions to avoid blocking localhost resources
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<script type="module" nonce="${nonce}" src="http://localhost:${port}/@vite/client"></script>
	<title>Jabberwock</title>
</head>
<body>
	<div id="root"></div>
	<script type="module" nonce="${nonce}" src="http://localhost:${port}/src/index.tsx"></script>
</body>
</html>`
	} catch (error) {
		console.error("[jabberwock] Error in getHMRHtmlContent:", error)
		return getHtmlContent(provider, webview)
	}
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

export function scheduleStatePush(provider: EventBridge, state?: WebviewStatePayload): void {
	const stateModel = lazyGetState(provider).foundation.windowManager as IWindowManagerModel
	stateModel.scheduleStatePush(() => {
		postStateToWebview(provider, state)
	}, PUSH_DEBOUNCE_MS)
}

/**
 * Discriminated union of messages sent from the extension backend to the webview.
 */
export type WebviewOutboundMessage =
	| { type: "state"; state: { [key: string]: unknown } & { _hydration: true } }
	| { type: "action"; action: string }
	| { type: "theme"; text: string }
	| { type: "invoke"; invoke: string }
	| { type: "mcpServers"; mcpServers: unknown }
	| { type: "listApiConfig"; listApiConfig: unknown }
	| { type: "taskHistoryUpdated"; taskHistory: unknown }
	| { type: string; [key: string]: unknown }

export function postMessageToWebview(
	provider: EventBridge,
	message: WebviewOutboundMessage | { [key: string]: unknown },
): boolean {
	const state = getWindowManagerState(provider)
	if (state.view) {
		state.view.webview.postMessage(message)
		return true
	}
	console.warn(`[jabberwock] [DEBUG:POSTMSG] postMessageToWebview SKIPPED - no provider.view! type=${message.type}`)
	return false
}

/**
 * Posts the current state to the webview.
 */
export async function postStateToWebview(provider: EventBridge, additionalState?: WebviewStatePayload): Promise<void> {
	const state = getWindowManagerState(provider)
	console.log(
		`[jabberwock] [DEBUG:POSTSTATE] ENTERED postStateToWebview, has state.view=${!!state.view}, additionalState keys=${Object.keys(additionalState ?? {}).join(",") || "(empty)"}`,
	)

	// Always enrich the state with apiConfiguration and listApiConfigMeta so that
	// callers who pass no args (or minimal state) don't accidentally send an empty
	// "state: {}" message to the webview, which would trigger unnecessary re-renders
	// and potentially cause cascading postMessage loops.
	const enrichedState = { ...(additionalState ?? {}) }

	// Ensure state is never empty — webview needs at least one field to hydrate
	enrichedState._hydration = true

	// Always include currentApiConfigName so the webview has the latest selection
	if (!enrichedState.currentApiConfigName) {
		const currentConfigName = getVscodeContext().getGlobalState("currentApiConfigName")
		if (currentConfigName) {
			enrichedState.currentApiConfigName = currentConfigName
		}
	}

	if (!enrichedState.apiConfiguration || !enrichedState.listApiConfigMeta || enrichedState.isRunning === undefined) {
		try {
			const store = getBackendRootStore()
			const apiConfig = store.settings.apiConfig

			if (!enrichedState.listApiConfigMeta && apiConfig.listApiConfigMeta) {
				enrichedState.listApiConfigMeta = apiConfig.listApiConfigMeta
			}
			if (!enrichedState.apiConfiguration && apiConfig.apiProvider) {
				enrichedState.apiConfiguration = apiConfig.toProviderSettings()
			}

			// Always include isRunning so the webview knows whether a task is in progress
			if (enrichedState.isRunning === undefined) {
				enrichedState.isRunning = store.chat.isRunning
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

	const messages = enrichedState.messages as Notification[] | undefined
	if (messages && messages.length > 0) {
		const lastMessage = messages[messages.length - 1]
		const lastMessageType = `${lastMessage.type}:${lastMessage.say ?? lastMessage.ask ?? "unknown"}`
		jabberwockLog.log("state:messages", {
			count: messages.length,
			lastMessageType,
			hasPendingAsks: messages.some((m) => m.type === "ask"),
		})
	}

	if (state.view) {
		console.log(`[jabberwock] [DEBUG:POSTSTATE] SENDING state with keys:`, Object.keys(enrichedState))
		await provider.postMessageToWebview({ type: "state", state: enrichedState })
		console.log(`[jabberwock] [DEBUG:POSTSTATE] postMessageToWebview completed`)
	} else {
		console.warn(`[jabberwock] [DEBUG:POSTMSG] postStateToWebview SKIPPED - no provider.view!`)
	}
}

/**
 * Posts full state minus messages to the webview.
 * Loads api configuration, settings, and currentApiConfigName from the provider.
 */
export async function postStateToWebviewWithoutMessages(provider: EventBridge): Promise<void> {
	const state: WebviewStatePayload = {}
	try {
		const psm = getProviderSettingsManager()
		if (psm) {
			state.listApiConfigMeta = await psm.listConfig()
			const currentConfigName = getVscodeContext().getGlobalState("currentApiConfigName")
			if (currentConfigName) {
				const profile = await psm.getProfile({ name: currentConfigName })
				if (profile) {
					const { name: _, ...apiConfig } = profile
					state.apiConfiguration = apiConfig
				}
			}
		}

		// Include settings from contextProxy
		const settings = getSettingsAccess().getValues()
		if (settings) {
			Object.assign(state, settings)
		}

		// Include currentApiConfigName for UI state
		const currentConfigName = getVscodeContext().getGlobalState("currentApiConfigName")
		if (currentConfigName) {
			state.currentApiConfigName = currentConfigName
		}
	} catch {
		// Non-critical
	}

	await postStateToWebview(provider, Object.keys(state).length > 0 ? state : undefined)
}

/**
 * Alias for postStateToWebviewWithoutMessages.
 * Posts state to webview excluding task history / messages.
 */
export async function postStateToWebviewWithoutTaskHistory(provider: EventBridge): Promise<void> {
	await postStateToWebviewWithoutMessages(provider)
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
	// Note: this key is stored in workspaceState (per-workspace), not globalState
	const lockApiConfig = getVscodeContext().extensionContext.workspaceState.get<boolean>("lockApiConfigAcrossModes")

	// 2. Update global state mode
	await getVscodeContext().updateGlobalState("mode", modeSlug)

	// 3. If not locked, handle mode-specific API config
	if (!lockApiConfig) {
		const psm = getProviderSettingsManager()
		if (psm) {
			const modeConfigId = await psm.getModeConfigId(modeSlug)
			if (modeConfigId) {
				const profiles = await psm.listConfig()
				const profile = profiles.find((p) => p.id === modeConfigId)
				if (profile) {
					await activateProviderProfile(provider, { name: profile.name })
					await getVscodeContext().updateGlobalState("currentApiConfigName", profile.name)
				}
			} else {
				// Save current config as default for new mode
				const currentConfigName = getVscodeContext().getGlobalState("currentApiConfigName")
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
	const currentTask = getBackendRootStore().chat.activeTask
	if (currentTask?.setTaskMode) {
		currentTask.setTaskMode(modeSlug)
	}

	// 5. Update task history metadata with new mode
	if (currentTask) {
		try {
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
