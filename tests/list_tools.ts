import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

async function listTools() {
	const transport = new SSEClientTransport(new URL("http://127.0.0.1:60060/sse"))
	const client = new Client({ name: "Tool-Lister", version: "1.0.0" }, { capabilities: { tools: {} } })

	try {
		await client.connect(transport)
		console.log("Connected to MCP server")

		// Get server info to see available tools
		const tools = await client.listTools()
		console.log(
			"Available tools:",
			tools.tools.map((t) => t.name),
		)

		await client.close()
	} catch (error) {
		console.error("Error:", error)
	}
}

listTools()
