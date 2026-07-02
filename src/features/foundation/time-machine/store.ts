import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import type { IBackendRootStore } from "@features/store"
import type { RecordSource } from "./file-context/FileContextTrackerTypes"

// ─── FilesModel ───────────────────────────────────────────────────────

export const FilesModel = types.model("Files", {})

export type IFilesModel = Instance<typeof FilesModel>

// Backward-compatible types and functions
export type FilesState = object

export function initFilesState(_provider: EventBridge): void {}

export function getFilesState(rootStore: IBackendRootStore): FilesState {
	return rootStore.settings.files as FilesState
}

// ─── CheckpointModel (per task) ─────────────────────────────────────────

export const CheckpointModel = types.model("Checkpoint", {
	taskId: types.string,
	enableCheckpoints: types.boolean,
	checkpointTimeout: types.integer,
	checkpointServiceInitializing: types.boolean,
	hasCheckpoint: types.boolean,
})

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface ICheckpointModel extends ReturnType<typeof CheckpointModel.create> {}

// ─── CheckpointStoreModel (manages checkpoint state per task) ──────────

export const CheckpointStoreModel = types
	.model("CheckpointStore", {
		entries: types.map(CheckpointModel),
	})
	.views((self) => ({
		getForTask(taskId: string): ICheckpointModel | undefined {
			return self.entries.get(taskId)
		},
		hasForTask(taskId: string): boolean {
			return self.entries.has(taskId)
		},
	}))
	.actions((self) => ({
		getOrCreate(taskId: string): ICheckpointModel {
			if (!self.entries.has(taskId)) {
				self.entries.put(
					CheckpointModel.create({
						taskId,
						enableCheckpoints: true,
						checkpointTimeout: 0,
						checkpointServiceInitializing: false,
						hasCheckpoint: false,
					}),
				)
			}
			return self.entries.get(taskId)!
		},
		removeForTask(taskId: string): void {
			self.entries.delete(taskId)
		},
		setEnableCheckpoints(taskId: string, value: boolean) {
			const entry = self.entries.get(taskId)
			if (entry) entry.enableCheckpoints = value
		},
		setCheckpointTimeout(taskId: string, value: number) {
			const entry = self.entries.get(taskId)
			if (entry) entry.checkpointTimeout = value
		},
		setCheckpointServiceInitializing(taskId: string, value: boolean) {
			const entry = self.entries.get(taskId)
			if (entry) entry.checkpointServiceInitializing = value
		},
		setHasCheckpoint(taskId: string, value: boolean) {
			const entry = self.entries.get(taskId)
			if (entry) entry.hasCheckpoint = value
		},
	}))

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface ICheckpointStoreModel extends ReturnType<typeof CheckpointStoreModel.create> {}

// ─── FileMetadataEntryModel (per-file tracking) ────────────────────────

/**
 * FileMetadataEntryModel represents a single file tracked in the task context.
 *
 * Each entry records when a file was read/edited by Jabberwock or edited
 * by the user, along with the source of the record (tool, mention, edit).
 */
export const FileMetadataEntryModel = types.model("FileMetadataEntry", {
	path: types.string,
	record_state: types.enumeration(["active", "stale"]),
	record_source: types.string,
	jabberwock_read_date: types.maybeNull(types.number),
	jabberwock_edit_date: types.maybeNull(types.number),
	user_edit_date: types.maybeNull(types.number),
})

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface IFileMetadataEntryModel extends Instance<typeof FileMetadataEntryModel> {}

/**
 * TaskMetadataModel holds the files_in_context array for a single task.
 *
 * This replaces the module-level JSON persistence used by the old
 * FileContextTracker class, making tracking data reactive and observable.
 */
