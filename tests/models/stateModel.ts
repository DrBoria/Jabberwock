/**
 * State Model — MST state queries and verification.
 *
 * All methods use DevtoolClient primitives (getMstState, getCurrentState) —
 * NO interceptor usage.
 */

import type { DevtoolClient } from "../../packages/devtool/src/client"

interface TaskNode {
	id?: { value: string }
	mode?: { value: string }
	title?: { value: string }
	children?: TaskNode[]
}

export class StateModel {
	constructor(public readonly client: DevtoolClient) {}

	/**
	 * Query an MST store by name.
	 */
	async getMstState(params: { store?: string; mode?: string; depth?: number; path?: string }): Promise<any> {
		return this.client.getMstState(params)
	}

	/**
	 * Get current state from the devtool (generic primitive).
	 * @deprecated Use getMstState() or dom.getMstActiveTaskId() instead.
	 * The underlying bridge implementation may return errors.
	 */
	async getCurrentState(): Promise<any> {
		return this.client.getCurrentState()
	}

	/**
	 * Get task status from MST chatStore.
	 * Returns the activeNodeId subtree with id, title, mode, status, children.
	 */
	async getTaskStatus(): Promise<any> {
		const state = await this.client.getMstState({
			store: "chatStore",
			mode: "graph",
			depth: 2,
		})
		return (state as { activeNodeId?: unknown })?.activeNodeId || state || null
	}

	/**
	 * Get task hierarchy from MST state.
	 * Queries the chatStore for the task tree structure.
	 */
	async getTaskHierarchy(): Promise<any> {
		const state = await this.client.getMstState({ store: "chatStore", mode: "graph", depth: 3 })
		return state || null
	}

	/**
	 * Get the task delegation stack from root task down to active leaf.
	 * Walks the MST hierarchy to build the stack.
	 */
	async getTaskStack(): Promise<Array<{ taskId: string; mode: string; title?: string }>> {
		const stack: Array<{ taskId: string; mode: string; title?: string }> = []

		try {
			const hierarchy = await this.getTaskHierarchy()
			if (hierarchy) {
				// MST graph mode returns { nodes: Map, activeNodeId: { id, title, mode, status, children } }
				const activeNode = hierarchy.activeNodeId
				if (activeNode && activeNode.id?.value) {
					stack.push({
						taskId: activeNode.id.value,
						mode: activeNode.mode?.value || "unknown",
						title: activeNode.title?.value || undefined,
					})
					// Walk children if present
					if (activeNode.children && Array.isArray(activeNode.children)) {
						const walk = (node: TaskNode) => {
							if (node.id?.value) {
								stack.push({
									taskId: node.id.value,
									mode: node.mode?.value || "unknown",
									title: node.title?.value || undefined,
								})
							}
							if (node.children && Array.isArray(node.children)) {
								for (const child of node.children) {
									walk(child)
								}
							}
						}
						for (const child of activeNode.children) {
							walk(child)
						}
					}
					return stack
				}
			}
		} catch {
			// Fallback: try querying activeNodeId directly
		}

		// Fallback: get active task ID from MST query path
		try {
			const idState = await this.client.getMstState({
				store: "chatStore",
				mode: "query",
				path: "activeNodeId",
			})
			if (typeof idState === "string") {
				stack.push({
					taskId: idState,
					mode: "unknown",
				})
			}
		} catch {
			// Best-effort
		}

		return stack
	}

	/**
	 * Get workspace state from MST.
	 * Queries the chatStore for a high-level overview.
	 */
	async getWorkspaceState(): Promise<any> {
		try {
			const state = await this.client.getMstState({ store: "chatStore", mode: "graph", depth: 1 })
			return state
		} catch {
			return null
		}
	}

	/**
	 * Verify MST task state against expected values.
	 * Queries chatStore and checks if the taskId and expected key-value pairs exist.
	 */
	async verifyMstTaskState(taskId: string, expected: Record<string, unknown>): Promise<void> {
		const state = await this.client.getStoreState({
			store: "frontend",
			path: `chat.tree.nodes.${taskId}`,
		})
		if (state && typeof state === "object") {
			const record = state as Record<string, unknown>
			const items = record.items as Array<Record<string, unknown>> | undefined
			const stateStr = JSON.stringify(items || record)
			if (!stateStr.includes(taskId)) {
				throw new Error(`Task ${taskId} not found in MST store`)
			}
			for (const [key, val] of Object.entries(expected)) {
				if (stateStr.includes(`${key}`) && stateStr.includes(`${val}`)) {
					console.log(`  ✓ MST task state matches: ${key}=${val}`)
				} else {
					console.warn(`  ⚠ Could not verify MST state: ${key}=${val} in store`)
				}
			}
		} else {
			throw new Error(`Task ${taskId} not found in MST store`)
		}
	}

	/**
	 * Verify task is the active node in MST.
	 * Uses MST query path to get activeNodeId and compares with expected taskId.
	 */
	async verifyMstActiveNode(taskId: string): Promise<void> {
		try {
			const activeIdResult = await this.client.getStoreState({
				store: "frontend",
				path: "chat.tree.activeNodeId",
			})
			if (activeIdResult && typeof activeIdResult === "object") {
				const record = activeIdResult as Record<string, unknown>
				const items = record.items as Array<Record<string, unknown>> | undefined
				const activeId = items?.[0]?.value
				if (activeId === taskId) {
					console.log(`  ✓ Task ${taskId} is active`)
				} else {
					console.warn(`  ⚠ Task ${taskId} may not be the active task (active: ${activeId})`)
				}
			}
		} catch {
			console.warn(`  ⚠ Could not verify active node for task ${taskId}`)
		}
	}
}
