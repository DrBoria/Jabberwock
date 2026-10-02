/**
 * Settings event action creators (models, skills, fetch-url).
 *
 * Provider-scoped settings event-action creators: the call site owns the
 * `provider` and passes it in. Part of the settings event-action creators
 * (see sendSettingsEvent.ts for the shared WebviewMessageTarget type).
 */

import type { WebviewMessageTarget } from "./sendSettingsGlobal"

export function sendWorktreeDefaults(
	provider: WebviewMessageTarget,
	payload: { suggestedBranch: string; suggestedPath: string; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "worktreeDefaults",
		suggestedBranch: payload.suggestedBranch,
		suggestedPath: payload.suggestedPath,
		error: payload.error,
	})
}

/**
 * Send the worktree include status to the webview.
 */
export function sendWorktreeIncludeStatus(
	provider: WebviewMessageTarget,
	payload: { worktreeIncludeStatus: unknown; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "worktreeIncludeStatus",
		worktreeIncludeStatus: payload.worktreeIncludeStatus,
		error: payload.error,
	})
}

/**
 * Send the branch worktree-include check result to the webview.
 */
export function sendBranchWorktreeIncludeResult(
	provider: WebviewMessageTarget,
	payload: { branch?: string; hasWorktreeInclude?: boolean; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "branchWorktreeIncludeResult",
		branch: payload.branch,
		hasWorktreeInclude: payload.hasWorktreeInclude,
		error: payload.error,
	})
}

/**
 * Send the generated system prompt to the webview.
 */
export function sendSystemPrompt(provider: WebviewMessageTarget, payload: { text: string; mode?: string }): unknown {
	return provider.postMessageToWebview({
		type: "systemPrompt",
		text: payload.text,
		mode: payload.mode,
	})
}

/**
 * Send file content (or an error) to the webview.
 */
export function sendFileContent(provider: WebviewMessageTarget, fileContent: Record<string, unknown>): unknown {
	return provider.postMessageToWebview({ type: "fileContent", fileContent })
}

/**
 * Send the router models to the webview.
 */
export function sendRouterModels(provider: WebviewMessageTarget, models: unknown): unknown {
	return provider.postMessageToWebview({ type: "routerModels", models })
}

/**
 * Send the OpenAI models list (or an error) to the webview.
 */
export function sendOpenAiModels(
	provider: WebviewMessageTarget,
	payload: { models: unknown[]; baseUrl: string; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "openAiModels",
		models: payload.models,
		baseUrl: payload.baseUrl,
		error: payload.error,
	})
}

/**
 * Send the Ollama models list to the webview.
 */
export function sendOllamaModels(provider: WebviewMessageTarget, models: unknown): unknown {
	return provider.postMessageToWebview({ type: "ollamaModels", models })
}

/**
 * Send the LM Studio models list to the webview.
 */
export function sendLmStudioModels(provider: WebviewMessageTarget, models: unknown): unknown {
	return provider.postMessageToWebview({ type: "lmStudioModels", models })
}

/**
 * Send the Roo models list to the webview.
 */
export function sendRooModels(provider: WebviewMessageTarget, models: unknown): unknown {
	return provider.postMessageToWebview({ type: "rooModels", models })
}

/**
 * Send the VS Code LM models list to the webview.
 */
export function sendVsCodeLmModels(provider: WebviewMessageTarget, models: unknown): unknown {
	return provider.postMessageToWebview({ type: "vsCodeLmModels", models })
}

/**
 * Send the Roo credit balance (or an error) to the webview.
 */
export function sendRooCreditBalance(
	provider: WebviewMessageTarget,
	payload: { requestId?: string; values: Record<string, unknown> },
): unknown {
	return provider.postMessageToWebview({
		type: "rooCreditBalance",
		requestId: payload.requestId,
		values: payload.values,
	})
}

/**
 * Send the skills list to the webview.
 */
export function sendSkills(provider: WebviewMessageTarget, skills: unknown[]): unknown {
	return provider.postMessageToWebview({ type: "skills", skills })
}

/**
 * Send a VS Code setting value (or an error) to the webview.
 */
export function sendVsCodeSetting(
	provider: WebviewMessageTarget,
	payload: { setting: string; value?: unknown; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "vsCodeSetting",
		setting: payload.setting,
		value: payload.value,
		error: payload.error,
	})
}

/**
 * Send a fetch-url response (or an error) to the webview.
 */
export function sendFetchUrlResponse(
	provider: WebviewMessageTarget,
	payload: { requestId: string; text: string; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "fetchUrlResponse",
		requestId: payload.requestId,
		text: payload.text,
		error: payload.error,
	})
}