export const TaskMetadataModel = types
	.model("TaskMetadata", {
		taskId: types.string,
		filesInContext: types.array(FileMetadataEntryModel),
	})
	.actions((self) => ({
		/**
		 * Mark all active entries for the given file as stale.
		 */
		markStale(filePath: string) {
			for (const entry of self.filesInContext) {
				if (entry.path === filePath && entry.record_state === "active") {
					entry.record_state = "stale"
				}
			}
		},

		/**
		 * Get the latest date for a specific field on a specific path.
		 */
		getLatestDateForField(
			path: string,
			field: "jabberwock_read_date" | "jabberwock_edit_date" | "user_edit_date",
		): number | null {
			const relevantEntries = self.filesInContext
				.filter((entry) => entry.path === path && entry[field] != null)
				.sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
			return relevantEntries.length > 0 ? (relevantEntries[0][field] as number) : null
		},

		/**
		 * Add a file tracking record with the given source.
		 */
		addFileRecord(filePath: string, source: RecordSource) {
			this.markStale(filePath)

			const now = Date.now()
			const newEntry = FileMetadataEntryModel.create({
				path: filePath,
				record_state: "active",
				record_source: source,
				jabberwock_read_date: this.getLatestDateForField(filePath, "jabberwock_read_date"),
				jabberwock_edit_date: this.getLatestDateForField(filePath, "jabberwock_edit_date"),
				user_edit_date: this.getLatestDateForField(filePath, "user_edit_date"),
			})

			switch (source) {
				case "user_edited":
					newEntry.user_edit_date = now
					break
				case "roo_edited":
					newEntry.jabberwock_read_date = now
					newEntry.jabberwock_edit_date = now
					break
				case "read_tool":
				case "file_mentioned":
					newEntry.jabberwock_read_date = now
					break
			}

			self.filesInContext.push(newEntry)
		},

		/**
		 * Get unique file paths read by Jabberwock, sorted most recent first.
		 */
		getFilesReadByJabberwock(sinceTimestamp?: number): string[] {
			const readEntries = self.filesInContext.filter((entry) => {
				const isReadByRoo = entry.record_source === "read_tool" || entry.record_source === "file_mentioned"
				if (!isReadByRoo) return false
				if (sinceTimestamp && entry.jabberwock_read_date) {
					return entry.jabberwock_read_date >= sinceTimestamp
				}
				return true
			})

			readEntries.sort((a, b) => (b.jabberwock_read_date ?? 0) - (a.jabberwock_read_date ?? 0))

			const seen = new Set<string>()
			const uniquePaths: string[] = []
			for (const entry of readEntries) {
				if (!seen.has(entry.path)) {
					seen.add(entry.path)
					uniquePaths.push(entry.path)
				}
			}
			return uniquePaths
		},

		/**
		 * Get all unique file paths tracked in context.
		 */
		getAllTrackedPaths(): string[] {
			const seen = new Set<string>()
			const paths: string[] = []
			for (const entry of self.filesInContext) {
				if (!seen.has(entry.path)) {
					seen.add(entry.path)
					paths.push(entry.path)
				}
			}
			return paths
		},
	}))

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface ITaskMetadataModel extends Instance<typeof TaskMetadataModel> {}

/**
 * FileContextTrackerStoreModel manages multiple TaskMetadata instances (one per task).
 *
 * This is the root-level store that replaces the old singleton-based
 * FileContextTracker class for tracking data.
 */
export const FileContextTrackerStoreModel = types
	.model("FileContextTrackerStore", {
		entries: types.map(TaskMetadataModel),
	})
	.actions((self) => ({
		getOrCreate(taskId: string): ITaskMetadataModel {
			if (!self.entries.has(taskId)) {
				self.entries.put(
					TaskMetadataModel.create({
						taskId,
						filesInContext: [],
					}),
				)
			}
			return self.entries.get(taskId)!
		},

		removeForTask(taskId: string) {
			self.entries.delete(taskId)
		},

		trackFile(taskId: string, filePath: string, source: RecordSource) {
			const entry = this.getOrCreate(taskId)
			entry.addFileRecord(filePath, source)
		},

		getFilesReadByJabberwock(taskId: string, sinceTimestamp?: number): string[] {
			const entry = self.entries.get(taskId)
			if (!entry) return []
			return entry.getFilesReadByJabberwock(sinceTimestamp)
		},
	}))

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface IFileContextTrackerStoreModel extends Instance<typeof FileContextTrackerStoreModel> {}
