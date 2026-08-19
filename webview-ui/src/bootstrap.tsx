import { createRoot } from "react-dom/client"
import { StrictMode } from "react"

import { createWebviewStoreBridge, initWebviewConsoleBridge, vscode } from "@jabberwock/devtool/webview"

// Must be called before any other code to capture all console output
initWebviewConsoleBridge()

import "./index.css"
import App from "./app-shell/App"
import "../node_modules/@vscode/codicons/dist/codicon.css"

import { devToolsStore } from "@jabberwock/devtool/webview"
import { commandExecutionStore } from "./features/chat/tree/store"
import { routerModelsStore } from "./features/settings/models/store"

import { createRootStore } from "./features/root-store"

import { getHighlighter } from "./utils/text/highlighter"
import { createMstBridge } from "./features/foundation/mst-bridge/bridge"

// Initialize Shiki early to hide initialization latency (async)
getHighlighter().catch((error: Error) => console.error("[jabberwock] Failed to initialize Shiki highlighter:", error))

/** Boot the webview application: wire up MST bridge, register stores, render React tree.
 *  Wrapped in try/catch so that any init failure renders a visible error instead of a blank page. */
function boot(): void {
	try {
		// Create root store first so all sub-stores are available
		const root = createRootStore()

		// Initialize webview store bridge: handles devtool console/store queries
		// from the extension (getConsoleLogs, searchConsole, getRootSnapshot, etc.)
		createWebviewStoreBridge(root, (msg: unknown) => {
			vscode.postMessage(msg as never)
		})

		// Wire up MstBridge: receives snapshot batches from the extension and applies
		// them to registered webview MST stores via applySnapshot.
		const mstBridge = createMstBridge()
		mstBridge.setConnectionState("connected")

		// Register webview MST stores to receive snapshots from the extension.
		// Stores with root-store children use root child instances to avoid the
		// DUAL INSTANTIATION BUG — singleton + root child = two separate MST instances,
		// and MstBridge snapshots only reach the registered instance.
		mstBridge.registerStore("SettingsStore", root.settings)
		mstBridge.registerStore("DevToolsStore", devToolsStore)
		mstBridge.registerStore("WindowManagerStore", root.windowManager)
		mstBridge.registerStore("CommandExecutionStore", commandExecutionStore)
		mstBridge.registerStore("McpExecutionStore", root.mcpExecution)
		mstBridge.registerStore("RouterModelsStore", routerModelsStore)
		mstBridge.registerStore("AgentStateStore", root.agentState)
		// McpServersStore was merged into SettingsStore
		mstBridge.registerStore("SkillsStore", root.skills)
		mstBridge.registerStore("TaskHistoryStore", root.history)
		mstBridge.registerStore("ChatStore", root.chat)

		// Listen for mst-snapshot-batch messages from the extension
		window.addEventListener("message", (event) => {
			const message = event.data
			if (message?.type === "mst-snapshot-batch") {
				mstBridge.handleSnapshotBatch(message.payload)
			}
		})

		// Expose bridge for DevTools inspection
		if (typeof window !== "undefined") {
			window.__JABBERWOCK_MST_BRIDGE__ = mstBridge
		}

		createRoot(document.getElementById("root")!).render(
			<StrictMode>
				<App />
			</StrictMode>,
		)
	} catch (error) {
		console.error("[jabberwock] Fatal boot error:", error)
		const root = document.getElementById("root")
		if (root) {
			root.innerHTML = `<div style="padding:24px;font-family:sans-serif;color:#e06c75;">
				<h2>Jabberwock: Boot Error</h2>
				<pre style="white-space:pre-wrap;background:#1e1e1e;padding:12px;border-radius:6px;">${error instanceof Error ? error.message : String(error)}</pre>
			</div>`
		}
	}
}

boot()
