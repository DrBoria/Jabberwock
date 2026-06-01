import { types, getRoot } from "mobx-state-tree"
import type { EventBridge } from "../webview/EventBridge"
import { getState } from "@features/storeSingleton"

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

// ─── Backward-compatible interface ─────────────────────────────────────
