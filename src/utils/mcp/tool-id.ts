/**
 * OpenAI Responses API maximum length for call_id field.
 * This limit applies to both function_call and function_call_output items.
 */
export const OPENAI_CALL_ID_MAX_LENGTH = 64

/**
 * Sanitize a tool_use ID for use as an OpenAI call_id.
 *
 * Replaces any character that is not alphanumeric, underscore, or hyphen with underscore,
 * and truncates to OPENAI_CALL_ID_MAX_LENGTH.
 *
 * @param id - The tool_use ID to sanitize
 * @returns The sanitized ID safe for use as an OpenAI call_id
 */
export function sanitizeOpenAiCallId(id: string): string {
	const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, OPENAI_CALL_ID_MAX_LENGTH)
	return sanitized
}

/**
 * Sanitize a tool_use ID for use in Jabberwock's internal tool tracking.
 *
 * Replaces any character that is not alphanumeric, underscore, or hyphen with underscore.
 *
 * @param id - The tool_use ID to sanitize
 * @returns The sanitized ID
 */
export function sanitizeToolUseId(id: string): string {
	const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, "_")
	return sanitized
}
