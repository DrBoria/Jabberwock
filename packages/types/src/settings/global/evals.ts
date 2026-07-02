/**
 * Default settings when running evals (unless overridden).
 */
export const EVALS_SETTINGS = {
	apiProvider: "openrouter",

	lastShownAnnouncementId: "jul-09-2025-3-23-0",

	pinnedApiConfigs: {},

	autoApprovalEnabled: true,
	alwaysAllowReadOnly: true,
	alwaysAllowReadOnlyOutsideWorkspace: false,
	alwaysAllowWrite: true,
	alwaysAllowWriteOutsideWorkspace: false,
	alwaysAllowWriteProtected: false,
	writeDelayMs: 1000,
	requestDelaySeconds: 10,
	alwaysAllowMcp: true,
	alwaysAllowModeSwitch: true,
	alwaysAllowSubtasks: true,
	alwaysAllowExecute: true,
	alwaysAllowFollowupQuestions: true,
	followupAutoApproveTimeoutMs: 0,
	allowedCommands: ["*"],
	commandExecutionTimeout: 20,
	commandTimeoutAllowlist: [],
	preventCompletionWithOpenTodos: false,

	ttsEnabled: false,
	ttsSpeed: 1,
	soundEnabled: false,
	soundVolume: 0.5,

	terminalShellIntegrationTimeout: 30000,
	terminalCommandDelay: 0,
	terminalPowershellCounter: false,
	terminalZshOhMy: true,
	terminalZshClearEolMark: true,
	terminalZshP10k: false,
	terminalZdotdir: true,
	terminalShellIntegrationDisabled: true,

	diagnosticsEnabled: true,

	enableCheckpoints: false,

	rateLimitSeconds: 0,
	maxOpenTabsContext: 20,
	maxWorkspaceFiles: 200,
	maxGitStatusFiles: 20,
	showJabberwockIgnoredFiles: true,

	includeDiagnosticMessages: true,
	maxDiagnosticMessages: 50,

	language: "en",
	telemetrySetting: "enabled",

	mcpEnabled: false,

	mode: "code",

	customModes: undefined,
} as const

export const EVALS_TIMEOUT = 5 * 60 * 1_000
