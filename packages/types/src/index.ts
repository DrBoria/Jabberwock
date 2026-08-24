export * from "./api/api.ts"
export * from "./features/cli.ts"
export * from "./cloud/index.ts"
export * from "./execution/codebase-index.ts"
export * from "./utils/context-management.ts"
export * from "./utils/cookie-consent.ts"
export * from "./mcp/custom-tool.ts"
export * from "./execution/embedding.ts"
export * from "./events/types.ts"
export { taskEventSchema, type TaskEvent } from "./events/task.ts"
export * from "./features/experiment.ts"
export * from "./task/followup.ts"
export * from "./task/git.ts"
export * from "./settings/global/index.ts"
export * from "./task/history.ts"
export * from "./utils/image-generation.ts"
export * from "./api/ipc.ts"
export * from "./features/marketplace.ts"
export * from "./mcp/mcp.ts"
export * from "./messages/types.ts"
export * from "./messages/notification.ts"
export * from "./messages/notification-ask.ts"
export * from "./messages/notification-say.ts"
export * from "./models/mode.ts"
export * from "./models/model.ts"
export * from "./settings/provider/index.ts"
export * from "./models/by-provider.ts"
export * from "./models/model-id-keys.ts"
export * from "./task/task.ts"
export * from "./features/skills.ts"
export * from "./todo.ts"
export * from "./payload-schemas.ts"
export * from "./telemetry/properties.ts"
export * from "./telemetry/interfaces.ts"
export * from "./telemetry/event-names.ts"
export * from "./telemetry/event-schema.ts"
export * from "./telemetry/error-utils.ts"
export {
	ApiProviderError,
	ConsecutiveMistakeError,
	extractApiProviderErrorProperties,
	extractConsecutiveMistakeErrorProperties,
	isApiProviderError,
	isConsecutiveMistakeError,
} from "./telemetry/errors.ts"
export type { ConsecutiveMistakeReason } from "./telemetry/errors.ts"
export * from "./execution/terminal.ts"
export * from "./tool/tool.ts"
export * from "./tool/params.ts"
export * from "./utils/type-fu.ts"
export * from "./extension/message-types.ts"
export * from "./extension/message.ts"
export * from "./extension/state.ts"
export * from "./webview/message-types.ts"
export * from "./webview/message.ts"
export * from "./tool/say-tool-data.ts"
export * from "./protocol/envelope.ts"
export * from "./protocol/backend-connector.ts"
export * from "./protocol/frontend-connector.ts"
export * from "./utils/misc-types.ts"
export * from "./utils/worktree.ts"
export * from "./vscode/types.ts"
export * from "./intents/types.ts"
export * from "./messages/messageBus.ts"
export * from "./providers/index.ts"
export * from "./utils/diagnostics.ts"
export * from "./events/constants.ts"

// Re-exports from cloud sub-modules
export type {
	JWTPayload,
	CloudUserInfo,
	CloudOrganization,
	CloudOrganizationMembership,
	OrganizationAllowList,
	OrganizationDefaultSettings,
	OrganizationCloudSettings,
	OrganizationSettings,
	OrganizationFeatures,
	UserFeatures,
	UserSettingsConfig,
	UserSettingsData,
	WorkspaceTaskVisibility,
} from "./cloud/organization.ts"
export {
	organizationAllowListSchema,
	organizationDefaultSettingsSchema,
	organizationCloudSettingsSchema,
	organizationSettingsSchema,
	organizationFeaturesSchema,
	userFeaturesSchema,
	userSettingsConfigSchema,
	userSettingsDataSchema,
	ORGANIZATION_ALLOW_ALL,
	ORGANIZATION_DEFAULT,
} from "./cloud/organization.ts"
export type {
	AuthState,
	AuthService,
	AuthServiceEvents,
	SettingsService,
	SettingsServiceEvents,
	CloudServiceEvents,
} from "./cloud/service.ts"
export {
	TaskBridgeEventName,
	TaskBridgeCommandName,
	ExtensionSocketEvents,
	TaskSocketEvents,
	taskBridgeEventSchema,
	taskBridgeCommandSchema,
} from "./cloud/socket.ts"
export type { TaskBridgeEvent, TaskBridgeCommand } from "./cloud/socket.ts"

// Re-exports from event-registry sub-modules
export type { AskResponseValue } from "./events/chat/registry.ts"
export type {
	ChatMessagesListBackendToWebview,
	ChatMessagesListWebviewToBackend,
	ChatNotificationsBackendToWebview,
	ChatNotificationsWebviewToBackend,
	ChatTaskBackendToWebview,
	ChatTaskWebviewToBackend,
	ChatTextAreaBackendToWebview,
	ChatTextAreaWebviewToBackend,
	ChatTopicBackendToWebview,
	ChatTopicWebviewToBackend,
	ChatBackendToWebview,
	ChatWebviewToBackend,
} from "./events/chat/registry.ts"
export type {
	CloudBackendToWebview,
	CloudWebviewToBackend,
	DiagnosticsBackendToWebview,
	DiagnosticsWebviewToBackend,
} from "./events/cloud/registry.ts"
export type {
	FoundationAgentStateBackendToWebview,
	FoundationAgentStateWebviewToBackend,
	FoundationWindowManagerBackendToWebview,
	FoundationWindowManagerWebviewToBackend,
	FoundationMstBackendToWebview,
	FoundationMstWebviewToBackend,
	FoundationBackendToWebview,
	FoundationWebviewToBackend,
} from "./events/foundation/registry.ts"
export type {
	HistoryBackendToWebview,
	HistoryWebviewToBackend,
	MarketplaceBackendToWebview,
	MarketplaceWebviewToBackend,
} from "./events/history-marketplace/registry.ts"
export type { SettingsBackendToWebview, SettingsWebviewToBackend } from "./events/settings/registry.ts"
export type { BackendInternalEvents } from "./events/internal/registry.ts"

// Event registry root types
export type { BackendToWebview, WebviewToBackend } from "./events/registry.ts"

export * from "./events/flat/constants.ts"

export type { WebviewProvider, IntentContext, RootStore } from "./extension/types.ts"
