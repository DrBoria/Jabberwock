import type { Notification } from "./notification.js"
import type { ChatMessage } from "./message.js"

/**
 * All intents — typed union of every possible intent in the system.
 *
 * Intents are REACTIVE entities dispatched by IntentBus. They live in
 * the MST IntentStore and are consumed by handlers registered in the
 * feature directories they belong to.
 *
 * No imperative pipeline — intents chain via the bus.
 */
export type AllIntents =
	| { type: "user.message.received"; payload: { taskId: string; text: string; images?: string[] } }
	| {
			type: "agent.response.received"
			payload: { taskId: string; notification: Notification; chatMessage?: ChatMessage }
	  }
	| { type: "script.finished"; payload: { taskId: string; output: string } }
	| { type: "system.failure"; payload: { taskId: string; error: string } }
	| { type: "send_message_to_agent.requested"; payload: { taskId: string; prompt: string } }
	| { type: "tool.execution.required"; payload: { taskId: string; notification: Notification } }
	| { type: "ask.response.received"; payload: { taskId: string; notification: Notification } }
	| { type: "notification.persist"; payload: { taskId: string } }
	| { type: "webview.event"; payload: { eventType: string; data: Record<string, unknown> } }
	| { type: "task.created"; payload: { taskId: string; text?: string; images?: string[] } }
	| { type: "task.cancelled"; payload: { taskId: string } }
	// ── Message Operations ──────────────────────────────────────────
	| { type: "message.delete.requested"; payload: { taskId: string; messageTs: number } }
	| { type: "message.delete.confirmed"; payload: { taskId: string; messageTs: number; restoreCheckpoint?: boolean } }
	| {
			type: "message.edit.requested"
			payload: { taskId: string; messageTs: number; text: string; images?: string[] }
	  }
	| {
			type: "message.edit.confirmed"
			payload: { taskId: string; messageTs: number; text: string; restoreCheckpoint?: boolean; images?: string[] }
	  }
	// ── Text Area Operations ─────────────────────────────────────────
	| { type: "textarea.enhance.requested"; payload: { text: string } }
	| { type: "textarea.images.select.requested"; payload: Record<string, never> }
	| { type: "textarea.files.search.requested"; payload: { query: string; requestId?: string } }
	| { type: "textarea.images.dragged"; payload: { images: string[] } }
	// ── Topic Operations ────────────────────────────────────────────
	| { type: "topic.mode.switch.requested"; payload: { mode: string } }
	| { type: "topic.commands.requested"; payload: Record<string, never> }
	| { type: "topic.todolist.update"; payload: { todos: unknown[] } }
	// ── Notification Operations ─────────────────────────────────────
	| {
			type: "notification.add"
			payload: {
				taskId: string
				notification: import("./notification.js").Notification
				chatMessage?: ChatMessage
			}
	  }
	| { type: "ask.notification"; payload: { taskId: string; notification: import("./notification.js").Notification } }
	| {
			type: "message.display"
			payload: {
				taskId: string
				notification: import("./notification.js").Notification
				chatMessage?: ChatMessage
			}
	  }
	| { type: "log.write"; payload: { taskId: string; message: string; level: string } }
	| {
			type: "notification.checkpoint.diff.requested"
			payload: { ts: number; mode?: string; commitHash: string; previousCommitHash?: string }
	  }
	| {
			type: "notification.checkpoint.restore.requested"
			payload: { ts?: number; mode?: string; commitHash?: string }
	  }
	| { type: "notification.tts.play"; payload: { text: string } }
	| { type: "notification.tts.stop"; payload: Record<string, never> }
	| { type: "notification.tts.enabled.set"; payload: { enabled: boolean } }
	| { type: "notification.tts.speed.set"; payload: { value: number } }
	| { type: "notification.message.queue"; payload: { text: string; images?: string[] } }
	| { type: "notification.message.queue.edit"; payload: { id: string; text: string; images?: string[] } }
	| { type: "notification.message.queue.remove"; payload: { id: string } }
	| { type: "notification.elicitation.response"; payload: { values: unknown } }
	// ── Task Operations ─────────────────────────────────────────────
	| {
			type: "task.new.requested"
			payload: { text: string; images?: string[]; taskId?: string; taskConfiguration?: unknown }
	  }
	| { type: "task.cancel.requested"; payload: Record<string, never> }
	| { type: "task.clear.requested"; payload: Record<string, never> }
	| { type: "task.resume.requested"; payload: { taskId: string } }
	| { type: "task.sync.enabled.set"; payload: { enabled: boolean } }
	| { type: "task.condense.context.requested"; payload: Record<string, never> }
	| { type: "task.webview.launched"; payload: Record<string, never> }
	| { type: "task.completion.requested"; payload: { taskId: string } }
	// ── Foundation / Window Manager ─────────────────────────────────
	| { type: "foundation.focus.panel.requested"; payload: Record<string, never> }
	| { type: "foundation.tab.switch"; payload: { tab: string; values?: Record<string, unknown>; fromMCP?: boolean } }
	| { type: "foundation.active.page.response"; payload: { requestId: string; activePage: string } }
	| { type: "foundation.state.requested"; payload: Record<string, never> }
	| { type: "foundation.task.aggregated.costs"; payload: { text: string } }
	| { type: "foundation.task.show"; payload: { text: string } }
	| { type: "foundation.task.delete"; payload: { text: string } }
	| { type: "foundation.task.export"; payload: { text: string } }
	| { type: "foundation.task.export.current"; payload: Record<string, never> }
	| { type: "foundation.task.delete.multiple"; payload: { ids: string[] } }
	// ── Context Management ──────────────────────────────────────────
	| {
			type: "context.management.required"
			payload: {
				taskId: string
				autoCondenseContext: boolean
				autoCondenseContextPercent: number
				systemPrompt: string
				environmentDetails?: string
				filesReadByJabberwock?: string[]
				cwd?: string
			}
	  }
	| { type: "context.window.exceeded"; payload: { taskId: string; error: unknown } }
	// ── Settings — Core ─────────────────────────────────────────────
	| { type: "settings.update"; payload: { updatedSettings: Record<string, unknown> } }
	| { type: "settings.announcement.shown"; payload: Record<string, never> }
	| { type: "settings.upsells.dismissed.get"; payload: Record<string, never> }
	| { type: "settings.upsell.dismiss"; payload: { upsellId: string } }
	| { type: "settings.keyboard.shortcuts.open"; payload: { text?: string } }
	| { type: "settings.markdown.preview.open"; payload: { text: string } }
	| { type: "settings.telemetry.set"; payload: { text: string } }
	| { type: "settings.terminal.operation.action"; payload: { terminalOperation: unknown } }
	| { type: "settings.mdm.auth.notification"; payload: Record<string, never> }
	| { type: "settings.commands.allowed.set"; payload: { commands: string[] } }
	| { type: "settings.commands.denied.set"; payload: { commands: string[] } }
	| { type: "settings.commands.file.open"; payload: { text: string } }
	| { type: "settings.commands.delete"; payload: { text: string; values?: { source: string } } }
	| { type: "settings.commands.create"; payload: { text: string; values: { source: string } } }
	| { type: "settings.textarea.text.insert"; payload: { text: string } }
	| { type: "settings.openai.codex.rate.limits"; payload: Record<string, never> }
	| { type: "settings.debug.api.history.open"; payload: Record<string, never> }
	| { type: "settings.debug.ui.history.open"; payload: Record<string, never> }
	| { type: "settings.diagnostics.download"; payload: { values: unknown } }
	// ── Settings — API Config ───────────────────────────────────────
	| { type: "settings.api.config.save"; payload: { text: string; apiConfiguration: Record<string, unknown> } }
	| { type: "settings.api.config.upsert"; payload: { text: string; apiConfiguration: Record<string, unknown> } }
	| {
			type: "settings.api.config.rename"
			payload: {
				text: string
				values: { oldName: string; newName: string }
				apiConfiguration: Record<string, unknown>
			}
	  }
	| { type: "settings.api.config.delete"; payload: { text: string } }
	| { type: "settings.api.config.load"; payload: { text: string } }
	| { type: "settings.api.config.load.by.id"; payload: { text: string } }
	| { type: "settings.api.config.list"; payload: Record<string, never> }
	| { type: "settings.api.config.lock.modes"; payload: { bool: boolean } }
	| { type: "settings.api.config.pin.toggle"; payload: { text: string } }
	| { type: "settings.api.config.enhancement.id"; payload: { text: string } }
	| { type: "settings.api.config.password.set"; payload: Record<string, never> }
	// ── Settings — Code Index ───────────────────────────────────────
	| { type: "settings.code.index.save"; payload: { codeIndexSettings: Record<string, unknown> } }
	| { type: "settings.code.index.status"; payload: Record<string, never> }
	| { type: "settings.code.index.secret.status"; payload: Record<string, never> }
	| { type: "settings.code.index.start"; payload: Record<string, never> }
	| { type: "settings.code.index.stop"; payload: Record<string, never> }
	| { type: "settings.code.index.workspace.toggle"; payload: { bool: boolean } }
	| { type: "settings.code.index.auto.enable"; payload: { bool: boolean } }
	| { type: "settings.code.index.clear"; payload: Record<string, never> }
	// ── Settings — Files ────────────────────────────────────────────
	| { type: "settings.file.image.open"; payload: { text: string; values?: Record<string, unknown> } }
	| { type: "settings.file.image.save"; payload: { dataUri: string } }
	| {
			type: "settings.file.open"
			payload: { text: string; values?: { create?: boolean; content?: string; line?: number } }
	  }
	| { type: "settings.file.content.read"; payload: { text: string } }
	| { type: "settings.file.external.open"; payload: { url: string } }
	| { type: "settings.file.mention.open"; payload: { text: string } }
	// ── Settings — MCP ──────────────────────────────────────────────
	| { type: "settings.mcp.settings.open"; payload: Record<string, never> }
	| { type: "settings.mcp.project.settings.open"; payload: Record<string, never> }
	| { type: "settings.mcp.server.delete"; payload: { serverName: string; source: string } }
	| { type: "settings.mcp.server.restart"; payload: { text: string; source: string } }
	| {
			type: "settings.mcp.tool.always.allow"
			payload: { serverName: string; source: string; toolName: string; alwaysAllow: boolean }
	  }
	| {
			type: "settings.mcp.tool.enabled.for.prompt"
			payload: { serverName: string; source: string; toolName: string; isEnabled: boolean }
	  }
	| { type: "settings.mcp.server.toggle"; payload: { serverName: string; disabled: boolean; source: string } }
	| { type: "settings.mcp.timeout.update"; payload: { serverName: string; value: number; source: string } }
	| { type: "settings.mcp.servers.refresh"; payload: Record<string, never> }
	// ── Settings — Agents / Modes ───────────────────────────────────
	| { type: "settings.mode.custom.update"; payload: { modeConfig: Record<string, unknown> } }
	| { type: "settings.mode.custom.delete"; payload: { slug: string; checkOnly?: boolean } }
	| { type: "settings.mode.export"; payload: { slug: string } }
	| { type: "settings.mode.import"; payload: { source: string } }
	| { type: "settings.mode.rules.directory.check"; payload: { slug: string } }
	| { type: "settings.mode.selector.opened"; payload: { bool: boolean } }
	| { type: "settings.modes.request"; payload: Record<string, never> }
	| { type: "settings.mode.custom.settings.open"; payload: Record<string, never> }
	// ── Settings — Models ───────────────────────────────────────────
	| {
			type: "settings.models.router.request"
			payload: {
				values?: { provider?: string; refresh?: boolean; litellmApiKey?: string; litellmBaseUrl?: string }
			}
	  }
	| {
			type: "settings.models.openai.request"
			payload: { values: { baseUrl: string; apiKey: string; openAiHeaders?: Record<string, string> } }
	  }
	| { type: "settings.models.ollama.request"; payload: Record<string, never> }
	| { type: "settings.models.lmstudio.request"; payload: Record<string, never> }
	| { type: "settings.models.roo.request"; payload: Record<string, never> }
	| { type: "settings.models.roo.credit.balance"; payload: { requestId?: string } }
	| { type: "settings.models.vscode.lm.request"; payload: Record<string, never> }
	| { type: "settings.models.router.flush"; payload: { text: string } }
	// ── Settings — Context / Prompts ────────────────────────────────
	| { type: "settings.prompt.update"; payload: { promptMode: string; customPrompt: Record<string, unknown> } }
	| {
			type: "settings.prompt.system.template.update"
			payload: { systemPromptTemplateKey: string; systemPromptTemplate?: string }
	  }
	| { type: "settings.prompt.system.get"; payload: { mode?: string } }
	| { type: "settings.prompt.system.copy"; payload: { mode?: string } }
	| { type: "settings.instructions.custom.update"; payload: { text: string } }
	// ── Settings — VSCode ───────────────────────────────────────────
	| { type: "settings.vscode.setting.update"; payload: { setting: string; value: unknown } }
	| { type: "settings.vscode.setting.get"; payload: { setting: string } }
	| { type: "settings.auto.approval.enabled"; payload: { bool: boolean } }
	| { type: "settings.debug.setting"; payload: { bool: boolean } }
	// ── Settings — Webview / Devtool ────────────────────────────────
	| { type: "settings.devtool.status"; payload: Record<string, never> }
	| { type: "settings.webview.log"; payload: { text: string } }
	| { type: "settings.webview.dom.response"; payload: { requestId: string; text: string } }
	| { type: "settings.webview.error"; payload: { text: string } }
	| { type: "settings.webview.url.fetch"; payload: { url: string; requestId: string } }
	| {
			type: "settings.locator.file.open"
			payload: { locatorPayload: { filePath: string; line: number; column: number } }
	  }
	| { type: "settings.locator.target.set"; payload: { text: string } }
	// ── Settings — Worktree ─────────────────────────────────────────
	| { type: "settings.worktree.list"; payload: Record<string, never> }
	| {
			type: "settings.worktree.create"
			payload: {
				worktreePath: string
				worktreeBranch?: string
				worktreeBaseBranch?: string
				worktreeCreateNewBranch?: boolean
			}
	  }
	| { type: "settings.worktree.delete"; payload: { worktreePath: string; worktreeForce?: boolean } }
	| { type: "settings.worktree.switch"; payload: { worktreePath: string; worktreeNewWindow?: boolean } }
	| { type: "settings.worktree.branches.available"; payload: Record<string, never> }
	| { type: "settings.worktree.defaults"; payload: Record<string, never> }
	| { type: "settings.worktree.include.status"; payload: Record<string, never> }
	| { type: "settings.worktree.branch.include.check"; payload: { worktreeBranch: string } }
	| { type: "settings.worktree.include.create"; payload: { worktreeIncludeContent: string } }
	| { type: "settings.worktree.branch.checkout"; payload: { worktreeBranch: string } }
	| { type: "settings.worktree.path.browse"; payload: Record<string, never> }
	// ── Settings — Skills ───────────────────────────────────────────
	| { type: "settings.skills.request"; payload: Record<string, never> }
	| {
			type: "settings.skill.create"
			payload: {
				skillName: string
				source: string
				skillDescription: string
				skillMode?: string
				skillModeSlugs?: string[]
			}
	  }
	| {
			type: "settings.skill.delete"
			payload: { skillName: string; source: string; skillMode?: string; skillModeSlugs?: string[] }
	  }
	| {
			type: "settings.skill.move"
			payload: { skillName: string; source: string; skillMode?: string; newSkillMode?: string }
	  }
	| {
			type: "settings.skill.modes.update"
			payload: { skillName: string; source: string; newSkillModeSlugs?: string[] }
	  }
	| { type: "settings.skill.file.open"; payload: { skillName: string; source: string } }
	// ── Cloud ────────────────────────────────────────────────────────
	| { type: "cloud.button.clicked"; payload: Record<string, never> }
	| { type: "cloud.sign.in"; payload: { useProviderSignup?: boolean } }
	| { type: "cloud.landing.page.sign.in"; payload: { text?: string } }
	| { type: "cloud.sign.out"; payload: Record<string, never> }
	| { type: "cloud.manual.url"; payload: { text?: string } }
	| { type: "cloud.openai.codex.sign.in"; payload: Record<string, never> }
	| { type: "cloud.openai.codex.sign.out"; payload: Record<string, never> }
	| { type: "cloud.switch.organization"; payload: { organizationId?: string | null } }
	| { type: "cloud.clear.auth.skip.model"; payload: Record<string, never> }
	// ── Diagnostics ──────────────────────────────────────────────────
	| { type: "diagnostics.clear"; payload: Record<string, never> }
	// ── History ──────────────────────────────────────────────────────
	| { type: "history.commits.search"; payload: { query?: string } }
	| { type: "history.settings.import"; payload: Record<string, never> }
	| { type: "history.settings.export"; payload: Record<string, never> }
	| { type: "history.state.reset"; payload: Record<string, never> }
	| { type: "history.button.clicked"; payload: Record<string, never> }
	// ── Marketplace ──────────────────────────────────────────────────
	| { type: "marketplace.items.filter"; payload: { marketplaceManager?: unknown; filters?: Record<string, unknown> } }
	| {
			type: "marketplace.item.install"
			payload: {
				marketplaceManager?: unknown
				mpItem?: Record<string, unknown>
				mpInstallOptions?: Record<string, unknown>
			}
	  }
	| {
			type: "marketplace.item.install.with.parameters"
			payload: { marketplaceManager?: unknown; payload?: Record<string, unknown> }
	  }
	| {
			type: "marketplace.item.remove"
			payload: {
				marketplaceManager?: unknown
				mpItem?: Record<string, unknown>
				mpInstallOptions?: Record<string, unknown>
			}
	  }
	| { type: "marketplace.data.fetch"; payload: Record<string, never> }
	| { type: "marketplace.tools.refresh"; payload: Record<string, never> }
	| { type: "marketplace.install.cancel"; payload: Record<string, never> }
	| { type: "marketplace.button.clicked"; payload: Record<string, never> }
