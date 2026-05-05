import { types, Instance } from "mobx-state-tree"

/**
 * McpExecutionStore — holds MCP execution status snapshots pushed
 * from the extension via MstBridge.
 *
 * Replaces the `mcpExecutionStatus` postMessage listener with MST
 * snapshot propagation.
 */
export const McpExecutionStore = types
	.model("McpExecutionStore", {
		executions: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		/** Replace the entire executions array from a snapshot. */
		setExecutions(executions: any[]) {
			self.executions.replace(executions)
		},
	}))

export type IMcpExecutionStore = Instance<typeof McpExecutionStore>

/** Singleton store instance. */
export const mcpExecutionStore = McpExecutionStore.create({})
