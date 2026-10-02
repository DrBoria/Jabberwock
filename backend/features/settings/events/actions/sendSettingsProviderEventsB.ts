/**
 * Settings event action creators (worktrees, system prompt, models).
 *
 * Provider-scoped settings event-action creators: the call site owns the
 * `provider` and passes it in. Part of the settings event-action creators
 * (see sendSettingsEvent.ts for the shared WebviewMessageTarget type).
 */

import type { WebviewMessageTarget } from "./sendSettingsGlobal"

export function sendThemeToProvider(provider: WebviewMessageTarget, text: string): unknown {
	return provider.postMessageToWebview({ type: "theme", text })
}

/**
 * Send the MCP server list to the webview (provider-scoped).
 */
export function sendMcpServersToProvider(provider: WebviewMessageTarget, mcpServers: unknown): unknown {
	return provider.postMessageToWebview({ type: "mcpServers", mcpServers })
}

/**
 * Send the API config list to the webview (provider-scoped).
 */
export function sendListApiConfigToProvider(provider: WebviewMessageTarget, listApiConfig: unknown): unknown {
	return provider.postMessageToWebview({ type: "listApiConfig", listApiConfig })
}

/**
 * Send the task history list to the webview (provider-scoped).
 */
export function sendTaskHistoryUpdatedToProvider(provider: WebviewMessageTarget, taskHistory: unknown): unknown {
	return provider.postMessageToWebview({ type: "taskHistoryUpdated", taskHistory })
}

/**
 * Send an indexing status update to the webview.
 */
export function sendIndexingStatusUpdate(provider: WebviewMessageTarget, values: Record<string, unknown>): unknown {
	return provider.postMessageToWebview({ type: "indexingStatusUpdate", values })
}

/**
 * Send the code-index settings save result to the webview.
 */
export function sendCodeIndexSettingsSaved(
	provider: WebviewMessageTarget,
	payload: { success: boolean; settings?: unknown; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "codeIndexSettingsSaved",
		success: payload.success,
		settings: payload.settings,
		error: payload.error,
	})
}

/**
 * Send the code-index secret status to the webview.
 */
export function sendCodeIndexSecretStatus(provider: WebviewMessageTarget, values: Record<string, unknown>): unknown {
	return provider.postMessageToWebview({ type: "codeIndexSecretStatus", values })
}

/**
 * Send the index-cleared result to the webview.
 */
export function sendIndexCleared(provider: WebviewMessageTarget, values: Record<string, unknown>): unknown {
	return provider.postMessageToWebview({ type: "indexCleared", values })
}

/**
 * Send text to insert into the textarea to the webview.
 */
export function sendInsertTextIntoTextarea(provider: WebviewMessageTarget, text: string): unknown {
	return provider.postMessageToWebview({ type: "insertTextIntoTextarea", text })
}

/**
 * Send OpenAI Codex rate limits (or an error) to the webview.
 */
export function sendOpenAiCodexRateLimits(
	provider: WebviewMessageTarget,
	payload: { values?: unknown; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "openAiCodexRateLimits",
		values: payload.values,
		error: payload.error,
	})
}

/**
 * Send the list of dismissed upsells to the webview.
 */
export function sendDismissedUpsells(provider: WebviewMessageTarget, list: unknown): unknown {
	return provider.postMessageToWebview({ type: "dismissedUpsells", list })
}

/**
 * Send a worktree copy progress update to the webview.
 */
export function sendWorktreeCopyProgress(
	provider: WebviewMessageTarget,
	payload: { bytesCopied: number; itemName: string },
): unknown {
	return provider.postMessageToWebview({
		type: "worktreeCopyProgress",
		copyProgressBytesCopied: payload.bytesCopied,
		copyProgressItemName: payload.itemName,
	})
}

/**
 * Send a worktree operation result to the webview.
 */
export function sendWorktreeResult(
	provider: WebviewMessageTarget,
	payload: { success: boolean; text: string },
): unknown {
	return provider.postMessageToWebview({
		type: "worktreeResult",
		success: payload.success,
		text: payload.text,
	})
}

/**
 * Send a selected folder path to the webview.
 */
export function sendFolderSelected(provider: WebviewMessageTarget, path: string): unknown {
	return provider.postMessageToWebview({ type: "folderSelected", path })
}

/**
 * Send the worktree list to the webview.
 */
export function sendWorktreeList(
	provider: WebviewMessageTarget,
	payload: {
		worktrees: unknown[]
		isGitRepo: boolean
		isMultiRoot: boolean
		isSubfolder: boolean
		gitRootPath: string
		error?: string
	},
): unknown {
	return provider.postMessageToWebview({
		type: "worktreeList",
		worktrees: payload.worktrees,
		isGitRepo: payload.isGitRepo,
		isMultiRoot: payload.isMultiRoot,
		isSubfolder: payload.isSubfolder,
		gitRootPath: payload.gitRootPath,
		error: payload.error,
	})
}

/**
 * Send the available branch list to the webview.
 */
export function sendBranchList(
	provider: WebviewMessageTarget,
	payload: {
		localBranches: string[]
		remoteBranches: string[]
		currentBranch: string
		error?: string
	},
): unknown {
	return provider.postMessageToWebview({
		type: "branchList",
		localBranches: payload.localBranches,
		remoteBranches: payload.remoteBranches,
		currentBranch: payload.currentBranch,
		error: payload.error,
	})
}

/**
 * Send the worktree defaults to the webview.
 */
