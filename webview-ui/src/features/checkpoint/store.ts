import { types, Instance } from "mobx-state-tree"

/**
 * CheckpointStore — tracks checkpoint state.
 * Receives snapshots from the extension-side CheckpointStore via MstBridge.
 */
export const CheckpointStore = types
	.model("CheckpointStore", {
		currentCheckpoint: types.maybe(types.string),
	})
	.actions((self) => ({
		setCurrentCheckpoint(checkpoint?: string) {
			self.currentCheckpoint = checkpoint
		},
	}))

export type ICheckpointStore = Instance<typeof CheckpointStore>
export const checkpointStore = CheckpointStore.create({})
