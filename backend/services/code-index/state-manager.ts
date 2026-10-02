import { EventEmitter } from "@features/foundation/events"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error" | "Stopping"

type CurrentStatus = {
	systemStatus: IndexingState
	message: string
	processedItems: number
	totalItems: number
	currentItemUnit: string
}

export function CodeIndexStateManager() {
	let systemStatus: IndexingState = "Standby"
	let statusMessage: string = ""
	let processedItems: number = 0
	let totalItems: number = 0
	let currentItemUnit: string = "blocks"
	// D4g-2 (batch 3): host-neutral event emitter (replaces vscode.EventEmitter) so the code-index
	// state manager stays free of host imports.
	const progressEmitter = new EventEmitter<CurrentStatus>()

	const handler = {
		// --- Public API ---

		onProgressUpdate: progressEmitter.event,

		get state(): IndexingState {
			return systemStatus
		},

		getCurrentStatus(): CurrentStatus {
			return {
				systemStatus: systemStatus,
				message: statusMessage,
				processedItems: processedItems,
				totalItems: totalItems,
				currentItemUnit: currentItemUnit,
			}
		},

		// --- State Management ---

		setSystemState(newState: IndexingState, message?: string): void {
			if (!handler._isStateChanged(newState, message)) {
				return
			}

			systemStatus = newState
			if (message !== undefined) {
				statusMessage = message
			}

			if (newState !== "Indexing") {
				processedItems = 0
				totalItems = 0
				currentItemUnit = "blocks"
				handler._setDefaultMessageForState(newState, message)
			}

			progressEmitter.fire(handler.getCurrentStatus())
		},

		_isStateChanged(newState: IndexingState, message: string | undefined): boolean {
			return newState !== systemStatus || (message !== undefined && message !== statusMessage)
		},

		_setDefaultMessageForState(newState: IndexingState, message: string | undefined): void {
			if (newState === "Standby" && message === undefined) statusMessage = "Ready."
			if (newState === "Indexed" && message === undefined) statusMessage = "Index up-to-date."
			if (newState === "Error" && message === undefined) statusMessage = "An error occurred."
		},

		reportBlockIndexingProgress(processed: number, total: number): void {
			const progressChanged = processed !== processedItems || total !== totalItems

			// Don't override Stopping state with progress updates
			if (systemStatus === "Stopping") return
			// Update if progress changes OR if the system wasn't already in 'Indexing' state
			if (progressChanged || systemStatus !== "Indexing") {
				processedItems = processed
				totalItems = total
				currentItemUnit = "blocks"

				const message = `Indexed ${processedItems} / ${totalItems} ${currentItemUnit} found`
				const oldStatus = systemStatus
				const oldMessage = statusMessage

				systemStatus = "Indexing" // Ensure state is Indexing
				statusMessage = message

				// Only fire update if status, message or progress actually changed
				if (oldStatus !== systemStatus || oldMessage !== statusMessage || progressChanged) {
					progressEmitter.fire(handler.getCurrentStatus())
				}
			}
		},

		reportFileQueueProgress(processedFiles: number, totalFiles: number, currentFileBasename?: string): void {
			const progressChanged = processedFiles !== processedItems || totalFiles !== totalItems

			if (systemStatus === "Stopping") return
			if (progressChanged || systemStatus !== "Indexing") {
				processedItems = processedFiles
				totalItems = totalFiles
				currentItemUnit = "files"
				systemStatus = "Indexing"

				const oldMessage = statusMessage
				statusMessage = handler._buildFileQueueMessage(processedFiles, totalFiles, currentFileBasename)

				if (handler._shouldEmitProgressUpdate(oldMessage, progressChanged)) {
					progressEmitter.fire(handler.getCurrentStatus())
				}
			}
		},

		_buildFileQueueMessage(processedFiles: number, totalFiles: number, currentFileBasename?: string): string {
			if (totalFiles > 0 && processedFiles < totalFiles) {
				return `Processing ${processedFiles} / ${totalFiles} files. Current: ${currentFileBasename || "..."}`
			}
			if (totalFiles > 0 && processedFiles === totalFiles) {
				return `Finished processing ${totalFiles} files from queue.`
			}
			return "File queue processed."
		},

		_shouldEmitProgressUpdate(oldMessage: string, progressChanged: boolean): boolean {
			return oldMessage !== statusMessage || progressChanged
		},

		dispose(): void {
			progressEmitter.dispose()
		},
	}
	return handler
}
export type CodeIndexStateManager = ReturnType<typeof CodeIndexStateManager>
