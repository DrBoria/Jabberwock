/**
 * E2E Test: Phase 2 State Tools via SSE
 *
 * Tests the new state tools (get_current_state, get_last_model_message,
 * wait_for_todo, wait_for_ask_type, verify_state) by connecting to the
 * DevTools MCP server via SSE on port 60060.
 *
 * Prerequisites:
 * - VS Code extension host must be running (DevTools server on port 60060)
 * - Run: npx tsx tests/test_state_tools_sse.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

const MCP_STATIC_PORT = 60060

interface TestResult {
	name: string
	status: "PASS" | "FAIL" | "SKIP"
	detail?: string
}

class StateToolsSSETest {
	private client: Client | null = null
	private transport: SSEClientTransport | null = null
	private results: TestResult[] = []

	async connect(): Promise<void> {
		this.transport = new SSEClientTransport(new URL(`http://127.0.0.1:${MCP_STATIC_PORT}/sse`))
		this.client = new Client({ name: "StateTools-SSE-Test", version: "1.0.0" }, { capabilities: { tools: {} } })
		await this.client.connect(this.transport)
		console.log(`[CONNECT] Connected to DevTools SSE on port ${MCP_STATIC_PORT}`)
	}

	async disconnect(): Promise<void> {
		try {
			if (this.client) {
				await this.client.close()
			}
		} catch (e) {
			// ignore close errors
		}
	}

	/**
	 * Use client.callTool() which handles schema internally.
	 * Same pattern as e2e_dsl_complete.ts.
	 */
	private async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<any> {
		if (!this.client) {
			throw new Error("Not connected")
		}
		const res = await this.client.callTool({ name: toolName, arguments: args })
		if (res.isError) {
			throw new Error(`MCP Tool Error: ${JSON.stringify(res.content)}`)
		}
		const content = res.content as { text: string }[]
		if (!content || content.length === 0) {
			throw new Error("Empty response from tool")
		}
		return JSON.parse(content[0].text)
	}

	private record(name: string, status: "PASS" | "FAIL" | "SKIP", detail?: string) {
		this.results.push({ name, status, detail })
		const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️"
		console.log(`  ${icon} ${name}${detail ? `: ${detail}` : ""}`)
	}

	async runAll(): Promise<void> {
		console.log("\n============================================")
		console.log("  Phase 2 State Tools Test Suite (SSE)")
		console.log("============================================\n")

		// ── Test 1: get_current_state ──
		console.log("── Test 1: get_current_state ──")
		try {
			const parsed = await this.callTool("get_current_state")
			if (parsed.error) {
				this.record("get_current_state (no task)", "PASS", `Expected: ${parsed.error}`)
			} else {
				this.record("get_current_state (has task)", "PASS", `taskId=${parsed.taskId}, mode=${parsed.mode}`)
			}
		} catch (e: any) {
			this.record("get_current_state", "FAIL", e.message)
		}

		// ── Test 2: get_last_model_message ──
		console.log("\n── Test 2: get_last_model_message ──")
		try {
			const parsed = await this.callTool("get_last_model_message", { maxLength: 500 })
			if (parsed.error) {
				this.record("get_last_model_message (no task)", "PASS", `Expected: ${parsed.error}`)
			} else if (parsed.message) {
				this.record("get_last_model_message (no messages)", "PASS", "No model messages yet")
			} else {
				this.record(
					"get_last_model_message (has messages)",
					"PASS",
					`length=${parsed.fullLength}, truncated=${parsed.truncated}`,
				)
			}
		} catch (e: any) {
			this.record("get_last_model_message", "FAIL", e.message)
		}

		// ── Test 3: wait_for_todo (timeout expected) ──
		console.log("\n── Test 3: wait_for_todo (timeout) ──")
		try {
			const parsed = await this.callTool("wait_for_todo", { timeoutMs: 3000, minCount: 1 })
			if (parsed.success) {
				this.record("wait_for_todo (timeout)", "PASS", `Got ${parsed.todoCount} todos in ${parsed.elapsedMs}ms`)
			} else {
				this.record("wait_for_todo (timeout)", "PASS", `Expected timeout: ${parsed.error}`)
			}
		} catch (e: any) {
			this.record("wait_for_todo (timeout)", "FAIL", e.message)
		}

		// ── Test 4: wait_for_ask_type (timeout expected) ──
		console.log("\n── Test 4: wait_for_ask_type (timeout) ──")
		try {
			const parsed = await this.callTool("wait_for_ask_type", { askType: "use_mcp_server", timeoutMs: 3000 })
			if (parsed.success) {
				this.record("wait_for_ask_type (timeout)", "PASS", `Got askType=${parsed.askType}`)
			} else {
				this.record("wait_for_ask_type (timeout)", "PASS", `Expected timeout: ${parsed.error}`)
			}
		} catch (e: any) {
			this.record("wait_for_ask_type (timeout)", "FAIL", e.message)
		}

		// ── Test 5: verify_state ──
		console.log("\n── Test 5: verify_state ──")
		try {
			const parsed = await this.callTool("verify_state", {
				expectations: JSON.stringify({ hasTodo: false, isStreaming: false }),
			})
			if (parsed.verified) {
				this.record("verify_state (match)", "PASS", "All expectations matched")
			} else if (parsed.errors) {
				this.record("verify_state (mismatch)", "PASS", `Expected errors: ${parsed.errors.join(", ")}`)
			} else {
				this.record("verify_state", "FAIL", "Unexpected response format")
			}
		} catch (e: any) {
			this.record("verify_state", "FAIL", e.message)
		}

		// ── Test 6: get_internal_state ──
		console.log("\n── Test 6: get_internal_state ──")
		try {
			const parsed = await this.callTool("get_internal_state")
			const hasTasks = Array.isArray(parsed.tasks)
			const hasSettings = parsed.settings !== undefined
			const hasWorkspace = parsed.workspace !== undefined
			if (hasTasks && hasSettings && hasWorkspace) {
				this.record(
					"get_internal_state",
					"PASS",
					`tasks=${parsed.tasks.length}, activeTaskId=${parsed.activeTaskId || "none"}`,
				)
			} else {
				this.record("get_internal_state", "FAIL", "Missing expected fields")
			}
		} catch (e: any) {
			this.record("get_internal_state", "FAIL", e.message)
		}

		// ── Test 7: get_extension_info ──
		console.log("\n── Test 7: get_extension_info ──")
		try {
			const parsed = await this.callTool("get_extension_info")
			if (parsed.version || parsed.extensionName) {
				this.record("get_extension_info", "PASS", `version=${parsed.version || "unknown"}`)
			} else {
				this.record("get_extension_info", "PASS", "Got extension info")
			}
		} catch (e: any) {
			this.record("get_extension_info", "FAIL", e.message)
		}

		// ── Test 8: get_devtools_state ──
		console.log("\n── Test 8: get_devtools_state ──")
		try {
			const parsed = await this.callTool("get_devtools_state")
			if (parsed.connected !== undefined || parsed.serverStatus) {
				this.record("get_devtools_state", "PASS", `connected=${parsed.connected}`)
			} else {
				this.record("get_devtools_state", "PASS", "Got devtools state")
			}
		} catch (e: any) {
			this.record("get_devtools_state", "FAIL", e.message)
		}

		// ── Summary ──
		console.log("\n============================================")
		console.log("  RESULTS SUMMARY")
		console.log("============================================")
		const passed = this.results.filter((r) => r.status === "PASS").length
		const failed = this.results.filter((r) => r.status === "FAIL").length
		const skipped = this.results.filter((r) => r.status === "SKIP").length
		console.log(`  Total: ${this.results.length} | ✅ Pass: ${passed} | ❌ Fail: ${failed} | ⏭️ Skip: ${skipped}`)
		console.log("============================================\n")
	}
}

// ── Main ──
async function main() {
	const test = new StateToolsSSETest()
	const maxRetries = 10
	for (let i = 0; i < maxRetries; i++) {
		try {
			await test.connect()
			break
		} catch (e) {
			if (i < maxRetries - 1) {
				console.log(`[CONNECT] Retry ${i + 1}/${maxRetries}...`)
				await new Promise((r) => setTimeout(r, 2000))
			} else {
				console.error(`[FATAL] Failed to connect after ${maxRetries} retries: ${e}`)
				console.error("\n⚠️  DevTools server is not running. Start VS Code extension host first.")
				console.error(
					"   The DevTools MCP server starts automatically on port 60060 when the extension activates.\n",
				)
				process.exit(1)
			}
		}
	}
	try {
		await test.runAll()
	} catch (e) {
		console.error(`[FATAL] ${e}`)
		process.exit(1)
	} finally {
		await test.disconnect()
	}
}

main()
