/**
 * Jabberwock Devtool MCP Smoke Test
 *
 * Connects directly to the devtool's WebSocket MCP server on port 60060
 * and tests all available tools.
 *
 * Runs from: `npx tsx scratch/smoke-test-ws.ts`
 * (ws module resolved from src/node_modules or packages/devtool/node_modules)
 */
import WebSocket from "ws"

const WS_URL = "ws://127.0.0.1:60060/ws"
const REQUEST_TIMEOUT = 15_000

interface McpResponse {
	id: string
	result?: { content?: { type: string; text: string }[] }
	error?: { message: string }
}

let msgId = 0
let pending = new Map<string, { resolve: (v: McpResponse) => void; reject: (e: Error) => void }>()

function init() {
	const ws = new WebSocket(WS_URL)
	const p = new Promise<WebSocket>((resolve, reject) => {
		ws.onopen = () => resolve(ws)
		ws.onerror = (e: any) => reject(new Error(`WS error: ${e.message || "unknown"}`))
		ws.onclose = () => {
			for (const [, p] of pending) p.reject(new Error("WS closed"))
			pending.clear()
		}
		ws.onmessage = (event: MessageEvent) => {
			try {
				const msg: McpResponse = JSON.parse(event.data as string)
				const pid = pending.get(msg.id)
				if (pid) {
					pid.resolve(msg)
					pending.delete(msg.id)
				}
			} catch {
				/* ignore malformed */
			}
		}
	})
	return p.then((ws) => {
		// Send initialize request
		const initId = String(++msgId)
		ws.send(
			JSON.stringify({
				jsonrpc: "2.0",
				id: initId,
				method: "initialize",
				params: {
					protocolVersion: "2024-11-05",
					capabilities: {},
					clientInfo: { name: "smoke-test", version: "1.0.0" },
				},
			}),
		)
		return new Promise<WebSocket>((resolve) => {
			const timer = setTimeout(() => resolve(ws), 2000)
			// Wait for init response, but proceed either way
			const handler = (event: MessageEvent) => {
				try {
					const msg = JSON.parse(event.data as string)
					if (msg.id === initId) {
						clearTimeout(timer)
						ws.removeEventListener("message", handler)
						resolve(ws)
					}
				} catch {}
			}
			ws.addEventListener("message", handler)
		})
	})
}

async function callTool(
	ws: WebSocket,
	name: string,
	args: Record<string, unknown> = {},
): Promise<{ passed: boolean; text?: string; error?: string }> {
	const id = String(++msgId)
	const request = {
		jsonrpc: "2.0",
		id,
		method: "tools/call",
		params: { name, arguments: args },
	}

	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			pending.delete(id)
			resolve({ passed: true, text: `TIMEOUT (no response in ${REQUEST_TIMEOUT}ms)` })
		}, REQUEST_TIMEOUT)

		pending.set(id, {
			resolve: (msg: McpResponse) => {
				clearTimeout(timer)
				if (msg.error) {
					resolve({ passed: false, error: msg.error.message })
				} else if (msg.result?.content?.[0]?.text) {
					const text = msg.result.content[0].text
					const isError = text.startsWith("Error:")
					resolve({
						passed: !isError,
						text: isError ? text.substring(0, 200) : text.substring(0, 300),
						error: isError ? text : undefined,
					})
				} else {
					resolve({ passed: true, text: "(empty result)" })
				}
			},
			reject: (err: Error) => {
				clearTimeout(timer)
				resolve({ passed: false, error: err.message })
			},
		})

		ws.send(JSON.stringify(request))
	})
}

