import { types, Instance } from "mobx-state-tree"

import type { McpExecutionStatus } from "@jabberwock/types"

/**
 * McpExecutionStore — holds MCP execution status snapshots pushed
 * from the extension via MstBridge.
 *
 * Replaces the `mcpExecutionStatus` postMessage listener with MST
 * snapshot propagation.
 */
export const McpExecutionStore = types
	.model("McpExecutionStore", {
		executions: types.array(types.frozen<McpExecutionStatus>()),
	})
	.actions((self) => ({
		/** Replace the entire executions array from a snapshot. */
		setExecutions(executions: McpExecutionStatus[]) {
			self.executions.replace(executions)
		},
	}))

export type IMcpExecutionStore = Instance<typeof McpExecutionStore>

/** @deprecated Use `getRootStore().mcpExecution` instead. Will be removed after all consumers migrate. */
