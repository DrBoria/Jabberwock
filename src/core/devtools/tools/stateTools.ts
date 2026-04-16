import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../webview/ClineProvider"
import { getSnapshot } from "mobx-state-tree"
import { getNativeTools } from "../../prompts/tools/native-tools"
import { diagnosticsManager } from "../DiagnosticsManager"
import { Package } from "../../../shared/package"
import { agentStore } from "../../state/AgentStore"
import { getWorkspacePath } from "../../../utils/path"

export function registerStateTools(mcpServer: McpServer, provider: ClineProvider) {
	mcpServer.tool(
		"get_mst_state",
		{ nodeId: z.string().optional().describe("Optional: specific node ID to inspect. Omit for full tree.") },
		async ({ nodeId }) => {
			try {
				const snapshot = getSnapshot(provider.chatStore)
				if (nodeId) {
					const node = (snapshot.nodes as any)[nodeId]
					if (!node)
						return { content: [{ type: "text", text: `Node '${nodeId}' not found.` }], isError: true }
					return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] }
				}
				return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool("get_extension_info", {}, async () => {
		try {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								name: Package.name,
								version: Package.version,
								stackSize: provider.getTaskStackSize(),
								activeNodeId: provider.chatStore.activeNodeId,
								nodesCount: Object.keys(getSnapshot(provider.chatStore).nodes || {}).length,
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_available_native_tools", {}, async () => {
		try {
			return { content: [{ type: "text", text: JSON.stringify(getNativeTools(), null, 2) }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_devtools_state", {}, async () => {
		try {
			const snapshot = diagnosticsManager.getSnapshot()
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								extension: {
									name: Package.name,
									version: Package.version,
									stackSize: provider.getTaskStackSize(),
									activeNodeId: provider.chatStore.activeNodeId,
								},
								diagnostics: snapshot,
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
	mcpServer.tool("get_internal_state", {}, async () => {
		try {
			const providerState = await provider.getState()
			const agentsSnapshot = getSnapshot(provider.chatStore)

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								tasks: Object.values(agentsSnapshot.nodes || {}),
								agents: Array.from(agentStore.agents.values()),
								settings: providerState,
								workspace: getWorkspacePath(),
								activeTaskId: provider.getCurrentTask()?.taskId,
								stackSize: provider.getTaskStackSize(),
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
}
