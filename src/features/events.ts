/**
 * Root re-export aggregator for all feature events.
 *
 * Each feature's events/ folder exports:
 *   - Event key constants (e.g., cloudEventConstants)
 *   - Handler registration function (e.g., registerOnCloudIntents)
 *   - Shared event types from @jabberwock/types
 */
export type {
	BackendToWebview,
	WebviewToBackend,
	BackendInternalEvents,
	ExtensionMessage,
	WebviewMessage,
} from "@jabberwock/types"

export { ChatEventKeys } from "./chat/events"

export { ChatTaskEventKeys } from "./chat/task/events"

export { ChatMessagesEventKeys } from "./chat/task/messages/events"

export { ChatNotificationsEventKeys } from "./chat/task/notifications/events"

export { cloudEventConstants, registerOnCloudIntents } from "./cloud/events"
export type { CloudEventKey } from "./cloud/events"

export { historyEventConstants, registerOnHistoryIntents } from "./history/events"
export type { HistoryEventKey } from "./history/events"

export { marketplaceEventConstants, registerOnMarketplaceIntents } from "./marketplace/events"
export type { MarketplaceEventKey } from "./marketplace/events"

export { foundationEventConstants } from "./foundation/events"
export type { FoundationEventKey } from "./foundation/events"

export { windowManagerEventConstants, registerOnWindowManagerIntents } from "./foundation/window-manager/events"
export type { WindowManagerEventKey } from "./foundation/window-manager/events"

export { SettingsEventKeys, registerOnSettingsIntents } from "./settings/events"

// export { CoreEventKeys } from "./core/events" — no such module exists; CoreEventKeys was likely inlined or not migrated
