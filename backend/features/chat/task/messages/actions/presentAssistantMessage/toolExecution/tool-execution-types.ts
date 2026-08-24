import type { AskApproval, HandleError, PushToolResult } from "@shared/tools"

export interface ToolExecutionCallbacks {
	askApproval: AskApproval
	handleError: HandleError
	pushToolResult: PushToolResult
}
