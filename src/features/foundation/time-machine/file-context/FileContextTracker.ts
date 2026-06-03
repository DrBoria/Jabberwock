import * as path from "path"
import * as vscode from "vscode"
import type { RecordSource } from "./FileContextTrackerTypes"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { getBackendRootStore } from "@features/storeSingleton"

/**
 * FileContextTracker — VSCode integration layer for file context tracking.
 *
 * Responsibilities:
 * 1. Set up VSCode FileSystemWatchers to detect user edits to tracked files
 * 2. Maintain runtime dedup Sets (recentlyModifiedFiles, recentlyEditedByRoo,
 *    checkpointPossibleFiles) for watcher logic
 * 3. Persist file tracking data to the MST FileContextTrackerStoreModel
 *    (the reactive source of truth)
 *
 * JSON persistence has been removed — the MST store handles it reactively.
 */
export class FileContextTracker {
	readonly taskId: string
	private providerRef: WeakRef<ProviderHandle>

	// File tracking and watching
	private fileWatchers = new Map<string, vscode.FileSystemWatcher>()
	private recentlyModifiedFiles = new Set<string>()
	private recentlyEditedByRoo = new Set<string>()
	private checkpointPossibleFiles = new Set<string>()

	constructor(provider: ProviderHandle, taskId: string) {
		this.providerRef = new WeakRef(provider)
		this.taskId = taskId
	}

	// Gets the current working directory or returns undefined if it cannot be determined
	private getCwd(): string | undefined {
		const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
		if (!cwd) {
			console.info("No workspace folder available - cannot determine current working directory")
		}
		return cwd
	}

	// File watchers are set up for each file that is tracked in the task metadata.
	async setupFileWatcher(filePath: string) {
		// Only setup watcher if it doesn't already exist for this file
		if (this.fileWatchers.has(filePath)) {
			return
		}

		const cwd = this.getCwd()
		if (!cwd) {
			return
		}

		// Create a file system watcher for this specific file
		const fileUri = vscode.Uri.file(path.resolve(cwd, filePath))
		const watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(path.dirname(fileUri.fsPath), path.basename(fileUri.fsPath)),
		)

		// Track file changes
		watcher.onDidChange(() => {
			if (this.recentlyEditedByRoo.has(filePath)) {
				this.recentlyEditedByRoo.delete(filePath) // This was an edit by Jabberwock, no need to inform Jabberwock
			} else {
				this.recentlyModifiedFiles.add(filePath) // This was a user edit, we will inform Jabberwock
				this.trackFileContext(filePath, "user_edited") // Update the task metadata with file tracking
			}
		})

		// Store the watcher so we can dispose it later
		this.fileWatchers.set(filePath, watcher)
	}

	// Tracks a file operation in metadata and sets up a watcher for the file
	// This is the main entry point for FileContextTracker and is called when a file is passed to Jabberwock via a tool, mention, or edit.
	async trackFileContext(filePath: string, operation: RecordSource) {
		try {
			const cwd = this.getCwd()
			if (!cwd) {
				return
			}

			// Track via the MST store for reactive state management
			try {
				const store = getBackendRootStore()
				store.fileContextTracker.trackFile(this.taskId, filePath, operation)
			} catch {
				// Store may not be initialized yet (e.g., during early task startup)
			}

			// Set up file watcher for this file
			await this.setupFileWatcher(filePath)

			// Update runtime dedup sets
			if (operation === "roo_edited") {
				this.checkpointPossibleFiles.add(filePath)
				this.markFileAsEditedByRoo(filePath)
			}
			if (operation === "user_edited") {
				this.recentlyModifiedFiles.add(filePath)
				this.checkpointPossibleFiles.add(filePath)
			}
		} catch (error) {
			console.error("[jabberwock] Failed to track file operation:", error)
		}
	}

	// Returns (and then clears) the set of recently modified files
	getAndClearRecentlyModifiedFiles(): string[] {
		const files = Array.from(this.recentlyModifiedFiles)
		this.recentlyModifiedFiles.clear()
		return files
	}

	/**
	 * Gets a list of unique file paths that Jabberwock has read during this task.
	 * Files are sorted by most recently read first, so if there's a character
	 * budget during folded context generation, the most relevant (recent) files
	 * are prioritized.
	 *
	 * Delegates to the MST store for reactive data (no JSON I/O needed).
	 *
	 * @param sinceTimestamp - Optional timestamp to filter files read after this time
	 * @returns Array of unique file paths that have been read, most recent first
	 */
	getFilesReadByJabberwock(sinceTimestamp?: number): string[] {
		try {
			const store = getBackendRootStore()
			return store.fileContextTracker.getFilesReadByJabberwock(this.taskId, sinceTimestamp)
		} catch {
			console.error("[jabberwock] Failed to get files read by Jabberwock")
			return []
		}
	}

	getAndClearCheckpointPossibleFile(): string[] {
		const files = Array.from(this.checkpointPossibleFiles)
		this.checkpointPossibleFiles.clear()
		return files
	}

	// Marks a file as edited by Jabberwock to prevent false positives in file watchers
	markFileAsEditedByRoo(filePath: string): void {
		this.recentlyEditedByRoo.add(filePath)
	}

	// Disposes all file watchers
	dispose(): void {
		for (const watcher of this.fileWatchers.values()) {
			watcher.dispose()
		}
		this.fileWatchers.clear()
	}
}
