/**
 * Typed constants for each ClineAsk case.
 * These replace hardcoded string literals in button click handlers.
 */
export const ASK_TYPE_API_REQ_FAILED = "api_req_failed" as const
export const ASK_TYPE_COMMAND = "command" as const
export const ASK_TYPE_TOOL = "tool" as const
export const ASK_TYPE_USE_MCP_SERVER = "use_mcp_server" as const
export const ASK_TYPE_MISTAKE_LIMIT_REACHED = "mistake_limit_reached" as const
export const ASK_TYPE_RESUME_TASK = "resume_task" as const
export const ASK_TYPE_RESUME_COMPLETED_TASK = "resume_completed_task" as const
export const ASK_TYPE_FOLLOWUP = "followup" as const
export const ASK_TYPE_COMMAND_OUTPUT = "command_output" as const
export const ASK_TYPE_INTERACTIVE_APP = "interactive_app" as const
export const ASK_TYPE_COMPLETION_RESULT = "completion_result" as const
export const ASK_TYPE_AUTO_APPROVAL_MAX_REQ_REACHED = "auto_approval_max_req_reached" as const
