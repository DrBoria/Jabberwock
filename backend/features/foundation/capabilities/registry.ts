import type {
	BackendCapabilities,
	IConfiguration,
	IFileWatcherFactory,
	IHostEditorService,
	IHostModel,
	IHostTerminalService,
	IHostThemeService,
	ITabGroups,
	IUiDialogs,
} from "@jabberwock/types"

/**
 * Process-wide capability registry (plan §4.3 — «инжектится ОДИН раз при старте»).
 *
 * Bootstrap installs the single `BackendCapabilities` instance during activation; every other
 * module reads slots through these accessors instead of importing host modules directly. This is
 * what makes the zero-host-API invariant (C-5) checkable: all external APIs are reachable only via
 * this registry or the connector surface.
 */

let _capabilities: BackendCapabilities | undefined

/** Install capabilities once at startup. Throws on double-install to catch bootstrap ordering bugs. */
export function setBackendCapabilities(capabilities: BackendCapabilities): void {
	if (_capabilities) {
		throw new Error("[capabilities] setBackendCapabilities called twice — capabilities are installed exactly once")
	}
	_capabilities = capabilities
}

/** Get the process-wide capabilities. Throws if bootstrap has not run yet (fail fast, like getHostEnvironment). */
export function getBackendCapabilities(): BackendCapabilities {
	if (!_capabilities) {
		throw new Error("[capabilities] Not initialized — setBackendCapabilities() must be called during activation")
	}
	return _capabilities
}

/**
 * Get the process-wide configuration slot (D4b, plan §3.2 Strategy B).
 *
 * Thin accessor over `BackendCapabilities.config` so config-reading modules do not import the
 * host directly. Throws if bootstrap has not run or the host did not provide a config slot.
 */
export function getConfiguration(): IConfiguration {
	const capabilities = getBackendCapabilities()
	if (!capabilities.config) {
		throw new Error("[capabilities] config slot not installed — host must provide an IConfiguration")
	}
	return capabilities.config
}

/**
 * Get the process-wide UI-dialog slot (D4c, plan §3.2 Strategy C).
 *
 * Thin accessor over `BackendCapabilities.uiDialogs` so dialog-calling modules do not import the
 * host directly. Throws if bootstrap has not run or the host did not provide a uiDialogs slot.
 */
export function getUiDialogs(): IUiDialogs {
	const capabilities = getBackendCapabilities()
	if (!capabilities.uiDialogs) {
		throw new Error("[capabilities] uiDialogs slot not installed — host must provide an IUiDialogs")
	}
	return capabilities.uiDialogs
}

/**
 * Get the process-wide logger slot (D4f, plan §3.2 Strategy F).
 *
 * Thin accessor over `BackendCapabilities.logger` so logging modules do not import the host
 * directly. Throws if bootstrap has not run or the host did not provide a logger slot.
 */
export function getBackendLogger(): NonNullable<BackendCapabilities["logger"]> {
	const capabilities = getBackendCapabilities()
	if (!capabilities.logger) {
		throw new Error("[capabilities] logger slot not installed — host must provide a logger")
	}
	return capabilities.logger
}

/**
 * Get the process-wide application root path (D4e, plan §3.2 Strategy E).
 *
 * Thin accessor over `BackendCapabilities.hostContext.appRoot` so ripgrep-locating modules do not
 * import the host directly. Throws if bootstrap has not run or the host did not provide an appRoot.
 */
export function getAppRoot(): string {
	const capabilities = getBackendCapabilities()
	const appRoot = capabilities.hostContext.appRoot
	if (!appRoot) {
		throw new Error("[capabilities] appRoot not installed — host must provide hostContext.appRoot")
	}
	return appRoot
}

/**
 * Get the process-wide file-watcher factory (D4e, plan §3.2 Strategy E).
 *
 * Thin accessor over the optional `BackendCapabilities.fileWatchers` slot so workspace-tracking
 * modules do not import the host directly. Returns undefined when the host did not provide a
 * factory (pre-D4e test fixtures); callers degrade to no file watching.
 */
