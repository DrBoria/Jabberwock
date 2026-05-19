import type { EventBridge } from "../../core/webview/EventBridge"

export async function initCloudState(provider: EventBridge): Promise<void> {
	const { initCloudState: initStore } = await import("./store")
	initStore(provider)
}