/**
 * String constants for each intent type — used for bus.register() and
 * store.createIntent() calls.
 */
export const IntentType = {
	UserMessageReceived: "user.message.received",
	AgentResponseReceived: "agent.response.received",
	ScriptFinished: "script.finished",
	SystemFailure: "system.failure",
	SendMessageToAgentRequested: "send_message_to_agent.requested",
	ToolExecutionRequired: "tool.execution.required",
	AskResponseReceived: "ask.response.received",
	NotificationPersist: "notification.persist",
	WebviewEvent: "webview.event",
	TaskCreated: "task.created",
	TaskCancelled: "task.cancelled",

	MessageDeleteRequested: "message.delete.requested",
	MessageDeleteConfirmed: "message.delete.confirmed",
	MessageEditRequested: "message.edit.requested",
	MessageEditConfirmed: "message.edit.confirmed",

	// ── Text Area Operations ─────────────────────────────────────────
	TextareaEnhanceRequested: "textarea.enhance.requested",
	TextareaImagesSelectRequested: "textarea.images.select.requested",
	TextareaFilesSearchRequested: "textarea.files.search.requested",
	TextareaImagesDragged: "textarea.images.dragged",

	// ── Topic Operations ────────────────────────────────────────────
	TopicModeSwitchRequested: "topic.mode.switch.requested",
	TopicCommandsRequested: "topic.commands.requested",
	TopicTodolistUpdate: "topic.todolist.update",

	// ── Notification Operations ─────────────────────────────────────
	NotificationAdd: "notification.add",
	AskNotification: "ask.notification",
	MessageDisplay: "message.display",
	LogWrite: "log.write",
	NotificationCheckpointDiffRequested: "notification.checkpoint.diff.requested",
	NotificationCheckpointRestoreRequested: "notification.checkpoint.restore.requested",
	NotificationTtsPlay: "notification.tts.play",
	NotificationTtsStop: "notification.tts.stop",
	NotificationTtsEnabledSet: "notification.tts.enabled.set",
	NotificationTtsSpeedSet: "notification.tts.speed.set",
	NotificationMessageQueue: "notification.message.queue",
	NotificationMessageQueueEdit: "notification.message.queue.edit",
	NotificationMessageQueueRemove: "notification.message.queue.remove",
	NotificationElicitationResponse: "notification.elicitation.response",

	// ── Task Operations ─────────────────────────────────────────────
	TaskNewRequested: "task.new.requested",
	TaskCancelRequested: "task.cancel.requested",
	TaskClearRequested: "task.clear.requested",
	TaskResumeRequested: "task.resume.requested",
	TaskSyncEnabledSet: "task.sync.enabled.set",
	TaskCondenseContextRequested: "task.condense.context.requested",
	TaskWebviewLaunched: "task.webview.launched",
	TaskCompletionRequested: "task.completion.requested",

	// ── Foundation / Window Manager ─────────────────────────────────
	FoundationFocusPanelRequested: "foundation.focus.panel.requested",
	FoundationTabSwitch: "foundation.tab.switch",
	FoundationActivePageResponse: "foundation.active.page.response",
	FoundationStateRequested: "foundation.state.requested",
	FoundationTaskAggregatedCosts: "foundation.task.aggregated.costs",
	FoundationTaskShow: "foundation.task.show",
	FoundationTaskDelete: "foundation.task.delete",
	FoundationTaskExport: "foundation.task.export",
	FoundationTaskExportCurrent: "foundation.task.export.current",
	FoundationTaskDeleteMultiple: "foundation.task.delete.multiple",

	// ── Context Management ──────────────────────────────────────────
	ContextManagementRequired: "context.management.required",
	ContextWindowExceeded: "context.window.exceeded",

	// ── Settings — Core ─────────────────────────────────────────────
	SettingsUpdate: "settings.update",
	SettingsAnnouncementShown: "settings.announcement.shown",
	SettingsUpsellsDismissedGet: "settings.upsells.dismissed.get",
	SettingsUpsellDismiss: "settings.upsell.dismiss",
	SettingsKeyboardShortcutsOpen: "settings.keyboard.shortcuts.open",
	SettingsMarkdownPreviewOpen: "settings.markdown.preview.open",
	SettingsTelemetrySet: "settings.telemetry.set",
	SettingsTerminalOperationAction: "settings.terminal.operation.action",
	SettingsMdmAuthNotification: "settings.mdm.auth.notification",
	SettingsCommandsAllowedSet: "settings.commands.allowed.set",
	SettingsCommandsDeniedSet: "settings.commands.denied.set",
	SettingsCommandsFileOpen: "settings.commands.file.open",
	SettingsCommandsDelete: "settings.commands.delete",
	SettingsCommandsCreate: "settings.commands.create",
	SettingsTextareaTextInsert: "settings.textarea.text.insert",
	SettingsOpenaiCodexRateLimits: "settings.openai.codex.rate.limits",
	SettingsDebugApiHistoryOpen: "settings.debug.api.history.open",
	SettingsDebugUiHistoryOpen: "settings.debug.ui.history.open",
	SettingsDiagnosticsDownload: "settings.diagnostics.download",

	// ── Settings — API Config ───────────────────────────────────────
	SettingsApiConfigSave: "settings.api.config.save",
	SettingsApiConfigUpsert: "settings.api.config.upsert",
	SettingsApiConfigRename: "settings.api.config.rename",
	SettingsApiConfigDelete: "settings.api.config.delete",
	SettingsApiConfigLoad: "settings.api.config.load",
	SettingsApiConfigLoadById: "settings.api.config.load.by.id",
	SettingsApiConfigList: "settings.api.config.list",
	SettingsApiConfigLockModes: "settings.api.config.lock.modes",
	SettingsApiConfigPinToggle: "settings.api.config.pin.toggle",
	SettingsApiConfigEnhancementId: "settings.api.config.enhancement.id",
	SettingsApiConfigPasswordSet: "settings.api.config.password.set",

	// ── Settings — Code Index ───────────────────────────────────────
	SettingsCodeIndexSave: "settings.code.index.save",
	SettingsCodeIndexStatus: "settings.code.index.status",
	SettingsCodeIndexSecretStatus: "settings.code.index.secret.status",
	SettingsCodeIndexStart: "settings.code.index.start",
	SettingsCodeIndexStop: "settings.code.index.stop",
	SettingsCodeIndexWorkspaceToggle: "settings.code.index.workspace.toggle",
	SettingsCodeIndexAutoEnable: "settings.code.index.auto.enable",
	SettingsCodeIndexClear: "settings.code.index.clear",

	// ── Settings — Files ────────────────────────────────────────────
	SettingsFileImageOpen: "settings.file.image.open",
	SettingsFileImageSave: "settings.file.image.save",
	SettingsFileOpen: "settings.file.open",
	SettingsFileContentRead: "settings.file.content.read",
	SettingsFileExternalOpen: "settings.file.external.open",
	SettingsFileMentionOpen: "settings.file.mention.open",

	// ── Settings — MCP ──────────────────────────────────────────────
	SettingsMcpSettingsOpen: "settings.mcp.settings.open",
	SettingsMcpProjectSettingsOpen: "settings.mcp.project.settings.open",
	SettingsMcpServerDelete: "settings.mcp.server.delete",
	SettingsMcpServerRestart: "settings.mcp.server.restart",
	SettingsMcpToolAlwaysAllow: "settings.mcp.tool.always.allow",
	SettingsMcpToolEnabledForPrompt: "settings.mcp.tool.enabled.for.prompt",
	SettingsMcpServerToggle: "settings.mcp.server.toggle",
	SettingsMcpTimeoutUpdate: "settings.mcp.timeout.update",
	SettingsMcpServersRefresh: "settings.mcp.servers.refresh",

	// ── Settings — Agents / Modes ───────────────────────────────────
	SettingsModeCustomUpdate: "settings.mode.custom.update",
	SettingsModeCustomDelete: "settings.mode.custom.delete",
	SettingsModeExport: "settings.mode.export",
	SettingsModeImport: "settings.mode.import",
	SettingsModeRulesDirectoryCheck: "settings.mode.rules.directory.check",
	SettingsModeSelectorOpened: "settings.mode.selector.opened",
	SettingsModesRequest: "settings.modes.request",
	SettingsModeCustomSettingsOpen: "settings.mode.custom.settings.open",
	SettingsModeFileChanged: "settings.mode.file.changed",

	// ── Settings — Models ───────────────────────────────────────────
	SettingsModelsRouterRequest: "settings.models.router.request",
	SettingsModelsOpenaiRequest: "settings.models.openai.request",
	SettingsModelsOllamaRequest: "settings.models.ollama.request",
	SettingsModelsLmstudioRequest: "settings.models.lmstudio.request",
	SettingsModelsRooRequest: "settings.models.roo.request",
	SettingsModelsRooCreditBalance: "settings.models.roo.credit.balance",
	SettingsModelsVscodeLmRequest: "settings.models.vscode.lm.request",
	SettingsModelsRouterFlush: "settings.models.router.flush",

	// ── Settings — Context / Prompts ────────────────────────────────
	SettingsPromptUpdate: "settings.prompt.update",
	SettingsPromptSystemTemplateUpdate: "settings.prompt.system.template.update",
	SettingsPromptSystemGet: "settings.prompt.system.get",
	SettingsPromptSystemCopy: "settings.prompt.system.copy",
	SettingsInstructionsCustomUpdate: "settings.instructions.custom.update",

	// ── Settings — VSCode ───────────────────────────────────────────
	SettingsVscodeSettingUpdate: "settings.vscode.setting.update",
	SettingsVscodeSettingGet: "settings.vscode.setting.get",
	SettingsAutoApprovalEnabled: "settings.auto.approval.enabled",
	SettingsDebugSetting: "settings.debug.setting",

	// ── Settings — Webview / Devtool ────────────────────────────────
	SettingsDevtoolStatus: "settings.devtool.status",
	SettingsWebviewLog: "settings.webview.log",
	SettingsWebviewDomResponse: "settings.webview.dom.response",
	SettingsWebviewError: "settings.webview.error",
	SettingsWebviewUrlFetch: "settings.webview.url.fetch",
	SettingsLocatorFileOpen: "settings.locator.file.open",
	SettingsLocatorTargetSet: "settings.locator.target.set",

	// ── Settings — Worktree ─────────────────────────────────────────
	SettingsWorktreeList: "settings.worktree.list",
	SettingsWorktreeCreate: "settings.worktree.create",
	SettingsWorktreeDelete: "settings.worktree.delete",
	SettingsWorktreeSwitch: "settings.worktree.switch",
	SettingsWorktreeBranchesAvailable: "settings.worktree.branches.available",
	SettingsWorktreeDefaults: "settings.worktree.defaults",
	SettingsWorktreeIncludeStatus: "settings.worktree.include.status",
	SettingsWorktreeBranchIncludeCheck: "settings.worktree.branch.include.check",
	SettingsWorktreeIncludeCreate: "settings.worktree.include.create",
	SettingsWorktreeBranchCheckout: "settings.worktree.branch.checkout",
	SettingsWorktreePathBrowse: "settings.worktree.path.browse",

	// ── Settings — Skills ───────────────────────────────────────────
	SettingsSkillsRequest: "settings.skills.request",
	SettingsSkillCreate: "settings.skill.create",
	SettingsSkillDelete: "settings.skill.delete",
	SettingsSkillMove: "settings.skill.move",
	SettingsSkillModesUpdate: "settings.skill.modes.update",
	SettingsSkillFileOpen: "settings.skill.file.open",

	// ── Cloud ────────────────────────────────────────────────────────
	CloudButtonClicked: "cloud.button.clicked",
	CloudSignIn: "cloud.sign.in",
	CloudLandingPageSignIn: "cloud.landing.page.sign.in",
	CloudSignOut: "cloud.sign.out",
	CloudManualUrl: "cloud.manual.url",
	CloudOpenaiCodexSignIn: "cloud.openai.codex.sign.in",
	CloudOpenaiCodexSignOut: "cloud.openai.codex.sign.out",
	CloudSwitchOrganization: "cloud.switch.organization",
	CloudClearAuthSkipModel: "cloud.clear.auth.skip.model",

	// ── Diagnostics ──────────────────────────────────────────────────
	DiagnosticsClear: "diagnostics.clear",

	// ── History ──────────────────────────────────────────────────────
	HistoryCommitsSearch: "history.commits.search",
	HistorySettingsImport: "history.settings.import",
	HistorySettingsExport: "history.settings.export",
	HistoryStateReset: "history.state.reset",
	HistoryButtonClicked: "history.button.clicked",

	// ── Marketplace ──────────────────────────────────────────────────
	MarketplaceItemsFilter: "marketplace.items.filter",
	MarketplaceItemInstall: "marketplace.item.install",
	MarketplaceItemInstallWithParameters: "marketplace.item.install.with.parameters",
	MarketplaceItemRemove: "marketplace.item.remove",
	MarketplaceDataFetch: "marketplace.data.fetch",
	MarketplaceToolsRefresh: "marketplace.tools.refresh",
	MarketplaceInstallCancel: "marketplace.install.cancel",
	MarketplaceButtonClicked: "marketplace.button.clicked",
} as const

/**
 * Lifecycle status of an intent in the store.
 */
export enum IntentStatus {
	Queued = "queued",
	Processing = "processing",
	Success = "success",
	Failed = "failed",
}

/**
 * An intent instance stored in the MST IntentStore.
 */
export interface Intent {
	id: string
	type: string
	payload: Record<string, unknown>
	status: IntentStatus
	createdAt: number
	traceId?: string
	parentId?: string
}
