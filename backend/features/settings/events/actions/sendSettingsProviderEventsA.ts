/**
 * Settings event action creators (UI, modes, marketplace, code-index).
 *
 * Provider-scoped settings event-action creators: the call site owns the
 * `provider` and passes it in. Part of the settings event-action creators
 * (see sendSettingsEvent.ts for the shared WebviewMessageTarget type).
 */

import type { WebviewMessageTarget } from "./sendSettingsGlobal"

// ─── Provider-scoped creators ─────────────────────────────────────────────
// These take the in-scope `provider` as the first argument (the call site owns
// which provider to deliver to) and call `provider.postMessageToWebview`
// directly, preserving the original delivery path.

/**
 * Send a raw outbound message to the webview, bypassing a dedicated creator.
 * Used for message types that are already fully-formed (e.g. code/terminal actions).
 */
export function sendRawMessage(provider: WebviewMessageTarget, message: Record<string, unknown>): unknown {
	return provider.postMessageToWebview(message)
}

/**
 * Send the "cloud button clicked" action to the webview.
 */
export function sendCloudButtonClicked(provider: WebviewMessageTarget): unknown {
	return provider.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
}

/**
 * Send the authenticated user info (or its absence) to the webview.
 */
export function sendAuthenticatedUser(provider: WebviewMessageTarget, userInfo: unknown): unknown {
	return provider.postMessageToWebview({ type: "authenticatedUser", userInfo })
}

/**
 * Send the result of an organization switch to the webview.
 */
export function sendOrganizationSwitchResult(
	provider: WebviewMessageTarget,
	payload: { success: boolean; organizationId?: string | null; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "organizationSwitchResult",
		success: payload.success,
		organizationId: payload.organizationId,
		error: payload.error,
	})
}

/**
 * Send commit search results to the webview.
 */
export function sendCommitSearchResults(provider: WebviewMessageTarget, commits: unknown[]): unknown {
	return provider.postMessageToWebview({ type: "commitSearchResults", commits })
}

/**
 * Send the "history button clicked" action to the webview.
 */
export function sendHistoryButtonClicked(provider: WebviewMessageTarget): unknown {
	return provider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
}

/**
 * Send the "marketplace button clicked" action to the webview.
 */
export function sendMarketplaceButtonClicked(provider: WebviewMessageTarget): unknown {
	return provider.postMessageToWebview({ type: "action", action: "marketplaceButtonClicked" })
}

/**
 * Send the result of a marketplace item install to the webview.
 */
export function sendMarketplaceInstallResult(
	provider: WebviewMessageTarget,
	payload: { success: boolean; slug?: string; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "marketplaceInstallResult",
		success: payload.success,
		slug: payload.slug,
		error: payload.error,
	})
}

/**
 * Send the custom tools result to the webview.
 */
export function sendCustomToolsResult(
	provider: WebviewMessageTarget,
	payload: { tools: unknown[]; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "customToolsResult",
		tools: payload.tools,
		error: payload.error,
	})
}

/**
 * Send the result of a marketplace item removal to the webview.
 */
export function sendMarketplaceRemoveResult(
	provider: WebviewMessageTarget,
	payload: { success: boolean; slug?: string; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "marketplaceRemoveResult",
		success: payload.success,
		slug: payload.slug,
		error: payload.error,
	})
}

/**
 * Send the settings import result to the webview.
 */
export function sendSettingsImportResult(provider: WebviewMessageTarget, result: Record<string, unknown>): unknown {
	return provider.postMessageToWebview({ type: "settingsImportResult", ...result })
}

/**
 * Send the result of a custom-mode delete check to the webview.
 */
export function sendDeleteCustomModeCheck(
	provider: WebviewMessageTarget,
	payload: { slug: string; rulesFolderPath?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "deleteCustomModeCheck",
		slug: payload.slug,
		rulesFolderPath: payload.rulesFolderPath,
	})
}

/**
 * Send the result of a mode import to the webview.
 */
export function sendImportModeResult(
	provider: WebviewMessageTarget,
	payload: { success: boolean; slug?: string; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "importModeResult",
		success: payload.success,
		slug: payload.slug,
		error: payload.error,
	})
}

/**
 * Send the result of a mode export to the webview.
 */
export function sendExportModeResult(
	provider: WebviewMessageTarget,
	payload: { success: boolean; error?: string; slug?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "exportModeResult",
		success: payload.success,
		error: payload.error,
		slug: payload.slug,
	})
}

/**
 * Send the result of a rules-directory content check to the webview.
 */
export function sendCheckRulesDirectoryResult(
	provider: WebviewMessageTarget,
	payload: { slug: string; hasContent: boolean },
): unknown {
	return provider.postMessageToWebview({
		type: "checkRulesDirectoryResult",
		slug: payload.slug,
		hasContent: payload.hasContent,
	})
}

/**
 * Send the available modes list to the webview.
 */
export function sendModes(provider: WebviewMessageTarget, modes: unknown[]): unknown {
	return provider.postMessageToWebview({ type: "modes", modes })
}

/**
 * Send the current theme to the webview (provider-scoped).
 */
