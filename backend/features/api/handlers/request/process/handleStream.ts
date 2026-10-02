import { RawChunkTracker } from "./rawChunkProcessor.ts"
import { type ApiRequestContext } from "@features/api"
import { executeApiStream } from "@features/api/handlers/stream/streamExecutor"

/**
 * Handles the streaming API request for a prepared context.
 */
export async function handleStream(ctx: ApiRequestContext): Promise<import("@features/api").StreamResult | null> {
	const rawChunkTracker = RawChunkTracker()
	return await executeApiStream(ctx, rawChunkTracker)
}
