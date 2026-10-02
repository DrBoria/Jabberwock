import { Anthropic } from "@anthropic-ai/sdk"
import workerpool from "workerpool"

import { countTokensResultSchema } from "@workers/types"
import { tiktoken } from "./tiktoken"

const __moduleState = {
	pool: undefined as workerpool.Pool | null | undefined,
}

export type CountTokensOptions = {
	useWorker?: boolean
}

export async function countTokens(
	content: Anthropic.Messages.ContentBlockParam[],
	{ useWorker = true }: CountTokensOptions = {},
): Promise<number> {
	// Lazily create the worker __moduleState.pool if it doesn't exist.
	if (useWorker && typeof __moduleState.pool === "undefined") {
		__moduleState.pool = workerpool.pool(__dirname + "/workers/countTokens.js", {
			maxWorkers: 1,
			maxQueueSize: 10,
		})
	}

	// If the worker __moduleState.pool doesn't exist or the caller doesn't want to use it
	// then, use the non-worker implementation.
	if (!useWorker || !__moduleState.pool) {
		return tiktoken(content)
	}

	try {
		const data = await __moduleState.pool.exec("countTokens", [content])
		const result = countTokensResultSchema.parse(data)

		if (!result.success) {
			throw new Error(result["error"])
		}

		return result["count"]
	} catch (error) {
		__moduleState.pool = null
		console.error(`[jabberwock]`, error)
		return tiktoken(content)
	}
}