async function run() {
	console.log("=".repeat(60))
	console.log("  JABBERWOCK DEVTOOL MCP SMOKE TEST")
	console.log("=".repeat(60))
	console.log()

	const ws = await init()
	console.log(`✅ Connected to ${WS_URL}\n`)

	let totalPassed = 0
	let totalFailed = 0
	let totalSkipped = 0

	type TestFn = () => Promise<{ passed: boolean; text?: string; error?: string; skipped?: boolean }>

	function test(name: string, fn: TestFn) {
		// Just register; we run sequentially below
		return { name, fn }
	}

	const tests: { name: string; fn: TestFn }[] = [
		// ── STATE TOOLS ──
		test("get_current_state", async () => {
			const r = await callTool(ws, "get_current_state")
			return r
		}),

		test("get_extension_info", async () => {
			const r = await callTool(ws, "get_extension_info")
			if (r.passed && r.text) {
				const data = JSON.parse(r.text)
				if (!data.name || !data.version) return { passed: false, error: "Missing name/version" }
			}
			return r
		}),

		test("get_settings", async () => {
			const r = await callTool(ws, "get_settings")
			return r
		}),

		// ── WORKSPACE TOOLS ──
		test("get_workspace_state", async () => {
			const r = await callTool(ws, "get_workspace_state", { fields: "*" })
			return r
		}),

		test("get_virtual_files", async () => {
			const r = await callTool(ws, "get_virtual_files")
			return r
		}),

		test("get_checkpoint_info", async () => {
			const r = await callTool(ws, "get_checkpoint_info")
			return r
		}),

		// ── MST STATE ──
		test("get_mst_state", async () => {
			const r = await callTool(ws, "get_mst_state", { store: "task", mode: "graph" })
			return r
		}),

		// ── DIAGNOSTICS TOOLS ──
		test("get_logs", async () => {
			const r = await callTool(ws, "get_logs", { lines: 5 })
			return r
		}),

		test("get_console_logs", async () => {
			const r = await callTool(ws, "get_console_logs", { limit: 3 })
			return r
		}),

		test("get_diagnostics_snapshot", async () => {
			const r = await callTool(ws, "get_diagnostics_snapshot", { limit: 5 })
			return r
		}),

		test("clear_diagnostics", async () => {
			const r = await callTool(ws, "clear_diagnostics")
			return r
		}),

		// ── TASK STATUS TOOLS ──
		test("get_task_status", async () => {
			const r = await callTool(ws, "get_task_status")
			return r
		}),

		test("get_task_summary", async () => {
			const r = await callTool(ws, "get_task_summary")
			return r
		}),

		test("get_task_hierarchy", async () => {
			const r = await callTool(ws, "get_task_hierarchy")
			return r
		}),

		test("get_child_tasks", async () => {
			const r = await callTool(ws, "get_child_tasks")
			return r
		}),

		// ── HISTORY / CHAT TOOLS ──
		test("get_chat_messages", async () => {
			const r = await callTool(ws, "get_chat_messages", { count: 5 })
			return r
		}),

		test("get_conversation_history", async () => {
			const r = await callTool(ws, "get_conversation_history", { count: 3 })
			return r
		}),

		test("get_api_history", async () => {
			const r = await callTool(ws, "get_api_history", { count: 3 })
			return r
		}),

		// ── TODO TOOLS ──
		test("get_todo_list_state", async () => {
			const r = await callTool(ws, "get_todo_list_state")
			return r
		}),

		test("get_history_token_audit", async () => {
			const r = await callTool(ws, "get_history_token_audit")
			return r
		}),

		// ── DOM TOOLS ──
		test("get_dom", async () => {
			const r = await callTool(ws, "get_dom", { maxDepth: 3, maxChildren: 5 })
			return r
		}),

		test("find_element_by_id", async () => {
			const r = await callTool(ws, "find_element_by_id", { id: "root" })
			return r
		}),

		test("find_element_by_text (History)", async () => {
			const r = await callTool(ws, "find_element_by_text", { text: "History" })
			return r
		}),

		// ── ACTION TOOLS ──
		test("send_chat_request", async () => {
			const r = await callTool(ws, "send_chat_request", {
				prompt: "Say hello and nothing else",
				mode: "ask",
			})
			return r
		}),

		// ── POLLING TOOLS ──
		test("wait_for_task_idle", async () => {
			const r = await callTool(ws, "wait_for_task_idle", { timeoutMs: 5000 })
			return r
		}),

		// ── CLEANUP ──
		test("clear_task", async () => {
			const r = await callTool(ws, "clear_task")
			return r
		}),
	]

	for (const t of tests) {
		try {
			const r = await t.fn()
			if (r.skipped) {
				console.log(`  ⏭️  ${t.name}: SKIPPED`)
				totalSkipped++
			} else if (r.passed) {
				console.log(`  ✅ ${t.name}: PASS`)
				totalPassed++
			} else {
				console.log(`  ❌ ${t.name}: FAIL — ${r.error?.substring(0, 150)}`)
				totalFailed++
			}
			if (r.text && r.text.length > 0) {
				const preview = r.text.length > 160 ? r.text.substring(0, 160) + "..." : r.text
				// Only show if it's short enough and interesting
				if (preview.length < 300 && !preview.startsWith("Error:")) {
					console.log(`     └─ ${preview}`)
				}
			}
		} catch (e: any) {
			console.log(`  💥 ${t.name}: CRASH — ${e.message}`)
			totalFailed++
		}
	}

	console.log()
	console.log("=".repeat(60))
	console.log(`  RESULTS: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`)
	console.log("=".repeat(60))

	ws.close()
	process.exit(totalFailed > 0 ? 1 : 0)
}

run().catch((e) => {
	console.error("Smoke test crashed:", e)
	process.exit(1)
})
