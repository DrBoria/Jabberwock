import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

const MCP_STATIC_PORT = 60060

async function debug() {
	const transport = new SSEClientTransport(new URL(`http://127.0.0.1:${MCP_STATIC_PORT}/sse`))
	const client = new Client({ name: "Debugger", version: "1.0.0" }, { capabilities: { tools: {} } })

	try {
		await client.connect(transport)
		console.log("Connected to MCP Server")

		console.log("\n--- Task Hierarchy ---")
		const hierarchyData = await client.callTool({ name: "get_task_hierarchy", arguments: {} })
		const hierarchyContent = Reflect.get(hierarchyData, "content")
		if (Array.isArray(hierarchyContent) && hierarchyContent[0]) {
			console.log(Reflect.get(hierarchyContent[0], "text"))
		}

		console.log("\n--- Active Ask ---")
		const askData = await client.callTool({ name: "get_active_ask", arguments: {} })
		const askContent = Reflect.get(askData, "content")
		if (Array.isArray(askContent) && askContent[0]) {
			console.log(Reflect.get(askContent[0], "text"))
		}

		console.log("\n--- Task Status ---")
		const statusData = await client.callTool({ name: "get_task_status", arguments: {} })
		const statusContent = Reflect.get(statusData, "content")
		if (Array.isArray(statusContent) && statusContent[0]) {
			console.log(Reflect.get(statusContent[0], "text"))
		}
	} catch (e) {
		console.error("Debug failed:", e)
	} finally {
		process.exit()
	}
}

debug()
