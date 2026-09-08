import { EventEmitter } from "@features/foundation/events/event-emitter"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error" | "Stopping"

export class CodeIndexStateManager {
	private _systemStatus: IndexingState = "Standby"
	private _statusMessage: string = ""
	private _processedItems: number = 0
	private _totalItems: number = 0
	private _currentItemUnit: string = "blocks"
	// D4g-2 (batch 3): host-neutral event emitter (replaces vscode.EventEmitter) so the code-index
	// state manager stays free of host imports.
	private _progressEmitter = new EventEmitter<ReturnType<typeof this.getCurrentStatus>>()

	// --- Public API ---

	public readonly onProgressUpdate = this._progressEmitter.event

	public get state(): IndexingState {
		return this._systemStatus
	}

	public getCurrentStatus() {
		return {
			systemStatus: this._systemStatus,
			message: this._statusMessage,
			processedItems: this._processedItems,
			totalItems: this._totalItems,
			currentItemUnit: this._currentItemUnit,
		}
	}

	// --- State Management ---

	public setSystemState(newState: IndexingState, message?: string): void {
		if (!this._isStateChanged(newState, message)) {
			return
		}

		this._systemStatus = newState
		if (message !== undefined) {
			this._statusMessage = message
		}

		if (newState !== "Indexing") {
			this._processedItems = 0
			this._totalItems = 0
			this._currentItemUnit = "blocks"
			this._setDefaultMessageForState(newState, message)
		}

		this._progressEmitter.fire(this.getCurrentStatus())
	}

	private _isStateChanged(newState: IndexingState, message: string | undefined): boolean {
		return newState !== this._systemStatus || (message !== undefined && message !== this._statusMessage)
	}

	private _setDefaultMessageForState(newState: IndexingState, message: string | undefined): void {
		if (newState === "Standby" && message === undefined) this._statusMessage = "Ready."
		if (newState === "Indexed" && message === undefined) this._statusMessage = "Index up-to-date."
		if (newState === "Error" && message === undefined) this._statusMessage = "An error occurred."
	}

	public reportBlockIndexingProgress(processedItems: number, totalItems: number): void {
		const progressChanged = processedItems !== this._processedItems || totalItems !== this._totalItems

		// Don't override Stopping state with progress updates
		if (this._systemStatus === "Stopping") return
		// Update if progress changes OR if the system wasn't already in 'Indexing' state
		if (progressChanged || this._systemStatus !== "Indexing") {
			this._processedItems = processedItems
			this._totalItems = totalItems
			this._currentItemUnit = "blocks"

			const message = `Indexed ${this._processedItems} / ${this._totalItems} ${this._currentItemUnit} found`
			const oldStatus = this._systemStatus
			const oldMessage = this._statusMessage

			this._systemStatus = "Indexing" // Ensure state is Indexing
			this._statusMessage = message

			// Only fire update if status, message or progress actually changed
			if (oldStatus !== this._systemStatus || oldMessage !== this._statusMessage || progressChanged) {
				this._progressEmitter.fire(this.getCurrentStatus())
			}
		}
	}

	public reportFileQueueProgress(processedFiles: number, totalFiles: number, currentFileBasename?: string): void {
		const progressChanged = processedFiles !== this._processedItems || totalFiles !== this._totalItems

		if (this._systemStatus === "Stopping") return
		if (progressChanged || this._systemStatus !== "Indexing") {
			this._processedItems = processedFiles
			this._totalItems = totalFiles
			this._currentItemUnit = "files"
			this._systemStatus = "Indexing"

			const oldMessage = this._statusMessage
			this._statusMessage = this._buildFileQueueMessage(processedFiles, totalFiles, currentFileBasename)

			if (this._shouldEmitProgressUpdate(oldMessage, progressChanged)) {
				this._progressEmitter.fire(this.getCurrentStatus())
			}
		}
	}

	private _buildFileQueueMessage(processedFiles: number, totalFiles: number, currentFileBasename?: string): string {
		if (totalFiles > 0 && processedFiles < totalFiles) {
			return `Processing ${processedFiles} / ${totalFiles} files. Current: ${currentFileBasename || "..."}`
		}
		if (totalFiles > 0 && processedFiles === totalFiles) {
			return `Finished processing ${totalFiles} files from queue.`
		}
		return "File queue processed."
	}

	private _shouldEmitProgressUpdate(oldMessage: string, progressChanged: boolean): boolean {
		return oldMessage !== this._statusMessage || progressChanged
	}

	public dispose(): void {
		this._progressEmitter.dispose()
	}
}