export function getFileWatchers(): IFileWatcherFactory | undefined {
	const capabilities = getBackendCapabilities()
	return capabilities.fileWatchers
}

/**
 * Get the process-wide open-tab-group slot (D4e, plan §3.2 Strategy E).
 *
 * Thin accessor over the optional `BackendCapabilities.tabGroups` slot so workspace-tracking
 * modules do not import the host directly. Returns undefined in server mode (tab groups are a
 * host UI concept); callers degrade to an empty opened-tabs list.
 */
export function getTabGroups(): ITabGroups | undefined {
	const capabilities = getBackendCapabilities()
	return capabilities.tabGroups
}

/** Check whether capabilities have been installed (for optional-slot degradation paths, e.g. fileWatchers). */
export function hasBackendCapabilities(): boolean {
	return _capabilities !== undefined
}

/**
 * Get the process-wide host-model listing slot (D4g-2 batch 3, locked orchestrator decision Q1 option a).
 *
 * Thin accessor over the optional `BackendCapabilities.getModels` slot so the settings models handler
 * does not import the vscode connector directly. Returns undefined in server mode (no host models);
 * callers degrade to an empty model list.
 */
export function getHostModels(): ((provider: string) => PromiseLike<readonly IHostModel[]>) | undefined {
	const capabilities = getBackendCapabilities()
	return capabilities.getModels
}

/**
 * Get the process-wide host-clipboard slot (D4g-2 batch 3).
 *
 * Thin accessor over the optional `BackendCapabilities.clipboard` slot so copy-to-clipboard modules
 * do not import the host directly. Returns undefined in server mode (no host clipboard); callers
 * degrade to a no-op.
 */
export function getClipboard(): NonNullable<BackendCapabilities["clipboard"]> | undefined {
	const capabilities = getBackendCapabilities()
	return capabilities.clipboard
}

/**
 * Get the process-wide host language-service diagnostics slot (D4g-2 batch 3).
 *
 * Thin accessor over the optional `BackendCapabilities.diagnostics` slot so the shared diagnostics
 * formatter and the "problems" mention do not import the host directly. Returns undefined in server
 * mode (no host language services); callers degrade to "no problems detected".
 */
export function getDiagnostics(): NonNullable<BackendCapabilities["diagnostics"]> | undefined {
	const capabilities = getBackendCapabilities()
	return capabilities.diagnostics
}

/**
 * Get the process-wide host theme service (D4g-2 batch 4).
 *
 * Thin accessor over the optional `BackendCapabilities.hostThemeService` slot so the shared
 * webview-launched handler does not import the vscode connector's `getTheme` directly. Returns
 * undefined in server mode (no host themes); callers degrade to no theme.
 */
export function getHostThemeService(): IHostThemeService | undefined {
	const capabilities = getBackendCapabilities()
	return capabilities.hostThemeService
}

/**
 * Get the process-wide host editor service (D4g-2 batch 4).
 *
 * Thin accessor over the optional `BackendCapabilities.hostEditorService` slot so the shared
 * task-start action does not import the vscode connector's `DiffViewProvider` directly. Returns
 * undefined in server mode (no host editor); callers degrade to an error when a diff view is
 * requested headless.
 */
export function getHostEditorService(): IHostEditorService | undefined {
	const capabilities = getBackendCapabilities()
	return capabilities.hostEditorService
}

/**
 * Get the process-wide host terminal service (D4g-2 batch 4).
 *
 * Thin accessor over the optional `BackendCapabilities.hostTerminalService` slot so the shared
 * execute-command tool and condense-context helper do not import the vscode connector's
 * `TerminalRegistry` directly. Returns undefined in server mode (no host terminals); callers
 * degrade to the execa fallback / an empty terminal section.
 */
export function getHostTerminalService(): IHostTerminalService | undefined {
	const capabilities = getBackendCapabilities()
	return capabilities.hostTerminalService
}
