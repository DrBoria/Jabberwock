import { isNonBlockingAsk } from "@jabberwock/types"
import { getCommandDecision } from "./store.commands"
import type {
	AutoApprovalDeps,
	AutoApprovalState,
	AutoApprovalStateOptions,
	CheckAutoApprovalResult,
	ToolHandler,
	McpServer,
	McpServerUse,
	McpTool,
	SayToolData,
} from "./store.types"
import type { NotificationAsk, ExtensionState } from "@jabberwock/types"

const FOLLOWUP_APPROVED = { decision: "approve" as const }
const ASK_DECISION = { decision: "ask" as const }

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

function handleFollowupAsk(deps: AutoApprovalDeps): Promise<CheckAutoApprovalResult> | CheckAutoApprovalResult {
	const { state, text } = deps
	if (state?.alwaysAllowFollowupQuestions !== true) {
		return ASK_DECISION
	}
	try {
		const suggestion = (JSON.parse(text || "{}") as { suggest?: { answer: string }[] }).suggest?.[0]
		if (
			suggestion &&
			typeof state.followupAutoApproveTimeoutMs === "number" &&
			state.followupAutoApproveTimeoutMs > 0
		) {
			return {
				decision: "timeout",
				timeout: state.followupAutoApproveTimeoutMs,
				fn: () => ({ askResponse: "messageResponse" as const, text: suggestion.answer }),
			}
		}
	} catch {
		// fall through to ask
	}
	return ASK_DECISION
}

function isMcpServerUseApproved(mcpServerUse: McpServerUse, state: AutoApprovalDeps["state"]): boolean {
	return state?.alwaysAllowMcp === true && isMcpToolAlwaysAllowed(mcpServerUse, state?.mcpServers)
}

function handleMcpServerAsk(deps: AutoApprovalDeps): CheckAutoApprovalResult {
	const { state, text } = deps
	if (!text) {
		return ASK_DECISION
	}
	let mcpServerUse: McpServerUse
	try {
		mcpServerUse = JSON.parse(text)
	} catch {
		return ASK_DECISION
	}
	if (mcpServerUse.type === "access_mcp_resource") {
		if (state?.alwaysAllowMcp === true) {
			return FOLLOWUP_APPROVED
		}
		return ASK_DECISION
	}
	if (mcpServerUse.type === "use_mcp_tool") {
		if (isMcpServerUseApproved(mcpServerUse, state)) {
			return FOLLOWUP_APPROVED
		}
		return ASK_DECISION
	}
	return ASK_DECISION
}

function handleCommandAsk(deps: AutoApprovalDeps): CheckAutoApprovalResult {
	const { state, text } = deps
	if (!text || state?.alwaysAllowExecute !== true) {
		return ASK_DECISION
	}
	const commandDecision = getCommandDecision(text, state.allowedCommands || [], state.deniedCommands || [])
	if (commandDecision === "auto_approve") {
		return FOLLOWUP_APPROVED
	}
	if (commandDecision === "auto_deny") {
		return { decision: "deny" as const }
	}
	return ASK_DECISION
}

const TOOL_HANDLERS: Record<string, ToolHandler> = {
	updateTodoList: () => FOLLOWUP_APPROVED,
	skill: () => FOLLOWUP_APPROVED,
	switchMode: (state) => (state?.alwaysAllowModeSwitch === true ? FOLLOWUP_APPROVED : ASK_DECISION),
	newTask: (state) => (state?.alwaysAllowSubtasks === true ? FOLLOWUP_APPROVED : ASK_DECISION),
	finishTask: (state) => (state?.alwaysAllowSubtasks === true ? FOLLOWUP_APPROVED : ASK_DECISION),
}

function parseToolData(text: string | undefined): SayToolData | undefined {
	try {
		return JSON.parse(text || "{}")
	} catch {
		return undefined
	}
}

function isReadOnlyApproved(state: AutoApprovalDeps["state"], tool: SayToolData): boolean {
	const outsideOk = state?.alwaysAllowReadOnlyOutsideWorkspace === true
	return state?.alwaysAllowReadOnly === true && (!tool.isOutsideWorkspace || outsideOk)
}

function isWriteApproved(
	state: AutoApprovalDeps["state"],
	tool: SayToolData,
	isProtected: boolean | undefined,
): boolean {
	const outsideOk = state?.alwaysAllowWriteOutsideWorkspace === true
	const protectedOk = state?.alwaysAllowWriteProtected === true
	return state?.alwaysAllowWrite === true && (!tool.isOutsideWorkspace || outsideOk) && (!isProtected || protectedOk)
}

function handleToolAsk(deps: AutoApprovalDeps): CheckAutoApprovalResult {
	const { state, isProtected } = deps
	const tool = parseToolData(deps.text)
	if (!tool) {
		return ASK_DECISION
	}
	const handler = TOOL_HANDLERS[tool.tool]
	if (handler) {
		return handler(state, isProtected)
	}
	if (isReadOnlyToolAction(tool)) {
		if (isReadOnlyApproved(state, tool)) {
			return FOLLOWUP_APPROVED
		}
		return ASK_DECISION
	}
	if (isWriteToolAction(tool)) {
		if (isWriteApproved(state, tool, isProtected)) {
			return FOLLOWUP_APPROVED
		}
		return ASK_DECISION
	}
	return ASK_DECISION
}

const ASK_HANDLERS: Record<
	string,
	(deps: AutoApprovalDeps) => CheckAutoApprovalResult | Promise<CheckAutoApprovalResult>
> = {
	followup: handleFollowupAsk,
	interactive_app: () => ASK_DECISION,
	use_mcp_server: handleMcpServerAsk,
	command: handleCommandAsk,
	tool: handleToolAsk,
}

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
		return FOLLOWUP_APPROVED
	}
	if (!state || !state.autoApprovalEnabled) {
		return ASK_DECISION
	}
	const handler = ASK_HANDLERS[ask]
	if (handler) {
		return handler({ state, text, isProtected })
	}
	return ASK_DECISION
}
