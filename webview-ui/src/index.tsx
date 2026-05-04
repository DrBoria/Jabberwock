import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { initWebviewConsoleBridge } from "@jabberwock/devtool/react"

// Must be called before any other code to capture all console output
initWebviewConsoleBridge()

import "./index.css"
import App from "./App"
import "../node_modules/@vscode/codicons/dist/codicon.css"

import { getHighlighter } from "./utils/highlighter"
import { createMstBridge } from "./features/foundation/mst-bridge/bridge"
import { settingsStore } from "./features/settings/store"
import { devToolsStore } from "@jabberwock/devtool/react"
import { windowManagerStore } from "./features/foundation/window-manager/store"
import { commandExecutionStore } from "./features/chat/command-execution/store"
import { mcpExecutionStore } from "./features/chat/mcp-execution/store"
import { workspaceStore } from "./features/workspace/store"
import { commandsStore } from "./features/chat/commands/store"
import { mcpServersStore } from "./features/mcp-servers/store"
import { skillsStore } from "./features/skills/store"
import { taskHistoryStore } from "./features/task-history/store"
import { diagnosticsStore } from "./features/diagnostics/store"
import { marketplaceStore } from "./features/marketplace/store"
import { checkpointStore } from "./features/checkpoint/store"
import { routerModelsStore } from "./features/router-models/store"
import { listApiConfigStore } from "./features/list-api-config/store"

// Initialize Shiki early to hide initialization latency (async)
getHighlighter().catch((error: Error) => console.error("Failed to initialize Shiki highlighter:", error))

// Wire up MstBridge: receives snapshot batches from the extension and applies
// them to registered webview MST stores via applySnapshot.
const mstBridge = createMstBridge()
mstBridge.setConnectionState("connected")

// Register webview MST stores to receive snapshots from the extension
mstBridge.registerStore("SettingsStore", settingsStore)
mstBridge.registerStore("DevToolsStore", devToolsStore)
mstBridge.registerStore("WindowManagerStore", windowManagerStore)
mstBridge.registerStore("CommandExecutionStore", commandExecutionStore)
mstBridge.registerStore("McpExecutionStore", mcpExecutionStore)
mstBridge.registerStore("WorkspaceStore", workspaceStore)
mstBridge.registerStore("CommandsStore", commandsStore)
mstBridge.registerStore("McpServersStore", mcpServersStore)
mstBridge.registerStore("SkillsStore", skillsStore)
mstBridge.registerStore("TaskHistoryStore", taskHistoryStore)
mstBridge.registerStore("DiagnosticsStore", diagnosticsStore)
mstBridge.registerStore("MarketplaceStore", marketplaceStore)
mstBridge.registerStore("CheckpointStore", checkpointStore)
mstBridge.registerStore("RouterModelsStore", routerModelsStore)
mstBridge.registerStore("ListApiConfigStore", listApiConfigStore)

// Listen for mst-snapshot-batch messages from the extension
window.addEventListener("message", (event) => {
	const message = event.data
	if (message?.type === "mst-snapshot-batch") {
		mstBridge.handleSnapshotBatch(message.payload)
	}
})

// Expose bridge for DevTools inspection
if (typeof window !== "undefined") {
	;(window as any).__JABBERWOCK_MST_BRIDGE__ = mstBridge
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
