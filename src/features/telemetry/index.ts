import type { EventBridge } from "../../core/webview/EventBridge"

export async function initTelemetryState(provider: EventBridge): Promise<void> {
	const { initTelemetryState: initStore } = await import("./store")
	initStore(provider)
}
