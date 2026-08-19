import type { EventBridge } from "@features/foundation/webview/EventBridge"
import { initCloudState as initCloudStore } from "./store"

export async function initCloudState(provider: EventBridge): Promise<void> {
	initCloudStore(provider)
}
