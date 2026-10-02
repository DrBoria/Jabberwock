import { z } from "zod"

import * as path from "path"
import type { IFileWatcher } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import { getBackendCapabilities, getFileWatchers } from "@features/foundation/capabilities"

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
export function FileContextTracker(taskId: string) {
	// File tracking and watching
	const fileWatchers = new Map<string, IFileWatcher>()
	const recentlyModifiedFiles = new Set<string>()
	const recentlyEditedByRoo = new Set<string>()
	const checkpointPossibleFiles = new Set<string>()

	// Gets the current working directory or returns undefined if it cannot be determined
	function getCwd(): string | undefined {
		// D4g-2 (batch 4): workspace folders via the hostContext capability slot (D4e) — the shared
		// backend never imports the host directly.
		const cwd = getBackendCapabilities().hostContext.workspaceFolders?.at(0)
		if (!cwd) {
			console.info("No workspace folder available - cannot determine current working directory")
		}
		return cwd
	}

	// File watchers are set up for each file that is tracked in the task metadata.
	async function setupFileWatcher(filePath: string) {
		// Only setup watcher if it doesn't already exist for this file
		if (fileWatchers.has(filePath)) {
			return
		}

		const cwd = getCwd()
		if (!cwd) {
			return
		}

		// D4g-2 (batch 4): file watching via the host-neutral file-watcher factory (D4e) — the vscode
		// connector adapts the host watcher API (RelativePattern) into the plain IFileWatcher callbacks.
		// Server mode provides a chokidar factory; absent in pre-D4e fixtures (no file watching).
		const factory = getFileWatchers()
		if (!factory) {
			return
		}

		// Create a file system watcher for this specific file (absolute path → exact-file match)
		const watcher = await factory.watch([path.resolve(cwd, filePath)])

		// Track file changes
		watcher.onChange?.(() => {
			if (recentlyEditedByRoo.has(filePath)) {
				recentlyEditedByRoo.delete(filePath) // This was an edit by Jabberwock, no need to inform Jabberwock
			} else {
				recentlyModifiedFiles.add(filePath) // This was a user edit, we will inform Jabberwock
				trackFileContext(filePath, "user_edited") // Update the task metadata with file tracking
			}
		})

		// Store the watcher so we can dispose it later
		fileWatchers.set(filePath, watcher)
	}

	// Tracks a file operation in metadata and sets up a watcher for the file
	// This is the main entry point for FileContextTracker and is called when a file is passed to Jabberwock via a tool, mention, or edit.
	async function trackFileContext(filePath: string, operation: RecordSource) {
		try {
			const cwd = getCwd()
			if (!cwd) {
				return
			}

			// Track via the MST store for reactive state management
			try {
				const store = getStore()
				store.fileContextTracker.trackFile(taskId, filePath, operation)
			} catch {
				// Store may not be initialized yet (e.g., during early task startup)
			}

			// Set up file watcher for this file
			await setupFileWatcher(filePath)

			// Update runtime dedup sets
			if (operation === "roo_edited") {
				checkpointPossibleFiles.add(filePath)
				markFileAsEditedByRoo(filePath)
			}
			if (operation === "user_edited") {
				recentlyModifiedFiles.add(filePath)
				checkpointPossibleFiles.add(filePath)
			}
		} catch (error) {
			console.error("[jabberwock] Failed to track file operation:", error)
		}
	}

	// Returns (and then clears) the set of recently modified files
	function getAndClearRecentlyModifiedFiles(): string[] {
		const files = Array.from(recentlyModifiedFiles)
		recentlyModifiedFiles.clear()
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
	function getFilesReadByJabberwock(sinceTimestamp?: number): string[] {
		try {
			const store = getStore()
			return store.fileContextTracker.getFilesReadByJabberwock(taskId, sinceTimestamp)
		} catch {
			console.error("[jabberwock] Failed to get files read by Jabberwock")
			return []
		}
	}

	function getAndClearCheckpointPossibleFile(): string[] {
		const files = Array.from(checkpointPossibleFiles)
		checkpointPossibleFiles.clear()
		return files
	}

	// Marks a file as edited by Jabberwock to prevent false positives in file watchers
	function markFileAsEditedByRoo(filePath: string): void {
		recentlyEditedByRoo.add(filePath)
	}

	// Disposes all file watchers
	function dispose(): void {
		for (const watcher of fileWatchers.values()) {
			watcher.dispose()
		}
		fileWatchers.clear()
	}

	return {
		taskId,
		setupFileWatcher,
		trackFileContext,
		getAndClearRecentlyModifiedFiles,
		getFilesReadByJabberwock,
		getAndClearCheckpointPossibleFile,
		markFileAsEditedByRoo,
		dispose,
	}
}

/** FileContextTracker instance type */
export type FileContextTracker = ReturnType<typeof FileContextTracker>

// Zod schema for RecordSource
export const recordSourceSchema = z.enum(["read_tool", "user_edited", "roo_edited", "file_mentioned"])

// TypeScript type derived from "the" Zod schema
export type RecordSource = z.infer<typeof recordSourceSchema>

// Zod schema for FileMetadataEntry
export const fileMetadataEntrySchema = z.object({
	path: z.string(),
	record_state: z.enum(["active", "stale"]),
	record_source: recordSourceSchema,
	jabberwock_read_date: z.number().nullable(),
	jabberwock_edit_date: z.number().nullable(),
	user_edit_date: z.number().nullable().optional(),
})

// TypeScript type derived from "the" Zod schema
export type FileMetadataEntry = z.infer<typeof fileMetadataEntrySchema>

// Zod schema for TaskMetadata
export const taskMetadataSchema = z.object({
	files_in_context: z.array(fileMetadataEntrySchema),
})

// TypeScript type derived from "the" Zod schema
export type TaskMetadata = z.infer<typeof taskMetadataSchema>
