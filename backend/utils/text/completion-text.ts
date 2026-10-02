/**
 * Local/weak models sometimes wrap the `attempt_completion` result in a JSON
 * envelope (e.g. `{"result":"PONG-42"}`) or a markdown code fence instead of
 * returning plain text. That envelope would then be rendered verbatim under
 * the "Task Completed" header. This helper unwraps such cases so the user
 * sees the clean result text.
 */
const JSON_RESULT_KEYS = ["result", "answer", "response", "output", "text", "message"] as const

function tryUnwrapJson(text: string): string | null {
	try {
		const parsed: unknown = JSON.parse(text)
		if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
			for (const key of JSON_RESULT_KEYS) {
				const value = (parsed as Record<string, unknown>)[key]
				if (typeof value === "string" && value.trim().length > 0) {
					return value
				}
			}
		}
	} catch {
		// not JSON — fall through
	}
	return null
}

/**
 * Returns the human-readable completion text: unwraps a JSON envelope or a
 * markdown code fence if the model wrapped its result in one.
 */
export function normalizeCompletionText(raw: string): string {
	const text = (raw ?? "").trim()
	if (text.length === 0) {
		return text
	}

	const fenced = text.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```\s*$/)
	if (fenced && fenced[1]) {
		return normalizeCompletionText(fenced[1])
	}

	const unwrapped = tryUnwrapJson(text)
	return unwrapped ?? text
}
