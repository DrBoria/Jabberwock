export const IntentTypeCore = {
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

	TaskGoalAddRequested: "task.goal.add.requested",
	TaskGoalRemoveRequested: "task.goal.remove.requested",
	TaskGoalUpdateRequested: "task.goal.update.requested",
	TaskGoalReorderRequested: "task.goal.reorder.requested",

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
