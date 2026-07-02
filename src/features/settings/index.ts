// ─── Re-exports from store.ts ──────────────────────────────────
export { initSettingsState, getSettingsState } from "./store"
export type { SettingsRootState } from "./store"

// ─── Re-exports from store.types.ts ────────────────────────────
export type {
	AutoApprovalState,
	AutoApprovalStateOptions,
	CheckAutoApprovalResult,
	CommandDecision,
	AutoApprovalResult,
	AutoApprovalDeps,
	ToolHandler,
} from "./store.types"

// ─── Re-exports from store.commands.ts ─────────────────────────
export {
	containsDangerousSubstitution,
	findLongestPrefixMatch,
	isAutoApprovedSingleCommand,
	isAutoDeniedSingleCommand,
	getCommandDecision,
	getSingleCommandDecision,
} from "./store.commands"

// ─── Re-exports from store.auto-approval.ts ────────────────────
export { checkAutoApproval } from "./store.auto-approval"

// ─── Re-exports from autoapprovalhandler/store.ts ──────
export { AutoApprovalHandlerModel } from "./autoapprovalhandler/store"
export type { IAutoApprovalHandler } from "./autoapprovalhandler/store"
