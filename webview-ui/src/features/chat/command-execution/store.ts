import { types, Instance } from "mobx-state-tree"

/**
 * CommandExecutionStore — holds command execution status snapshots pushed
 * from the extension via MstBridge.
 *
 * Replaces the `commandExecutionStatus` postMessage listener with MST
 * snapshot propagation.
 */
export const CommandExecutionStore = types
	.model("CommandExecutionStore", {
		executions: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		/** Replace the entire executions array from a snapshot. */
		setExecutions(executions: any[]) {
			self.executions.replace(executions)
		},
	}))

export type ICommandExecutionStore = Instance<typeof CommandExecutionStore>

/** Singleton store instance. */
export const commandExecutionStore = CommandExecutionStore.create({})
