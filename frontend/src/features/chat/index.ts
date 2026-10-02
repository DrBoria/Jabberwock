export { ChatStore, type IChatStore } from "./store"
export * from "./events"
export * from "./task/notifications"
export * from "./task"
export * from "./task/messages"
export * from "./topic"
export * from "./extension-state"

// S4: completed barrel re-exports (no-deep-feature-import)
export { CheckpointRestoreDialog } from "./task/notifications/checkpoint/restore-dialog"
export { DeleteMessageDialog } from "./task/notifications/message-modification-confirmation-dialog"
export { EditMessageDialog } from "./task/notifications/message-modification-confirmation-dialog"
export { ChatTreeViewer } from "./task/messages/components/displays/sidebar"
export { CheckpointWarning } from "./task/notifications/checkpoint/warning"
export { computeVisibleMessages } from "./task/messages/components/utils/visible-messages"
export { computeGroupedMessages } from "./task/messages/components/utils/grouped-messages"
export { ParentContextPanel } from "./task/messages/components/displays/parent-context-panel"
export { AskResponder } from "./task/messages/components/responders/ask-responder"
export { NavigationTriggers } from "./task/messages/components/displays/keyboard-shortcuts"
export { AutoApprovedRequestLimitWarning } from "./task/notifications/auto-approved-request-limit-warning"
export { FollowUpSuggest } from "./task/notifications/follow-up-suggest"
export { Markdown } from "./task/messages/components/message-parts/markdown"
// S4: completed barrel re-exports (no-deep-feature-import)
export type { ChatViewRef } from "./task/messages/view-main"
// S4: completed barrel re-exports (no-deep-feature-import)
export { default as JabberwockHero } from "./extension-state/components/JabberwockHero"
// S4: completed barrel re-exports (no-deep-feature-import)
export { default as TaskHeader } from "./task/components/task-header/header"
// S4: completed barrel re-exports (no-deep-feature-import)
export { default as JabberwockTips } from "./extension-state/components/JabberwockTips"
// S4: completed barrel re-exports (no-deep-feature-import)
export { default as FileChangesPanel } from "./task/messages/components/displays/file-changes-panel"
// S4: completed barrel re-exports (no-deep-feature-import)
export { default as ChatView } from "./task/messages/view-main"
// S4: completed barrel re-exports (no-deep-feature-import)
export { default as ChatRow } from "./task/messages/components/row/view"
// S4: storeImport fixes — standalone store singletons exposed via the feature barrel
export { useChatUI } from "./store"
export { useChatTree } from "./tree/store"
