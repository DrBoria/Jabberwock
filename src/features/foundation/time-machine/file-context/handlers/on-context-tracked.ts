import { IntentConstants } from "@intentConstants"
import type { IntentBus } from "@features/intents/bus"
import type { RecordSource } from "@features/foundation/time-machine/file-context/FileContextTrackerTypes"

/**
 * Handles file.context.tracked intent — records a file operation in the
 * FileContextTrackerStoreModel for reactive context tracking.
 *
 * Tools and mention handlers dispatch this intent when a file is read,
 * edited, or mentioned, so the tracking data is available reactively
 * through the MST store rather than requiring JSON file reads.
 */
export function registerOnFileContextTracked(bus: IntentBus): void {
	bus.register(IntentConstants.fileContext.FILE_CONTEXT_TRACKED, async (intent, ctx) => {
		const { taskId, filePath, source } = intent.payload as {
			taskId: string
			filePath: string
			source: RecordSource
		}

		if (!taskId || !filePath || !source) {
			console.error("[onFileContextTracked] Missing required payload fields", { taskId, filePath, source })
			return
		}

		ctx.rootStore.fileContextTracker.trackFile(taskId, filePath, source)
	})
}
