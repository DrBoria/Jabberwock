import type OpenAI from "openai"

const DELEGATE_TASK_DESCRIPTION = `Delegate a specific task from the approved TODO plan to a specialized agent.

CRITICAL: You MUST use this tool to execute any tasks assigned to specialized agents in the human-approved TODO plan.
Deterministic Routing: The system will verify that the task_id and target_role match the approved plan.
This tool triggers the creation of a child task in the specified mode.`

const TASK_ID_DESCRIPTION = `The exact ID of the task from the approved TODO plan (e.g., "task-1")`
const TARGET_ROLE_DESCRIPTION = `The specialized agent role this task is assigned to (e.g., "coder", "designer")`
const MESSAGE_DESCRIPTION = `Comprehensive instructions and context for the specialized agent to complete the task.`
const IS_ASYNC_DESCRIPTION = `If true, the task will run in the background (default: false).`

export default {
	type: "function",
	function: {
		name: "delegate_task",
		description: DELEGATE_TASK_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				task_id: {
					type: "string",
					description: TASK_ID_DESCRIPTION,
				},
				target_role: {
					type: "string",
					description: TARGET_ROLE_DESCRIPTION,
				},
				message: {
					type: "string",
					description: MESSAGE_DESCRIPTION,
				},
				is_async: {
					type: "boolean",
					description: IS_ASYNC_DESCRIPTION,
				},
			},
			required: ["task_id", "target_role", "message"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
