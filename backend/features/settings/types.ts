import type {
	AskResponseValue,
	ExtensionState,
	FollowUpData,
	McpServer,
	McpTool,
	McpServerUse,
	SayToolData,
} from "@jabberwock/types"

/** Root settings state — sub-features manage their own slices */
export type SettingsRootState = object

// ─── Auto-approval state types ────────────────────────────────

export type AutoApprovalState =
	| "alwaysAllowReadOnly"
	| "alwaysAllowWrite"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "alwaysAllowSubtasks"
	| "alwaysAllowExecute"
	| "alwaysAllowFollowupQuestions"

export type AutoApprovalStateOptions =
	| "autoApprovalEnabled"
	| "alwaysAllowReadOnlyOutsideWorkspace"
	| "alwaysAllowWriteOutsideWorkspace"
	| "alwaysAllowWriteProtected"
	| "followupAutoApproveTimeoutMs"
	| "mcpServers"
	| "allowedCommands"
	| "deniedCommands"

export type CheckAutoApprovalResult =
	| { decision: "approve" }
	| { decision: "deny" }
	| { decision: "ask" }
	| {
			decision: "timeout"
			timeout: number
			fn: () => { askResponse: AskResponseValue; text?: string; images?: string[] }
	  }

// ─── Command decision types ────────────────────────────────────

export type CommandDecision = "auto_approve" | "auto_deny" | "ask_user"

// ─── Auto-approval result type ─────────────────────────────────

export interface AutoApprovalResult {
	shouldProceed: boolean
	requiresApproval: boolean
	approvalType?: "requests" | "cost"
	approvalCount?: number | string
}

// ─── Auto-approval dependency type ─────────────────────────────

export interface AutoApprovalDeps {
	state?: Pick<ExtensionState, AutoApprovalState | AutoApprovalStateOptions>
	text?: string
	isProtected?: boolean
}

// ─── Tool handler type ─────────────────────────────────────────

export type ToolHandler = (state: AutoApprovalDeps["state"], isProtected?: boolean) => CheckAutoApprovalResult

// ─── Re-export for convenience ─────────────────────────────────

export type { FollowUpData, McpServer, McpTool, McpServerUse, SayToolData }
