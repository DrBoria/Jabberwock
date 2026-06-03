import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import { getState } from "@features/storeSingleton"

import {
	type NotificationAsk,
	type SayToolData,
	type McpServerUse,
	type McpServer,
	type McpTool,
	type FollowUpData,
	type ExtensionState,
	isNonBlockingAsk,
	AskResponseValue,
	type GlobalState,
	type Notification,
} from "@jabberwock/types"

import { getApiMetrics } from "../../shared/getApiMetrics"
import { parseCommand } from "../../shared/parse-command"

/** Root settings state — sub-features manage their own slices */
export type SettingsRootState = object

export function initSettingsState(_provider: EventBridge): void {
	// All settings sub-models use types.optional(Model, {}) in store.ts,
	// so MST provides default values automatically. No direct mutations needed.
}

import type { IBackendRootStore } from "../store"

export function getSettingsState(rootStore: IBackendRootStore): SettingsRootState {
	return rootStore.settings as SettingsRootState
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-APPROVAL LOGIC (migrated from autoApproval.ts, autoApprovalHandler.ts,
// and autoApprovalCommands.ts)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────

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

// ─── Command Decision Types (from autoApprovalCommands.ts) ─────────────

export type CommandDecision = "auto_approve" | "auto_deny" | "ask_user"

// ─── AutoApprovalResult (from autoApprovalHandler.ts) ─────────────────

export interface AutoApprovalResult {
	shouldProceed: boolean
	requiresApproval: boolean
	approvalType?: "requests" | "cost"
	approvalCount?: number | string
}

// ─── Command helpers (from autoApprovalCommands.ts) ────────────────────

/**
 * Detect dangerous parameter substitutions that could lead to command execution.
 */
export function containsDangerousSubstitution(source: string): boolean {
	const dangerousParameterExpansion = /\$\{[^}]*@[PQEAa][^}]*\}/.test(source)

	const parameterAssignmentWithEscapes =
		/\$\{[^}]*[=+\-?][^}]*\\[0-7]{3}[^}]*\}/.test(source) ||
		/\$\{[^}]*[=+\-?][^}]*\\x[0-9a-fA-F]{2}[^}]*\}/.test(source) ||
		/\$\{[^}]*[=+\-?][^}]*\\u[0-9a-fA-F]{4}[^}]*\}/.test(source)

	const indirectExpansion = /\$\{![^}]+\}/.test(source)

	const hereStringWithSubstitution = /<<<\s*(\$\(|`)/.test(source)

	const zshProcessSubstitution = /(?:(?<=^)|(?<=[\s;|&(<]))=\([^)]+\)/.test(source)

	const zshGlobQualifier = /[*?+@!]\(e:[^:]+:\)/.test(source)

	return (
		dangerousParameterExpansion ||
		parameterAssignmentWithEscapes ||
		indirectExpansion ||
		hereStringWithSubstitution ||
		zshProcessSubstitution ||
		zshGlobQualifier
	)
}

/**
 * Find the longest matching prefix from a list of prefixes for a given command.
 */
export function findLongestPrefixMatch(command: string, prefixes: string[]): string | null {
	if (!command || !prefixes?.length) {
		return null
	}

	const trimmedCommand = command.trim().toLowerCase()
	let longestMatch: string | null = null

	for (const prefix of prefixes) {
		const lowerPrefix = prefix.toLowerCase()
		if (lowerPrefix === "*" || trimmedCommand.startsWith(lowerPrefix)) {
			if (!longestMatch || lowerPrefix.length > longestMatch.length) {
				longestMatch = lowerPrefix
			}
		}
	}

	return longestMatch
}

/**
 * Check if a single command should be auto-approved.
 */
export function isAutoApprovedSingleCommand(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): boolean {
	if (!command) {
		return true
	}

	if (!allowedCommands?.length) {
		return false
	}

	const hasWildcard = allowedCommands.some((cmd) => cmd.toLowerCase() === "*")

	if (deniedCommands === undefined) {
		const trimmedCommand = command.trim().toLowerCase()

		return allowedCommands.some((prefix) => {
			const lowerPrefix = prefix.toLowerCase()
			return lowerPrefix === "*" || trimmedCommand.startsWith(lowerPrefix)
		})
	}

	const longestDeniedMatch = findLongestPrefixMatch(command, deniedCommands)
	const longestAllowedMatch = findLongestPrefixMatch(command, allowedCommands)

	if (hasWildcard && !longestDeniedMatch) {
		return true
	}

	if (!longestAllowedMatch) {
		return false
	}

	if (!longestDeniedMatch) {
		return true
	}

	return longestAllowedMatch.length > longestDeniedMatch.length
}

/**
 * Check if a single command should be auto-denied.
 */
export function isAutoDeniedSingleCommand(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): boolean {
	if (!command) return false

	if (!deniedCommands?.length) return false

	const longestDeniedMatch = findLongestPrefixMatch(command, deniedCommands)
	const longestAllowedMatch = findLongestPrefixMatch(command, allowedCommands || [])

	if (!longestDeniedMatch) return false

	if (!longestAllowedMatch) return true

	return longestDeniedMatch.length >= longestAllowedMatch.length
}

/**
 * Unified command validation that implements the longest prefix match rule.
 */
export function getCommandDecision(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): CommandDecision {
	if (!command?.trim()) {
		return "auto_approve"
	}

	const subCommands = parseCommand(command)

	const decisions: CommandDecision[] = subCommands.map((cmd) => {
		const cmdWithoutRedirection = cmd.replace(/\d*>&\d*/, "").trim()

		return getSingleCommandDecision(cmdWithoutRedirection, allowedCommands, deniedCommands)
	})

	if (decisions.includes("auto_deny")) {
		return "auto_deny"
	}

	if (containsDangerousSubstitution(command)) {
		return "ask_user"
	}

	if (decisions.every((decision) => decision === "auto_approve")) {
		return "auto_approve"
	}

	return "ask_user"
}

/**
 * Get the decision for a single command using longest prefix match rule.
 */
export function getSingleCommandDecision(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): CommandDecision {
	if (!command) return "auto_approve"

	const longestAllowedMatch = findLongestPrefixMatch(command, allowedCommands || [])
	const longestDeniedMatch = findLongestPrefixMatch(command, deniedCommands || [])

	if (longestAllowedMatch && !longestDeniedMatch) {
		return "auto_approve"
	}

	if (!longestAllowedMatch && longestDeniedMatch) {
		return "auto_deny"
	}

	if (longestAllowedMatch && longestDeniedMatch) {
		return longestAllowedMatch.length > longestDeniedMatch.length ? "auto_approve" : "auto_deny"
	}

	return "ask_user"
}

// ─── Tool helpers (from autoApproval.ts) ───────────────────────────────

function isWriteToolAction(tool: SayToolData): boolean {
	return ["editedExistingFile", "appliedDiff", "newFileCreated", "generateImage"].includes(tool.tool)
}

function isReadOnlyToolAction(tool: SayToolData): boolean {
	return [
		"readFile",
		"listFiles",
		"listFilesTopLevel",
		"listFilesRecursive",
		"searchFiles",
		"codebaseSearch",
		"runSlashCommand",
	].includes(tool.tool)
}

function isMcpToolAlwaysAllowed(mcpServerUse: McpServerUse, mcpServers: McpServer[] | undefined): boolean {
	if (mcpServerUse.type === "use_mcp_tool" && mcpServerUse.toolName) {
		const server = mcpServers?.find((s: McpServer) => s.name === mcpServerUse.serverName)

		const tool = server?.tools?.find((t: McpTool) => t.name === mcpServerUse.toolName)
		return tool?.alwaysAllow || false
	}

	return false
}

// ─── checkAutoApproval (from autoApproval.ts) ─────────────────────────

export async function checkAutoApproval({
	state,
	ask,
	text,
	isProtected,
}: {
	state?: Pick<ExtensionState, AutoApprovalState | AutoApprovalStateOptions>
	ask: NotificationAsk
	text?: string
	isProtected?: boolean
}): Promise<CheckAutoApprovalResult> {
	if (isNonBlockingAsk(ask)) {
		return { decision: "approve" }
	}

	if (!state || !state.autoApprovalEnabled) {
		return { decision: "ask" }
	}

	if (ask === "followup") {
		if (state.alwaysAllowFollowupQuestions === true) {
			try {
				const suggestion = (JSON.parse(text || "{}") as FollowUpData).suggest?.[0]

				if (
					suggestion &&
					typeof state.followupAutoApproveTimeoutMs === "number" &&
					state.followupAutoApproveTimeoutMs > 0
				) {
					return {
						decision: "timeout",
						timeout: state.followupAutoApproveTimeoutMs,
						fn: () => ({ askResponse: "messageResponse", text: suggestion.answer }),
					}
				} else {
					return { decision: "ask" }
				}
			} catch (error) {
				return { decision: "ask" }
			}
		} else {
			return { decision: "ask" }
		}
	}

	if (ask === "interactive_app") {
		return { decision: "ask" }
	}

	if (ask === "use_mcp_server") {
		if (!text) {
			return { decision: "ask" }
		}

		try {
			const mcpServerUse = JSON.parse(text) as McpServerUse

			if (mcpServerUse.type === "use_mcp_tool") {
				return state.alwaysAllowMcp === true && isMcpToolAlwaysAllowed(mcpServerUse, state.mcpServers)
					? { decision: "approve" }
					: { decision: "ask" }
			} else if (mcpServerUse.type === "access_mcp_resource") {
				return state.alwaysAllowMcp === true ? { decision: "approve" } : { decision: "ask" }
			}
		} catch (error) {
			return { decision: "ask" }
		}

		return { decision: "ask" }
	}

	if (ask === "command") {
		if (!text) {
			return { decision: "ask" }
		}

		if (state.alwaysAllowExecute === true) {
			const decision = getCommandDecision(text, state.allowedCommands || [], state.deniedCommands || [])

			if (decision === "auto_approve") {
				return { decision: "approve" }
			} else if (decision === "auto_deny") {
				return { decision: "deny" }
			} else {
				return { decision: "ask" }
			}
		}
	}

	if (ask === "tool") {
		let tool: SayToolData | undefined

		try {
			tool = JSON.parse(text || "{}")
		} catch (error) {
			console.error("[jabberwock] Failed to parse tool:", error)
		}

		if (!tool) {
			return { decision: "ask" }
		}

		if (tool.tool === "updateTodoList") {
			return { decision: "approve" }
		}

		if (tool.tool === "skill") {
			return { decision: "approve" }
		}

		if (tool?.tool === "switchMode") {
			return state.alwaysAllowModeSwitch === true ? { decision: "approve" } : { decision: "ask" }
		}

		if (["newTask", "finishTask"].includes(tool?.tool)) {
			return state.alwaysAllowSubtasks === true ? { decision: "approve" } : { decision: "ask" }
		}

		const isOutsideWorkspace = !!tool.isOutsideWorkspace

		if (isReadOnlyToolAction(tool)) {
			return state.alwaysAllowReadOnly === true &&
				(!isOutsideWorkspace || state.alwaysAllowReadOnlyOutsideWorkspace === true)
				? { decision: "approve" }
				: { decision: "ask" }
		}

		if (isWriteToolAction(tool)) {
			return state.alwaysAllowWrite === true &&
				(!isOutsideWorkspace || state.alwaysAllowWriteOutsideWorkspace === true) &&
				(!isProtected || state.alwaysAllowWriteProtected === true)
				? { decision: "approve" }
				: { decision: "ask" }
		}
	}

	return { decision: "ask" }
}

// ─── AutoApprovalHandler Model (MST) ─────────────────────────

/**
 * Tracks consecutive auto-approved requests and cost limits per-task.
 * Used via task.autoApprovalHandler in the task store.
 *
 * Replaces the class-based AutoApprovalHandler with a proper MST model,
 * eliminating class mutable state (Criterion #15).
 */
export const AutoApprovalHandlerModel = types
	.model("AutoApprovalHandler", {
		lastResetMessageIndex: types.optional(types.number, 0),
		consecutiveAutoApprovedRequestsCount: types.optional(types.number, 0),
		consecutiveAutoApprovedCost: types.optional(types.number, 0),
	})
	.actions((self) => ({
		/**
		 * Check if auto-approval limits have been reached and handle user approval if needed.
		 * Inlines request-limit and cost-limit checks as local helpers.
		 */
		async checkAutoApprovalLimits(
			state: GlobalState | undefined,
			messages: Notification[],
			askForApproval: (
				type: NotificationAsk,
				data: string,
			) => Promise<{ response: AskResponseValue; text?: string; images?: string[] }>,
		): Promise<AutoApprovalResult> {
			// ── Check request limit ──
			const maxRequests = state?.allowedMaxRequests || Infinity
			const messagesAfterReset = messages.slice(self.lastResetMessageIndex)
			self.consecutiveAutoApprovedRequestsCount =
				messagesAfterReset.filter((msg) => msg.type === "say" && msg.say === "api_req_started").length + 1

			if (self.consecutiveAutoApprovedRequestsCount > maxRequests) {
				const { response } = await askForApproval(
					"auto_approval_max_req_reached",
					JSON.stringify({ count: maxRequests, type: "requests" }),
				)

				if (response === "yesButtonClicked") {
					self.lastResetMessageIndex = messages.length
					return {
						shouldProceed: true,
						requiresApproval: true,
						approvalType: "requests",
						approvalCount: maxRequests,
					}
				}

				return {
					shouldProceed: false,
					requiresApproval: true,
					approvalType: "requests",
					approvalCount: maxRequests,
				}
			}

			// ── Check cost limit ──
			const maxCost = state?.allowedMaxCost || Infinity
			const messagesAfterResetForCost = messages.slice(self.lastResetMessageIndex)
			self.consecutiveAutoApprovedCost = getApiMetrics(messagesAfterResetForCost).totalCost

			const EPSILON = 0.0001
			if (self.consecutiveAutoApprovedCost > maxCost + EPSILON) {
				const { response } = await askForApproval(
					"auto_approval_max_req_reached",
					JSON.stringify({ count: maxCost.toFixed(2), type: "cost" }),
				)

				if (response === "yesButtonClicked") {
					self.lastResetMessageIndex = messages.length
					return {
						shouldProceed: true,
						requiresApproval: true,
						approvalType: "cost",
						approvalCount: maxCost.toFixed(2),
					}
				}

				return {
					shouldProceed: false,
					requiresApproval: true,
					approvalType: "cost",
					approvalCount: maxCost.toFixed(2),
				}
			}

			return { shouldProceed: true, requiresApproval: false }
		},

		/**
		 * Reset the tracking (typically called when starting a new task)
		 */
		resetRequestCount(): void {
			self.lastResetMessageIndex = 0
			self.consecutiveAutoApprovedRequestsCount = 0
			self.consecutiveAutoApprovedCost = 0
		},

		/**
		 * Get current approval state for debugging/testing
		 */
		getApprovalState(): { requestCount: number; currentCost: number } {
			return {
				requestCount: self.consecutiveAutoApprovedRequestsCount,
				currentCost: self.consecutiveAutoApprovedCost,
			}
		},
	}))

export type IAutoApprovalHandler = Instance<typeof AutoApprovalHandlerModel>
