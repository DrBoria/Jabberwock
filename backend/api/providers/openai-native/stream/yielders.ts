import type { ApiStream } from "@api/transform/stream"

/**
 * Yield `reasoning` chunks from an output item that carries a `summary` array
 * (e.g. `{ type: "reasoning", summary: [{ type: "summary_text", text }] }`).
 * Shared by both the message-item path (noncore) and the output-item path
 * (fallback) — the reasoning shape is identical in both, so there is a single
 * implementation here rather than a copy in each file.
 *
 * @param outputItem - The raw output item from the provider stream.
 * @returns Whether at least one reasoning chunk was yielded.
 */
export async function* yieldReasoningFromOutputItem(outputItem: Record<string, unknown>): ApiStream {
	if (outputItem.type !== "reasoning") return false
	if (!Array.isArray(outputItem.summary)) return false
	let didYield = false
	const summaryArray = outputItem.summary as Record<string, unknown>[]
	for (const summary of summaryArray) {
		if (summary?.type === "summary_text" && typeof summary.text === "string") {
			didYield = true
			yield { type: "reasoning", text: summary.text }
		}
	}
	return didYield
}
