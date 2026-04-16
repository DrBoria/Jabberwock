import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { setTimeout } from "timers/promises"

const MCP_PORT = 60060
const POLL_INTERVAL = 3000

async function runLiveVerification() {
	console.log(`[INIT] Connecting to live Jabberwock session on port ${MCP_PORT}...`)

	try {
		const transport = new SSEClientTransport(new URL(`http://127.0.0.1:${MCP_PORT}/sse`))
		const client = new Client({ name: "LiveVerifier", version: "1.0.0" }, { capabilities: { tools: {} } })
		await client.connect(transport)
		console.log("✅ Successfully connected to Live MCP Server.")

		// 1. Send Request
		console.log("\n[STEP 1] Sending Orchestrator request...")
		await client.callTool({
			name: "send_chat_request",
			arguments: {
				prompt: "Detect all files in the root that have 'diagnostics' in their name. Create a file 'audit_report.md' with the list. Target 'searcher' to find files and 'coder' to write the report. Use structured TODO.",
				mode: "orchestrator",
			},
		})

		// 2. Poll for TODO
		console.log("[STEP 2] Waiting for TODO generation (manage_todo_plan)...")
		let todoFound = false
		for (let i = 0; i < 20; i++) {
			const res = await client.callTool({ name: "get_active_ask", arguments: {} })
			const raw = (res.content as any)[0].text

			if (raw !== "No active ask message" && raw !== "No active task") {
				try {
					const parsed = JSON.parse(raw)
					if (parsed.ask === "interactive_app" || String(parsed.text).includes("manage_todo_plan")) {
						console.log("✅ TODO generated!")
						console.log("Plan JSON Pre-approval:")
						console.log(parsed.text)

						// APPROVE
						console.log("[STEP 3] Approving TODO plan...")
						await client.callTool({
							name: "respond_to_ask",
							arguments: { response: "yesButtonClicked" },
						})
						todoFound = true
						break
					}
				} catch {}
			}
			process.stdout.write(".")
			await setTimeout(POLL_INTERVAL)
		}

		if (!todoFound) throw new Error("Timeout waiting for TODO plan")

		// 3. Monitor Execution
		console.log("\n[STEP 4] Monitoring multi-agent execution...")
		for (let i = 0; i < 30; i++) {
			const res = await client.callTool({ name: "get_task_hierarchy", arguments: {} })
			const hierarchy = JSON.parse((res.content as any)[0].text)

			const children = hierarchy.children || []
			console.log(`[STATUS] Hierarchy: 1 root, ${children.length} subtasks active.`)

			if (children.length >= 1) {
				console.log("✅ Success! Subtasks observed in hierarchy:")
				children.forEach((c: any) =>
					console.log(
						`  - Subtask ${c.taskId}: mode=${c.mode}, status=${c.isCompleted ? "Done" : "Running"}`,
					),
				)
				break
			}

			await setTimeout(POLL_INTERVAL)
		}

		// 4. Capture Trace
		console.log("\n[STEP 5] Capture Final Proof (Execution Trace)...")
		const traceRes = await client.callTool({ name: "get_execution_trace", arguments: {} })
		const trace = JSON.parse((traceRes.content as any)[0].text)

		console.log("--- FINAL EXECUTION TRACE ---")
		console.log(JSON.stringify(trace, null, 2))

		console.log("\n✅ LIVE VERIFICATION COMPLETE.")
		process.exit(0)
	} catch (error) {
		console.error("\n❌ LIVE VERIFICATION FAILED:")
		console.error(error)
		process.exit(1)
	}
}

runLiveVerification()
