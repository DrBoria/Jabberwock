import { RawChunkTracker } from "./rawChunkProcessor"
import { type ApiRequestContext } from "@features/api/handlers/helpers/prepare/prepareApiRequest"
import { executeApiStream } from "@features/api/handlers/stream/streamExecutor"

/**
 * Handles the streaming API request for a prepared context.
 */
export async function handleStream(
	ctx: ApiRequestContext,
): Promise<import("@features/api/handlers/stream/types").StreamResult | null> {
	const rawChunkTracker = new RawChunkTracker()
	return await executeApiStream(ctx, rawChunkTracker)
}
