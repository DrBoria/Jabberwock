import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { getTheme } from "@integrations/theme/getTheme"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { loadApiConfiguration } from "./webview-api-config"
import { sendTaskHistory, restoreChatState, initializeWorkspaceTracker } from "./webview-state"
import { syncMcpServers } from "./webview-mcp"
import { syncApiConfigProfiles } from "./webview-api-config"

export function registerOnTaskWebviewLaunched(bus: IntentBus): void {
	bus.register(IntentType.TaskWebviewLaunched, (_intent, ctx) => {
		return handleWebviewLaunched(ctx as never).catch((error: unknown) => {
			console.error(`[jabberwock] [${new Date().toISOString()}] webviewDidLaunch: unhandled error:`, error)
		})
	})
}

async function handleWebviewLaunched(ctx: never): Promise<void> {
	const provider = (ctx as never as { provider?: { postMessageToWebview: (msg: unknown) => Promise<void> } }).provider

	if (!provider) {
		return
	}

	const rootStore = (ctx as {rootStore: never}).rootStore

	// 1. Custom Modes
	const customModes = (rootStore as never as { settings: { modes: { customModes: never } } }).settings.modes
		.customModes

	await getVscodeContext().updateGlobalState("customModes", customModes)

	// 2. API Config Profile Management — MUST run before reading store state
	await syncApiConfigProfiles(provider, rootStore)

	// 3. API Configuration
	const additionalState = loadApiConfiguration(rootStore)

	// 4. Task History
	await sendTaskHistory(provider, rootStore)

	// 5. Restore Chat State from MST
	await restoreChatState(provider, rootStore)

	// 6. Post State to Webview
	postStateToWebview(provider as never, Object.keys(additionalState).length > 0 ? additionalState : undefined)

	// 7. Workspace Tracker
	await initializeWorkspaceTracker(provider)

	// 8. Theme
	getTheme().then((theme: { [key: string]: unknown }) =>
		provider.postMessageToWebview({ type: "theme", text: JSON.stringify(theme) }),
	)

	// 9. MCP Servers
	syncMcpServers(provider, rootStore)
}
