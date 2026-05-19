import type { EventBridge } from "../../core/webview/EventBridge"

export async function initDiagnosticsState(provider: EventBridge): Promise<void> {
	const { initDiagnosticsState: initStore } = await import("./store")
	initStore(provider)
}
