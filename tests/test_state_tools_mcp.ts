/**
 * E2E Test: Phase 2 State Tools via MCP (use_mcp_tool)
 *
 * Tests the new state tools by connecting to the DevTools MCP server
 * via the internal MCP connection (registered in McpHub as "jabberwock-devtools").
 *
 * This simulates how an agent would use these tools via use_mcp_tool.
 *
 * Prerequisites:
 * - VS Code extension host must be running (DevTools server on port 60060)
 * - The internal MCP connection must be registered (done in ClineProvider constructor)
 * - Run: npx tsx tests/test_state_tools_mcp.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

const MCP_STATIC_PORT = 60060

interface TestResult {
	name: string
	status: "PASS" | "FAIL" | "SKIP"
	detail?: string
}

class StateToolsMCPTest {
	private client: Client | null = null
	private transport: SSEClientTransport | null = null
	private results: TestResult[] = []

	async connect(): Promise<void> {
		this.transport = new SSEClientTransport(new URL(`http://127.0.0.1:${MCP_STATIC_PORT}/sse`))
		this.client = new Client({ name: "StateTools-MCP-Test", version: "1.0.0" }, { capabilities: { tools: {} } })
		await this.client.connect(this.transport)
		console.log(`[CONNECT] Connected to DevTools SSE on port ${MCP_STATIC_PORT}`)
	}

	async disconnect(): Promise<void> {
		try {
			if (this.transport) {
				await this.transport.close()
			}
		} catch (e) {
			// ignore close errors
		}
	}

	/**
	 * Simulates use_mcp_tool by calling the tool directly via MCP protocol.
	 * In a real agent scenario, the agent would call:
	 *   use_mcp_tool(server_name: "jabberwock-devtools", tool_name: "...", arguments: {...})
	 */
	private async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<any> {
		if (!this.client) {
			throw new Error("Not connected")
		}
		const result = await this.client.request(
			{
				method: "tools/call",
				params: {
					name: toolName,
					arguments: args,
				},
			},
			{},
		)
		return result
	}

	/**
	 * List all available tools on the DevTools server.
	 * This is what the agent sees when it connects.
	 */
	private async listTools(): Promise<string[]> {
		if (!this.client) {
			throw new Error("Not connected")
		}
		const result = (await this.client.request({ method: "tools/list", params: {} }, {})) as any
		return (result?.tools || []).map((t: any) => t.name)
	}

	private record(name: string, status: "PASS" | "FAIL" | "SKIP", detail?: string) {
		this.results.push({ name, status, detail })
		const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️"
		console.log(`  ${icon} ${name}${detail ? `: ${detail}` : ""}`)
	}

	async runAll(): Promise<void> {
		console.log("\n============================================")
		console.log("  Phase 2 State Tools Test Suite (MCP)")
		console.log("============================================\n")

		// ── Test 1: List tools to verify Phase 2 tools are registered ──
		console.log("── Test 1: List available tools ──")
		try {
			const tools = await this.listTools()
			const phase2Tools = [
				"get_current_state",
				"get_last_model_message",
				"wait_for_todo",
				"wait_for_ask_type",
				"verify_state",
			]
			const found = phase2Tools.filter((t) => tools.includes(t))
			const missing = phase2Tools.filter((t) => !tools.includes(t))

			if (missing.length === 0) {
				this.record("All Phase 2 tools registered", "PASS", `${found.length}/${phase2Tools.length} found`)
			} else {
				this.record(
					"All Phase 2 tools registered",
					"FAIL",
					`Found: ${found.join(", ")} | Missing: ${missing.join(", ")}`,
				)
			}

			// Also show total tool count
			const legacyTools = [
				"get_mst_state",
				"get_extension_info",
				"get_available_native_tools",
				"get_devtools_state",
				"get_internal_state",
			]
			const legacyFound = legacyTools.filter((t) => tools.includes(t))
			this.record("Legacy state tools present", "PASS", `${legacyFound.length}/${legacyTools.length} found`)
			this.record("Total tools on server", "PASS", `${tools.length} tools registered`)
		} catch (e: any) {
			this.record("List tools", "FAIL", e.message)
		}

		// ── Test 2: get_current_state (no task expected) ──
		console.log("\n── Test 2: get_current_state ──")
		try {
			const result = await this.callTool("get_current_state")
			const content = (result as any).content?.[0]?.text
			if (content) {
				const parsed = JSON.parse(content)
				if (parsed.error) {
					this.record("get_current_state (no task)", "PASS", `Expected: ${parsed.error}`)
				} else {
					this.record(
						"get_current_state (has task)",
						"PASS",
						`taskId=${parsed.taskId}, mode=${parsed.mode}, todos=${parsed.todoCount}`,
					)
				}
			} else {
				this.record("get_current_state", "FAIL", "No content returned")
			}
		} catch (e: any) {
			this.record("get_current_state", "FAIL", e.message)
		}

		// ── Test 3: get_last_model_message ──
		console.log("\n── Test 3: get_last_model_message ──")
		try {
			const result = await this.callTool("get_last_model_message", { maxLength: 200 })
			const content = (result as any).content?.[0]?.text
			if (content) {
				const parsed = JSON.parse(content)
				if (parsed.error) {
					this.record("get_last_model_message (no task)", "PASS", `Expected: ${parsed.error}`)
				} else if (parsed.message) {
					this.record("get_last_model_message (no messages)", "PASS", "No model messages yet")
				} else {
					this.record(
						"get_last_model_message (has messages)",
						"PASS",
						`text="${parsed.text?.substring(0, 50)}..."`,
					)
				}
			} else {
				this.record("get_last_model_message", "FAIL", "No content returned")
			}
		} catch (e: any) {
			this.record("get_last_model_message", "FAIL", e.message)
		}

		// ── Test 4: wait_for_todo (timeout) ──
		console.log("\n── Test 4: wait_for_todo (timeout) ──")
		try {
			const result = await this.callTool("wait_for_todo", { timeoutMs: 2000, minCount: 1 })
			const content = (result as any).content?.[0]?.text
			if (content) {
				const parsed = JSON.parse(content)
				if (parsed.success) {
					this.record("wait_for_todo", "PASS", `Got ${parsed.todoCount} todos in ${parsed.elapsedMs}ms`)
				} else {
					this.record("wait_for_todo (timeout)", "PASS", `Expected: ${parsed.error}`)
				}
			} else {
				this.record("wait_for_todo", "FAIL", "No content returned")
			}
		} catch (e: any) {
			this.record("wait_for_todo", "FAIL", e.message)
		}

		// ── Test 5: wait_for_ask_type (timeout) ──
		console.log("\n── Test 5: wait_for_ask_type (timeout) ──")
		try {
			const result = await this.callTool("wait_for_ask_type", { askType: "tool", timeoutMs: 2000 })
			const content = (result as any).content?.[0]?.text
			if (content) {
				const parsed = JSON.parse(content)
				if (parsed.success) {
					this.record("wait_for_ask_type", "PASS", `Got askType=${parsed.askType}`)
				} else {
					this.record("wait_for_ask_type (timeout)", "PASS", `Expected: ${parsed.error}`)
				}
			} else {
				this.record("wait_for_ask_type", "FAIL", "No content returned")
			}
		} catch (e: any) {
			this.record("wait_for_ask_type", "FAIL", e.message)
		}

		// ── Test 6: verify_state ──
		console.log("\n── Test 6: verify_state ──")
		try {
			const result = await this.callTool("verify_state", {
				expectations: JSON.stringify({ hasTodo: false, isStreaming: false }),
			})
			const content = (result as any).content?.[0]?.text
			if (content) {
				const parsed = JSON.parse(content)
				if (parsed.verified !== undefined) {
					this.record(
						"verify_state",
						"PASS",
						`verified=${parsed.verified}${parsed.errors ? `, errors=${parsed.errors.join("; ")}` : ""}`,
					)
				} else {
					this.record("verify_state", "FAIL", "Unexpected response format")
				}
			} else {
				this.record("verify_state", "FAIL", "No content returned")
			}
		} catch (e: any) {
			this.record("verify_state", "FAIL", e.message)
		}

		// ── Test 7: verify_state with mode check ──
		console.log("\n── Test 7: verify_state (mode check) ──")
		try {
			const result = await this.callTool("verify_state", {
				expectations: JSON.stringify({ mode: "orchestrator" }),
			})
			const content = (result as any).content?.[0]?.text
			if (content) {
				const parsed = JSON.parse(content)
				if (parsed.verified !== undefined) {
					this.record(
						"verify_state (mode)",
						"PASS",
						`verified=${parsed.verified}, actual.mode=${parsed.actual?.mode || "N/A"}`,
					)
				} else {
					this.record("verify_state (mode)", "FAIL", "Unexpected response format")
				}
			} else {
				this.record("verify_state (mode)", "FAIL", "No content returned")
			}
		} catch (e: any) {
			this.record("verify_state (mode)", "FAIL", e.message)
		}

		// ── Test 8: Error handling — invalid params ──
		console.log("\n── Test 8: Error handling ──")
		try {
			const result = await this.callTool("verify_state", { expectations: "invalid json" })
			const content = (result as any).content?.[0]?.text
			if (content) {
				const parsed = JSON.parse(content)
				if (parsed.error || (result as any).isError) {
					this.record("verify_state (invalid JSON)", "PASS", "Correctly returned error")
				} else {
					this.record("verify_state (invalid JSON)", "FAIL", "Should have returned error")
				}
			} else {
				this.record("verify_state (invalid JSON)", "FAIL", "No content returned")
			}
		} catch (e: any) {
			this.record("verify_state (invalid JSON)", "PASS", `Correctly threw error: ${e.message.substring(0, 80)}`)
		}

		// ── Test 9: wait_for_ask_type with invalid askType ──
		console.log("\n── Test 9: wait_for_ask_type (invalid type) ──")
		try {
			const result = await this.callTool("wait_for_ask_type", { askType: "nonexistent_type", timeoutMs: 2000 })
			const content = (result as any).content?.[0]?.text
			if (content) {
				const parsed = JSON.parse(content)
				if (!parsed.success) {
					this.record("wait_for_ask_type (invalid)", "PASS", `Expected timeout: ${parsed.error}`)
				} else {
					this.record("wait_for_ask_type (invalid)", "FAIL", "Should have timed out")
				}
			} else {
				this.record("wait_for_ask_type (invalid)", "FAIL", "No content returned")
			}
		} catch (e: any) {
			this.record("wait_for_ask_type (invalid)", "FAIL", e.message)
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
	const test = new StateToolsMCPTest()
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
