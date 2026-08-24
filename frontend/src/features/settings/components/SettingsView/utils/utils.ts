import type { ExtensionState } from "@jabberwock/types"
import { DEFAULT_CHECKPOINT_TIMEOUT_SECONDS } from "@jabberwock/types"

export function areValuesEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true
	if (a == null && b == null) return true
	if (typeof a !== typeof b) return false
	if (typeof a === "object" && typeof b === "object") {
		return JSON.stringify(a) === JSON.stringify(b)
	}
	return false
}

export function isInitialSyncValue(previousValue: unknown, newValue: unknown): boolean {
	const wasEmpty = previousValue == null || previousValue === ""
	const isBeingSet = newValue != null && newValue !== ""
	return wasEmpty && isBeingSet
}

export function buildAutoApproveSettings(s: ExtensionState): Record<string, unknown> {
	return {
		alwaysAllowWrite: s.alwaysAllowWrite ?? undefined,
		alwaysAllowWriteOutsideWorkspace: s.alwaysAllowWriteOutsideWorkspace ?? undefined,
		alwaysAllowWriteProtected: s.alwaysAllowWriteProtected ?? undefined,
		alwaysAllowExecute: s.alwaysAllowExecute ?? undefined,
		alwaysAllowMcp: s.alwaysAllowMcp,
		alwaysAllowModeSwitch: s.alwaysAllowModeSwitch,
		allowedCommands: s.allowedCommands ?? [],
		deniedCommands: s.deniedCommands ?? [],
		allowedMaxRequests: s.allowedMaxRequests ?? null,
		allowedMaxCost: s.allowedMaxCost ?? null,
	}
}

export function buildAudioCheckpointSettings(s: ExtensionState): Record<string, unknown> {
	return {
		soundEnabled: s.soundEnabled ?? true,
		soundVolume: s.soundVolume ?? 0.5,
		ttsEnabled: s.ttsEnabled,
		ttsSpeed: s.ttsSpeed,
		enableCheckpoints: s.enableCheckpoints ?? false,
		checkpointTimeout: s.checkpointTimeout ?? DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
		writeDelayMs: s.writeDelayMs,
	}
}

export function buildTerminalSettings(s: ExtensionState): Record<string, unknown> {
	return {
		terminalShellIntegrationTimeout: s.terminalShellIntegrationTimeout ?? 30_000,
		terminalShellIntegrationDisabled: s.terminalShellIntegrationDisabled,
		terminalCommandDelay: s.terminalCommandDelay,
		terminalPowershellCounter: s.terminalPowershellCounter,
		terminalZshClearEolMark: s.terminalZshClearEolMark,
		terminalZshOhMy: s.terminalZshOhMy,
		terminalZshP10k: s.terminalZshP10k,
		terminalZdotdir: s.terminalZdotdir,
		terminalOutputPreviewSize: s.terminalOutputPreviewSize ?? "medium",
	}
}

export function buildDimensionSettings(s: ExtensionState): Record<string, unknown> {
	return {
		mcpEnabled: s.mcpEnabled,
		maxOpenTabsContext: Math.min(Math.max(0, s.maxOpenTabsContext ?? 20), 500),
		maxWorkspaceFiles: Math.min(Math.max(0, s.maxWorkspaceFiles ?? 200), 500),
		showJabberwockIgnoredFiles: s.showJabberwockIgnoredFiles ?? true,
		enableSubfolderRules: s.enableSubfolderRules ?? false,
		maxImageFileSize: s.maxImageFileSize ?? 5,
		maxTotalImageSize: s.maxTotalImageSize ?? 20,
		includeDiagnosticMessages: s.includeDiagnosticMessages !== undefined ? s.includeDiagnosticMessages : true,
		maxDiagnosticMessages: s.maxDiagnosticMessages ?? 50,
	}
}

export function buildPromptMiscSettings(s: ExtensionState): Record<string, unknown> {
	return {
		autoCondenseContext: s.autoCondenseContext,
		autoCondenseContextPercent: s.autoCondenseContextPercent,
		alwaysAllowSubtasks: s.alwaysAllowSubtasks,
		alwaysAllowFollowupQuestions: s.alwaysAllowFollowupQuestions ?? false,
		followupAutoApproveTimeoutMs: s.followupAutoApproveTimeoutMs,
		includeTaskHistoryInEnhance: s.includeTaskHistoryInEnhance ?? true,
		reasoningBlockCollapsed: s.reasoningBlockCollapsed ?? true,
		enterBehavior: s.enterBehavior ?? "send",
		includeCurrentTime: s.includeCurrentTime ?? true,
		includeCurrentCost: s.includeCurrentCost ?? true,
		maxGitStatusFiles: s.maxGitStatusFiles ?? 0,
		profileThresholds: s.profileThresholds,
	}
}

export function buildImageGenSettings(s: ExtensionState): Record<string, unknown> {
	return {
		imageGenerationProvider: s.imageGenerationProvider,
		openRouterImageApiKey: s.openRouterImageApiKey,
		openRouterImageGenerationSelectedModel: s.openRouterImageGenerationSelectedModel,
		experiments: s.experiments,
		customSupportPrompts: s.customSupportPrompts,
		locatorTarget: s.locatorTarget,
	}
}

export function buildSettingsPayload(s: ExtensionState): Record<string, unknown> {
	return {
		language: s.language,
		alwaysAllowReadOnly: s.alwaysAllowReadOnly ?? undefined,
		alwaysAllowReadOnlyOutsideWorkspace: s.alwaysAllowReadOnlyOutsideWorkspace ?? undefined,
		...buildAutoApproveSettings(s),
		...buildAudioCheckpointSettings(s),
		...buildTerminalSettings(s),
		...buildDimensionSettings(s),
		...buildPromptMiscSettings(s),
		...buildImageGenSettings(s),
	}
}
