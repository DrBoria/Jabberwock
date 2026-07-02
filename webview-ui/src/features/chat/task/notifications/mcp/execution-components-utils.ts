import type { McpExecutionStatus } from "@jabberwock/types"

export const getStatusLabel = (status: McpExecutionStatus, t: (key: string) => string): string =>
	status.status === "started"
		? t("execution.running")
		: status.status === "completed"
			? t("execution.completed")
			: t("execution.error")

export const parseArgumentsText = (text: string): { isJson: boolean; formatted: string } => {
	if (!text) return { isJson: false, formatted: "" }
	const trimmed = text.trim()
	if (
		trimmed &&
		((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))
	) {
		try {
			const parsed = JSON.parse(trimmed)
			return { isJson: true, formatted: JSON.stringify(parsed, null, 2) }
		} catch {
			return { isJson: false, formatted: text }
		}
	}
	return { isJson: false, formatted: text }
}

export const buildToolProps = (
	name: string | undefined,
	description: string | undefined,
	alwaysAllow: boolean | undefined,
): { name: string; description: string; alwaysAllow: boolean } => ({
	name: name || "",
	description: description || "",
	alwaysAllow: alwaysAllow || false,
})
