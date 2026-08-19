export const IntentTypeSettings = {
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
} as const
