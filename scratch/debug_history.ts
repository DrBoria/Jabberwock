import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

async function debug() {
	const transport = new SSEClientTransport(new URL("http://127.0.0.1:60060/sse"))
	const client = new Client({ name: "debug", version: "1.0.0" }, { capabilities: { tools: {} } })
	await client.connect(transport)

	const history = await client.callTool({ name: "get_task_history", arguments: {} })
	console.log(JSON.stringify(history, null, 2))
	process.exit(0)
}

debug().catch(console.error)
