/**
 * Event Registry — single source of truth for all Jabberwock event types.
 *
 * This file defines the nested interface hierarchy for all three event directions:
 *   1. BackendToWebview — Extension → Webview (postMessage)
 *   2. WebviewToBackend — Webview → Extension (postMessage)
 *   3. BackendInternalEvents — Backend EventEmitter events (JabberwockEventName)
 *
 * Backward-compatible flat union types (ExtensionMessage, WebviewMessage) are
 * derived from these nested interfaces and remain available from the main exports.
 */

import type { ChatBackendToWebview, ChatWebviewToBackend } from "./chat/registry.ts"
import type {
	CloudBackendToWebview,
	CloudWebviewToBackend,
	DiagnosticsBackendToWebview,
	DiagnosticsWebviewToBackend,
} from "./cloud/registry.ts"
import type { FoundationBackendToWebview, FoundationWebviewToBackend } from "./foundation/registry.ts"
import type {
	HistoryBackendToWebview,
	HistoryWebviewToBackend,
	MarketplaceBackendToWebview,
	MarketplaceWebviewToBackend,
} from "./history-marketplace/registry.ts"
import type { SettingsBackendToWebview, SettingsWebviewToBackend } from "./settings/registry.ts"

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT AGGREGATORS
// ═══════════════════════════════════════════════════════════════════════════════

export interface BackendToWebview {
	chat: ChatBackendToWebview
	cloud: CloudBackendToWebview
	diagnostics: DiagnosticsBackendToWebview
	foundation: FoundationBackendToWebview
	history: HistoryBackendToWebview
	marketplace: MarketplaceBackendToWebview
	settings: SettingsBackendToWebview
}

export interface WebviewToBackend {
	chat: ChatWebviewToBackend
	cloud: CloudWebviewToBackend
	diagnostics: DiagnosticsWebviewToBackend
	foundation: FoundationWebviewToBackend
	history: HistoryWebviewToBackend
	marketplace: MarketplaceWebviewToBackend
	settings: SettingsWebviewToBackend
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUNTIME SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const jabberwockDirections = ["backend→webview", "webview→backend", "internal"] as const

// ═══════════════════════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE FLAT UNION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Helper type: flattens a nested feature interface into a discriminated union.
 * Each key becomes a `{ type: K } & Payload` member of the union.
 */
type FlattenLeaf<T> = {
	[K in keyof T]: { type: K } & T[K]
}[keyof T]

/**
 * Flatten a 2-level nested interface (feature → subfeature → events)
 * into a flat discriminated union.
 */
type FlattenNested<T> = {
	[Feature in keyof T]: {
		[Subfeature in keyof T[Feature]]: FlattenLeaf<T[Feature][Subfeature]>
	}[keyof T[Feature]]
}[keyof T]

/**
 * Backward-compatible ExtensionMessage — derived from the nested hierarchy.
 * This is a flat discriminated union matching the original interface shape.
 */
export type ExtensionMessage = FlattenNested<BackendToWebview>

/**
 * Backward-compatible WebviewMessage — derived from the nested hierarchy.
 * This is a flat discriminated union matching the original interface shape.
 */
export type WebviewMessage = FlattenNested<WebviewToBackend>
