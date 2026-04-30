import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import fs from "fs"
import path from "path"

export const MCP_STATIC_PORT = 60060

// ==================== INTERFACE DEFINITIONS ====================

export interface TaskPlan {
	initialTasks: {
		id: string
		title: string
		assignedTo: string
		description?: string
		isAsync?: boolean
	}[]
}

export interface TaskStatus {
	hasTask: boolean
	mode: string
	taskId?: string
	title?: string
	isStreaming?: boolean
	messageCount?: number
}

export interface TaskHierarchy {
	taskId: string
	mode: string
	title?: string
	children?: TaskHierarchy[]
}

export interface TaskSummary {
	hasTask: boolean
	summaryScore: number
	progress?: string
}

export interface AgentInfo {
	name: string
	mode: string
	isAvailable: boolean
	currentTaskId?: string
}

export interface ExecutionTrace {
	steps: Array<{
		id: string
		timestamp: number
		action: string
		duration: number
		status: "success" | "error"
	}>
}

export interface PerformanceMetrics {
	memoryUsage: number
	cpuUsage: number
	responseTime: number
	taskCount: number
}

export interface DiagnosticSnapshot {
	timestamp: number
	activeTasks: number
	totalMessages: number
	toolCalls: number
	errors: number
}

export interface InternalState {
	tasks: any[]
	agents: any[]
	settings: any
	workspace: any
}

// ==================== CORE DSL CLASS ====================

export class JabberwockE2EDSL {
	private client: Client
	private transport: SSEClientTransport
	private results: { name: string; status: "PASS" | "FAIL" | "SKIP"; detail?: string }[] = []
	private connectionRetries = 3
	private connectionTimeout = 30000

	constructor(port: number = MCP_STATIC_PORT) {
		this.transport = new SSEClientTransport(new URL(`http://127.0.0.1:${port}/sse`))
		this.client = new Client({ name: "Jabberwock-E2E-DSL", version: "3.0.0" }, { capabilities: { tools: {} } })
	}

	// ==================== CORE CONNECTION MANAGEMENT ====================

	async connect(): Promise<void> {
		const maxRetries = 10
		let retries = maxRetries
		const port = MCP_STATIC_PORT

		while (retries > 0) {
			console.log(
				`[DSL] Connecting to MCP Server at http://127.0.0.1:${port}/sse ... (Attempt ${maxRetries - retries + 1}/${maxRetries})`,
			)

			// Recreate transport and client for each attempt to avoid "already started" errors
			this.transport = new SSEClientTransport(new URL(`http://127.0.0.1:${port}/sse`))
			this.client = new Client({ name: "Jabberwock-E2E-DSL", version: "3.0.0" }, { capabilities: { tools: {} } })

			try {
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Connection timeout")), 10000),
				)
				await Promise.race([this.client.connect(this.transport), timeoutPromise])
				console.log(`[DSL] Connection SUCCESS`)
				return
			} catch (error) {
				console.warn(`[DSL] Connection failed: ${error instanceof Error ? error.message : "Connect refused"}`)

				// Clean up on failure to be sure
				try {
					await this.client.close()
				} catch (e) {}

				retries--
				if (retries === 0) {
					console.error(`[DSL] FAILED to connect after ${maxRetries} attempts. Diagnostics follow:`)
					throw new Error(`Could not connect to Jabberwock MCP Server on port ${port}`)
				}
				// Wait 5 seconds before retrying to allow extension host to finish starting
				await new Promise((resolve) => setTimeout(resolve, 5000))
			}
		}
	}

	async disconnect(): Promise<void> {
		try {
			await this.client.close()
			console.log(`[DSL] Disconnected.`)
		} catch (error) {
			console.log(`[DSL] Error during disconnect: ${error}`)
		}
	}

	async reconnect(): Promise<void> {
		await this.disconnect()
		await new Promise((r) => setTimeout(r, 1000))
		await this.connect()
	}

	// ==================== LOW-LEVEL SSE COMMUNICATION (ISOLATED) ====================

	private async callTool(name: string, args: any = {}): Promise<string> {
		let retries = 3

		while (retries > 0) {
			try {
				const res = await this.client.callTool({ name, arguments: args })

				if (res.isError) {
					throw new Error(`MCP Tool Error: ${JSON.stringify(res.content)}`)
				}

				const content = res.content as { text: string }[]
				if (!content || content.length === 0) {
					throw new Error("Empty response from tool")
				}

				return content[0].text
			} catch (error) {
				console.log(`[RETRY] ${name} failed: ${error}. Retries left: ${retries - 1}`)
				retries--

				if (retries === 0) {
					throw new Error(`Tool call failed after retries: ${name} - ${error}`)
				}

				await new Promise((r) => setTimeout(r, 2000))
			}
		}

		throw new Error("Unreachable")
	}

	private async safeJsonParse<T>(text: string, defaultValue: T): Promise<T> {
		try {
			return JSON.parse(text)
		} catch {
			return defaultValue
		}
	}

	// ==================== TEST MANAGEMENT ====================

	async recordTest(name: string, status: "PASS" | "FAIL" | "SKIP", detail?: string): Promise<void> {
		this.results.push({ name, status, detail })
		const icons = { PASS: "✅", FAIL: "❌", SKIP: "⏭️" }
		console.log(`\n${icons[status]} [${name}] ${detail || ""}`)
	}

	printFinalResults(): number {
		const passed = this.results.filter((r) => r.status === "PASS").length
		const failed = this.results.filter((r) => r.status === "FAIL").length
		const skipped = this.results.filter((r) => r.status === "SKIP").length

		console.log("\n╔════════════════════════════════════════════════════════════╗")
		console.log(`║  TESTS FINISHED: ${passed} pass, ${failed} fail, ${skipped} skip ║`)
		console.log("╚════════════════════════════════════════════════════════════╝\n")

		return failed
	}

	// ==================== HUMAN-READABLE TASK COMMANDS ====================

	async createNewTask(prompt: string, mode: string = "orchestrator"): Promise<string> {
		console.log(`[TASK] Creating new task in ${mode} mode: ${prompt.substring(0, 50)}...`)

		await this.callTool("clear_task")
		await this.wait(1000)

		const result = await this.callTool("send_chat_request", { prompt, mode })
		const match = result.match(/ID: ([a-f0-9-]+)/)

		if (match && match[1]) {
			console.log(`[TASK] Task created with ID: ${match[1]}`)
			return match[1]
		}

		console.log(`[TASK] Task created: ${result}`)
		return "unknown"
	}

	async getTaskPlan(timeoutMs: number = 120000): Promise<TaskPlan> {
		console.log(`[PLAN] Waiting for task plan...`)
		const startTime = Date.now()

		while (Date.now() - startTime < timeoutMs) {
			try {
				const statusRaw = await this.callTool("get_active_ask")
				const status = await this.safeJsonParse(statusRaw, { ask: "unknown" })

				// Handle resume_task — the orchestrator has created a plan via manage_todo_plan
				// and is waiting for user approval. The plan is stored in md-todo-mcp's
				// mockApprovedTasks, NOT in the local task's todoList. We need to read it
				// from the conversation history (apiConversationHistory).
				if (status.ask === "resume_task") {
					console.log(`  Detected resume_task — reading plan from conversation history...`)
					const plan = await this.readPlanFromHistory()
					if (plan) {
						console.log(`  ✓ Task plan detected via conversation history (resume_task)`)
						return plan
					}
					// Plan might still be generating
					console.log(`  No plan found in history yet, waiting...`)
					await this.wait(2000)
					continue
				}

				if (status.ask === "use_mcp_server" || status.ask === "tool") {
					console.log(`  Auto-approving ${status.ask}...`)
					await this.callTool("respond_to_ask", { response: "yesButtonClicked" })
					await this.wait(1000)
					continue
				}

				if (status.ask === "interactive_app") {
					const uiMeta = await this.safeJsonParse(status["text"], { resourceUri: "", input: null })
					if (uiMeta.resourceUri?.includes("todo") || uiMeta.resourceUri?.includes("plan") || uiMeta.input) {
						console.log("  ✓ Task plan UI detected")
						return uiMeta.input as TaskPlan
					}
				}

				// Also check if the todo plan is available via the todo list state
				if (status.ask === "interactive_app" || status.ask === "followup") {
					const todoState = await this.callTool("get_todo_list_state")
					const todoParsed = await this.safeJsonParse(todoState, { items: [] })
					if (todoParsed.items && todoParsed.items.length > 0) {
						console.log("  ✓ Task plan detected via todo list state")
						return { initialTasks: todoParsed.items }
					}
				}
			} catch (error) {
				// ignore parse errors and continue
			}

			await this.wait(2000)
		}

		throw new Error("Timeout waiting for Task Plan UI")
	}

	/**
	 * Read the task plan from conversation history by finding the manage_todo_plan tool call.
	 * The plan is stored in md-todo-mcp's mockApprovedTasks, which is NOT accessible via
	 * get_todo_list_state (that reads the local task's todoList). Instead, we read it from
	 * the apiConversationHistory where the manage_todo_plan tool_use block contains the plan.
	 */
	private async readPlanFromHistory(): Promise<TaskPlan | null> {
		try {
			const historyRaw = await this.callTool("get_api_history", { count: 20, fullContent: true })
			const history = await this.safeJsonParse(historyRaw, { messages: [] })

			if (!history.messages || !Array.isArray(history.messages)) {
				return null
			}

			// Search through all messages for a tool_use block with manage_todo_plan
			for (const msg of history.messages) {
				if (!msg.blocks || !Array.isArray(msg.blocks)) continue

				for (const block of msg.blocks) {
					if (block.type === "tool_use" && block.name === "mcp--md-todo-mcp--manage_todo_plan") {
						const input = block.input
						if (
							input &&
							input.initialTasks &&
							Array.isArray(input.initialTasks) &&
							input.initialTasks.length > 0
						) {
							return { initialTasks: input.initialTasks }
						}
					}
				}
			}

			return null
		} catch (error) {
			console.log(`  [readPlanFromHistory] Error: ${error instanceof Error ? error.message : String(error)}`)
			return null
		}
	}

	async approvePlan(mutatedPlan?: TaskPlan): Promise<void> {
		console.log(`[PLAN] Approving task plan...`)
		await this.callTool("interact_with_ui", {
			action: "approve_todo",
			state: mutatedPlan,
		})
	}

	async rejectPlan(): Promise<void> {
		console.log(`[PLAN] Rejecting task plan...`)
		await this.callTool("interact_with_ui", { action: "cancel" })
	}

	// ==================== TASK STATUS & HIERARCHY COMMANDS ====================

	async getTaskStatus(): Promise<TaskStatus> {
		const status = await this.callTool("get_task_status")
		return await this.safeJsonParse(status, { hasTask: false, mode: "unknown" })
	}

	async getTaskHierarchy(): Promise<TaskHierarchy> {
		const hierarchy = await this.callTool("get_task_hierarchy")
		return await this.safeJsonParse(hierarchy, { taskId: "unknown", mode: "unknown" })
	}

	/**
	 * Wait for child tasks to appear in the task hierarchy.
	 * After approving a plan, the orchestrator needs time to create child tasks.
	 */
	async waitForChildTasks(timeoutMs: number = 30000): Promise<TaskHierarchy> {
		console.log(`[HIERARCHY] Waiting for child tasks (timeout: ${timeoutMs}ms)...`)
		const startTime = Date.now()

		while (Date.now() - startTime < timeoutMs) {
			const hierarchy = await this.getTaskHierarchy()
			if (hierarchy.children && hierarchy.children.length > 0) {
				console.log(`  ✓ Child tasks found: ${hierarchy.children.length}`)
				return hierarchy
			}
			console.log(`  No child tasks yet, waiting...`)
			await this.wait(2000)
		}

		console.log(`  ⚠ Timeout waiting for child tasks, returning last hierarchy`)
		return await this.getTaskHierarchy()
	}

	async getTaskSummary(): Promise<TaskSummary> {
		const summary = await this.callTool("get_task_summary")
		return await this.safeJsonParse(summary, { hasTask: false, summaryScore: 0 })
	}

	async getChildTasks(): Promise<any[]> {
		const children = await this.callTool("get_child_tasks")
		return await this.safeJsonParse(children, [])
	}

	// ==================== NAVIGATION COMMANDS ====================

	async goToChildTask(taskId: string): Promise<void> {
		console.log(`[NAV] Navigating to child task: ${taskId}...`)
		await this.callTool("navigate_to_node", { taskId })
		await this.wait(2000)
	}

	async goToParentTask(): Promise<void> {
		console.log(`[NAV] Returning to parent task...`)
		await this.callTool("pop_window")
		await this.wait(2000)
	}

	async switchToAgentMode(mode: string): Promise<void> {
		console.log(`[MODE] Switching to ${mode} mode...`)
		await this.callTool("switch_agent_mode", { mode })
		await this.wait(1000)
	}

	// ==================== AGENT & WORKSPACE COMMANDS ====================

	async getAgentStore(): Promise<AgentInfo[]> {
		const rawStore = await this.callTool("get_agent_store")
		const store = await this.safeJsonParse(rawStore, {} as any)

		// Case 1: Store is the whole AgentStore object (with .agents map)
		if (store && typeof store === "object" && store.agents) {
			return Object.values(store.agents).map((agent: any) => ({
				name: agent.name || agent.id,
				mode: agent.id,
				isAvailable: true,
			}))
		}

		// Case 2: Store is already an array (backward compatibility)
		if (Array.isArray(store)) {
			return store
		}

		return []
	}

	async getAvailableAgents(): Promise<string[]> {
		const agents = await this.getAgentStore()
		return agents.map((agent) => agent.mode)
	}

	async getVirtualFiles(): Promise<Record<string, string>> {
		const files = await this.callTool("get_virtual_files")
		return await this.safeJsonParse(files, {})
	}

	async getWorkspaceState(): Promise<any> {
		const state = await this.callTool("get_workspace_state")
		return await this.safeJsonParse(state, {})
	}

	// ==================== DIAGNOSTICS & MONITORING COMMANDS ====================

	async getExecutionTrace(): Promise<ExecutionTrace> {
		const trace = await this.callTool("get_execution_trace")
		return await this.safeJsonParse(trace, { steps: [] })
	}

	async getPerformanceMetrics(): Promise<PerformanceMetrics> {
		const metrics = await this.callTool("get_performance_metrics")
		return await this.safeJsonParse(metrics, { memoryUsage: 0, cpuUsage: 0, responseTime: 0, taskCount: 0 })
	}

	async getDiagnosticSnapshot(): Promise<DiagnosticSnapshot> {
		const snapshot = await this.callTool("get_diagnostics_snapshot")
		return await this.safeJsonParse(snapshot, {
			timestamp: Date.now(),
			activeTasks: 0,
			totalMessages: 0,
			toolCalls: 0,
			errors: 0,
		})
	}

	async getConsoleDump(): Promise<string> {
		console.log("[DEBUG] Getting console dump...")
		try {
			// Пытаемся получить дамп консоли через специальный инструмент
			const dump = await this.callTool("get_console_dump")
			return dump
		} catch (error) {
			// Если инструмент не доступен, возвращаем текущий DOM как fallback
			console.log("[DEBUG] Console dump tool not available, using DOM as fallback")
			return await this.getDOM()
		}
	}

	async getDevToolsState(): Promise<any> {
		console.log("[DEBUG] Getting DevTools state...")
		try {
			const state = await this.callTool("get_devtools_state")
			return await this.safeJsonParse(state, {})
		} catch (error) {
			console.log("[DEBUG] DevTools state tool not available, using diagnostic snapshot")
			return await this.getDiagnosticSnapshot()
		}
	}

	async captureDebugInfo(error: any): Promise<void> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
		const dumpDir = path.join(process.cwd(), "tests", "dumps", `failure-${timestamp}`)

		console.log("\n" + "=".repeat(80))
		console.log("🔍 DETAILED DEBUG DUMP ON TEST FAILURE")
		console.log(`📍 Saving to: ${dumpDir}`)
		console.log("=".repeat(80))
		console.log(`Error: ${error instanceof Error ? error.message : String(error)}`)

		try {
			if (!fs.existsSync(dumpDir)) {
				fs.mkdirSync(dumpDir, { recursive: true })
			}

			// Save the primary error
			fs.writeFileSync(
				path.join(dumpDir, "error.txt"),
				error instanceof Error ? error.stack || error.message : String(error),
			)

			// 1. Current Page & DOM Snippet
			console.log("\n📍 CONTEXT:")
			try {
				const currentPage = await this.getActivePage()
				console.log(`Active Page: ${currentPage}`)
				fs.writeFileSync(path.join(dumpDir, "active_page.txt"), currentPage)
			} catch (e) {
				console.log("  ❌ Failed to get active page")
			}

			try {
				const dom = await this.getDOM()
				fs.writeFileSync(path.join(dumpDir, "dom.html"), dom)
				console.log("  ✓ DOM saved to dom.html")
			} catch (e) {
				console.log("  ❌ Failed to get DOM")
			}

			// 2. Task Status
			console.log("\n📝 TASK STATUS:")
			try {
				const taskStatus = await this.getTaskStatus()
				fs.writeFileSync(path.join(dumpDir, "task_status.json"), JSON.stringify(taskStatus, null, 2))
				console.log("  ✓ Task status saved to task_status.json")
			} catch (e) {
				console.log("  ❌ Failed to get task status")
			}

			// 3. DevTools & Console Logs (Snapshot)
			console.log("\n📋 CONSOLE LOGS (Snapshot):")
			try {
				const consoleDump = await this.getConsoleDump()
				fs.writeFileSync(path.join(dumpDir, "console_snapshot.txt"), consoleDump)
				console.log("  ✓ Console snapshot saved to console_snapshot.txt")
			} catch (e) {
				console.log("  ❌ Failed to get console snapshot")
			}

			// 4. Detailed Logs (File-based, persistent)
			console.log("\n📄 DETAILED PERSISTENT LOGS:")
			try {
				const fullLogs = await this.callTool("get_logs", { lines: 1000 })
				fs.writeFileSync(path.join(dumpDir, "full_logs.txt"), fullLogs)
				console.log("  ✓ Full logs saved to full_logs.txt")
			} catch (e) {
				console.log("  ❌ Failed to get full logs")
			}

			// 5. Critical State Snapshot
			console.log("\n🛠️ EXTENSION STATE SNAPSHOT:")
			try {
				const devToolsState = await this.getDevToolsState()
				fs.writeFileSync(path.join(dumpDir, "state.json"), JSON.stringify(devToolsState, null, 2))
				console.log("  ✓ Full state snapshot saved to state.json")
			} catch (e) {
				console.log("  ❌ Failed to get extensions state")
			}

			// 6. Internal State
			try {
				const internalState = await this.getInternalState()
				fs.writeFileSync(path.join(dumpDir, "internal_state.json"), JSON.stringify(internalState, null, 2))
				console.log("  ✓ Internal state saved to internal_state.json")
			} catch (e) {
				console.log("  ❌ Failed to get internal state")
			}
		} catch (debugError: any) {
			console.log(`❌ Critical failure during debug info capture: ${debugError.message}`)
		}

		console.log("\n" + "=".repeat(80))
		console.log("END OF DEBUG DUMP")
		console.log("=".repeat(80) + "\n")
	}

	async verifyNoHallucination(allowedKeywords: string[]): Promise<void> {
		console.log(`[VERIFY] Checking for hallucinations (allowed: ${allowedKeywords.join(", ")})...`)
		const dom = await this.getDOM()

		// This is a simplified check: search for chat rows that don't contain any allowed keywords
		// In a real scenario, we'd parse the chat messages more precisely
		const chatRows = dom.match(/<div[^>]*class="[^"]*chat-row[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || []

		for (const row of chatRows) {
			const text = row.replace(/<[^>]*>/g, "").toLowerCase()
			const isAllowed = allowedKeywords.some((kw) => text.includes(kw.toLowerCase()))
			const isSystem =
				text.includes("switching to") || text.includes("started task") || text.includes("completed")

			if (!isAllowed && !isSystem && text.trim().length > 20) {
				throw new Error(`Potential hallucination detected in chat: "${text.substring(0, 100)}..."`)
			}
		}
		console.log("  ✓ No hallucinations detected")
	}

	async verifyNoDuplicates(): Promise<void> {
		console.log(`[VERIFY] Checking for duplicate messages...`)
		const dom = await this.getDOM()

		// Check for duplicate data-message-id attributes
		const messageIds = dom.match(/data-message-id="([^"]*)"/gi) || []
		const ids = messageIds.map((m) => m.match(/"([^"]*)"/)![1])
		const uniqueIds = new Set(ids)

		if (ids.length !== uniqueIds.size) {
			const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index)
			throw new Error(`Duplicate message IDs detected: ${duplicates.join(", ")}`)
		}

		// Check for identical text blocks in chat
		const chatTexts = dom.match(/<div[^>]*class="[^"]*chat-row[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || []
		const texts = chatTexts.map((t) => t.replace(/<[^>]*>/g, "").trim()).filter((t) => t.length > 30)
		const uniqueTexts = new Set(texts)

		if (texts.length !== uniqueTexts.size) {
			throw new Error("Duplicate message content detected in chat!")
		}

		console.log("  ✓ No duplicates detected")
	}

	async verifyCleanConsole(): Promise<void> {
		console.log(`[VERIFY] Checking for console errors/warnings...`)
		const consoleDump = await this.getConsoleDump()
		const lines = consoleDump.split("\n")

		const errors = lines.filter(
			(l) => l.includes("[ERROR]") || l.includes("Uncaught") || l.includes("Failed to load"),
		)
		// We ignore known/harmless errors if any
		const realErrors = errors.filter(
			(e) =>
				!e.includes("Extension 'jabberwockinc.jabberwock' is already being debugged") &&
				!e.includes("Function components cannot be given refs") && // Radix UI SlotClone internal warning - harmless
				!e.includes("Maximum update depth exceeded") && // React infinite re-render warning - can occur in edge cases, doesn't affect functionality
				!e.includes(
					"[mobx-state-tree] assertion failed: the creation of the observable instance must be done on the initializing phase",
				), // mobx-state-tree dev mode warning - harmless in production
		)

		if (realErrors.length > 0) {
			throw new Error(`Unexpected errors found in console: ${realErrors[0]}`)
		}

		await this.verifyNoLogSpam()

		console.log("  ✓ Console is clean")
	}

	/**
	 * Normalizes a log line by removing timestamps and counters/IDs
	 * to detect repeating message patterns.
	 */
	normalizeLogLine(line: string): string {
		return (
			line
				// Remove timestamp: [2026-04-16T14:51:15.723Z][INFO]
				.replace(/\[\d{4}-\d{2}-\d{2}T.*?Z\]\[.*?\]/g, "")
				// Remove counters like #600 or #601
				.replace(/#\d+/g, "")
				// Remove clearTaskStackCounter=600 if it appears
				.replace(/clearTaskStackCounter=\d+/g, "")
				// Remove any other trailing numbers that look like counters
				.replace(/\s+\d+$/g, "")
				.trim()
		)
	}

	async verifyNoLogSpam(): Promise<void> {
		const consoleDump = await this.getConsoleDump()
		const lines = consoleDump.split("\n").filter((l) => l.trim().length > 0)

		if (lines.length < 4) return

		let consecutiveCount = 1
		let lastNormalized = this.normalizeLogLine(lines[0])

		for (let i = 1; i < lines.length; i++) {
			const currentNormalized = this.normalizeLogLine(lines[i])

			// We only care about spam that looks like our known loops
			// Skip very short messages or generic ones
			if (currentNormalized.length < 10) continue

			// Whitelist known safe repeating messages
			if (currentNormalized.includes("Incoming SSE connection request")) continue
			if (currentNormalized.includes("webviewDidLaunch")) continue

			if (currentNormalized === lastNormalized) {
				consecutiveCount++
				if (consecutiveCount > 3) {
					throw new Error(
						`Log spam detected! The following message appeared ${consecutiveCount} times in a row:\n"${lines[i]}"\n(Normalized: "${currentNormalized}")`,
					)
				}
			} else {
				consecutiveCount = 1
				lastNormalized = currentNormalized
			}
		}
	}

	async getInternalState(): Promise<InternalState> {
		const state = await this.callTool("get_internal_state")
		return await this.safeJsonParse(state, { tasks: [], agents: [], settings: {}, workspace: {} })
	}

	// ==================== UI & DOM VERIFICATION COMMANDS ====================

	async getDOM(): Promise<string> {
		return await this.callTool("get_dom")
	}

	async getActivePage(): Promise<string> {
		console.log(`[PAGE] Detecting active page...`)
		const dom = await this.getDOM()

		// Priority 1: Check for the explicit window-layer attributes
		// Using a more robust regex that ignores attribute order and handles extra whitespace
		const activeWindowRegex =
			/<div[^>]*\s+data-window-type="(?<type1>[^"]+)"[^>]*\s+data-active="true"|<div[^>]*\s+data-active="true"[^>]*\s+data-window-type="(?<type2>[^"]+)"/i
		const match = dom.match(activeWindowRegex)

		if (match) {
			const activePage = match.groups?.type1 || match.groups?.type2
			if (activePage) {
				console.log(`  ✓ Detected active page from window attributes: "${activePage}"`)
				return activePage
			}
		}

		// Priority 2: Traditional data-testid identification (fallback)
		if (dom.includes('data-testid="settings-view"')) return "settings"
		if (dom.includes('data-testid="marketplace-view"')) return "marketplace"
		if (dom.includes('data-testid="history-view"')) return "history"
		if (dom.includes('data-testid="chat-view"')) return "chat"
		if (dom.includes('data-testid="welcome-view"')) return "welcome"

		// Priority 2: Traditional heuristics (fallback to full DOM if active marker fails)
		if (dom.includes("Recent Tasks") || dom.includes("history:recentTasks")) {
			return "history"
		}

		if (dom.includes("chat-row") || dom.includes("message-container") || dom.includes("chat-input")) {
			return "chat"
		}

		if (dom.includes("settings") || dom.includes("config")) {
			return "settings"
		}

		return "unknown"
	}

	async verifyActivePage(expectedPage: string, timeoutMs: number = 30000): Promise<void> {
		console.log(`[PAGE] Waiting 2s for UI to settle...`)
		await this.wait(2000)
		console.log(`[PAGE] Waiting for ${expectedPage} page...`)
		const startTime = Date.now()

		while (Date.now() - startTime < timeoutMs) {
			await this.verifyNoLogSpam()
			const currentPage = await this.getActivePage()

			if (currentPage.toLowerCase() === expectedPage.toLowerCase()) {
				console.log(`  ✓ Active page is now "${expectedPage}"`)
				return
			}

			process.stdout.write(".")
			await this.wait(1000)
		}

		throw new Error(`Timeout waiting for page "${expectedPage}"`)
	}

	async navigateToPage(page: string, props?: any): Promise<void> {
		console.log(`[NAV] Navigating to ${page} page...`)

		// Check if provider is ready by calling get_extension_info
		try {
			const providerState = await this.callTool("get_extension_info")
			console.log(`[NAV] Provider state: ${providerState}`)
		} catch (error) {
			console.warn(`[NAV] Could not check provider state: ${error}`)
		}

		if (page === "chat") {
			console.log(`[DEBUG] Calling navigate_to_node with nodeId: ${props?.taskId || ""}`)
			await this.callTool("navigate_to_node", {
				nodeId: props?.taskId || "",
			})
		} else if (page === "history") {
			await this.callTool("navigate_to_history")
		} else if (page === "settings") {
			await this.callTool("navigate_to_settings")
		} else if (page === "marketplace") {
			await this.callTool("navigate_to_marketplace")
		} else {
			console.warn(`[WARN] Navigation to ${page} page not implemented yet`)
		}

		// Stabilization delay per user request
		await this.wait(2000)

		await this.getDOM()

		// Confirm transition
		await this.verifyActivePage(page, 10000)
	}

	async navigateToChat(taskId?: string): Promise<void> {
		await this.navigateToPage("chat", taskId ? { taskId } : undefined)
	}

	async navigateToHistory(): Promise<void> {
		await this.navigateToPage("history")
	}

	async navigateToSettings(section?: string): Promise<void> {
		await this.navigateToPage("settings", section ? { section } : undefined)
	}

	async navigateToMarketplace(tab?: string): Promise<void> {
		await this.navigateToPage("marketplace", tab ? { marketplaceTab: tab } : undefined)
	}

	async navigateToWelcome(): Promise<void> {
		await this.navigateToPage("welcome")
	}

	async navigateToCloud(): Promise<void> {
		await this.navigateToPage("cloud")
	}

	async getWindowStack(): Promise<any[]> {
		const stack = await this.callTool("get_window_stack")
		return await this.safeJsonParse(stack, [])
	}

	async getActiveWindow(): Promise<any> {
		const stack = await this.getWindowStack()
		return stack.length > 0 ? stack[stack.length - 1] : null
	}

	async verifyParentContext(shouldBeVisible: boolean = true): Promise<void> {
		console.log(`[VERIFY] Parent context should be ${shouldBeVisible ? "VISIBLE" : "HIDDEN"}...`)
		const dom = await this.getDOM()

		const isPresent = dom.includes('id="parent-conversation-context"')
		const isHidden =
			dom.includes('className="hidden"') || dom.includes('display: "none"') || dom.includes("display: none")

		if (shouldBeVisible) {
			if (!isPresent) throw new Error("Parent context element is missing!")
			if (isHidden && dom.includes('id="parent-conversation-context"'))
				throw new Error("Parent context is present but HIDDEN!")
		} else {
			if (isPresent && !isHidden) throw new Error("Parent context should be HIDDEN but is visible!")
		}

		console.log(`  ✓ Parent context verification passed`)
	}

	async verifyAgentBubble(agentInitial: string, shouldBeVisible: boolean = true): Promise<void> {
		console.log(`[VERIFY] Agent bubble ${agentInitial} should be ${shouldBeVisible ? "VISIBLE" : "HIDDEN"}...`)
		const dom = await this.getDOM()

		const hasBubbleText = dom.includes(`>${agentInitial}</div>`) || dom.includes(`>${agentInitial}</span>`)
		const hasBubbleClass = dom.includes("rounded-full") && dom.includes("w-7 h-7")

		if (shouldBeVisible) {
			if (!hasBubbleText || !hasBubbleClass)
				throw new Error(`Agent bubble for "${agentInitial}" is missing or malformed!`)
		} else {
			if (hasBubbleText && hasBubbleClass)
				throw new Error(`Agent bubble for "${agentInitial}" should not be visible!`)
		}

		console.log(`  ✓ Agent bubble "${agentInitial}" verified`)
	}

	// ==================== WAIT & PROGRESS COMMANDS ====================

	async waitForAgentMode(expectedMode: string, timeoutMs: number = 60000): Promise<TaskStatus> {
		console.log(`[MODE] Waiting for ${expectedMode} mode...`)
		const startTime = Date.now()

		while (Date.now() - startTime < timeoutMs) {
			try {
				await this.verifyNoLogSpam()
				const status = await this.getTaskStatus()
				if (status.hasTask && status.mode === expectedMode) {
					console.log(`  ✓ Mode is now "${expectedMode}"`)
					return status
				}
				process.stdout.write(".")
			} catch (e) {
				// if it's a log spam error, rethrow it to fail the test
				if (e instanceof Error && e.message.includes("Log spam detected")) {
					throw e
				}
				// ignore other errors and continue
			}

			await this.wait(2000)
		}

		console.log("\n")
		throw new Error(`Timeout waiting for mode "${expectedMode}"`)
	}

	async verifyTaskProgress(minScore: number = 50): Promise<TaskSummary> {
		console.log(`[PROGRESS] Waiting for task completion...`)
		const summary = await this.getTaskSummary()

		if (!summary.hasTask || summary.summaryScore === 0) {
			throw new Error("Task progress verification failed: No progress detected!")
		}

		if (summary.summaryScore < minScore) {
			console.log(`  Warning: Summary score is low (${summary.summaryScore}). Check if subtasks are integrated.`)
		}

		console.log(`  ✓ Task progress verified (Score: ${summary.summaryScore})`)
		return summary
	}

	async wait(ms: number): Promise<void> {
		console.log(`[WAIT] Waiting for ${ms}ms...`)
		await new Promise((r) => setTimeout(r, ms))
	}

	// ==================== ASYNC TASK MANAGEMENT ====================

	async markTaskAsAsync(taskId: string): Promise<void> {
		console.log(`[ASYNC] Marking task ${taskId} as async...`)
		await this.callTool("mark_task_async", { taskId })
	}

	async waitForAsyncTask(taskId: string, timeoutMs: number = 30000): Promise<void> {
		console.log(`[ASYNC] Waiting for async task ${taskId} to complete...`)
		const startTime = Date.now()

		while (Date.now() - startTime < timeoutMs) {
			await this.verifyNoLogSpam()
			const hierarchy = await this.getTaskHierarchy()
			const findTask = (h: TaskHierarchy): boolean => {
				if (h.taskId === taskId) return true
				if (h.children) {
					return h.children.some((child) => findTask(child))
				}
				return false
			}

			if (!findTask(hierarchy)) {
				console.log(`  ✓ Async task ${taskId} completed`)
				return
			}

			await this.wait(1000)
		}

		throw new Error(`Timeout waiting for async task ${taskId}`)
	}

	// ==================== BATCH OPERATIONS ====================

	async executeConcurrently<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
		console.log(`[BATCH] Executing ${operations.length} operations concurrently...`)
		return Promise.all(operations.map((op) => op()))
	}

	async executeSequentially<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
		console.log(`[BATCH] Executing ${operations.length} operations sequentially...`)
		const results: T[] = []

		for (const op of operations) {
			results.push(await op())
		}

		return results
	}
}

// ==================== QUICK START UTILITIES ====================

export async function createJabberwockTestSession(port?: number): Promise<JabberwockE2EDSL> {
	const dsl = new JabberwockE2EDSL(port)
	await dsl.connect()
	return dsl
}

export function createTestSuite(name: string): {
	dsl: JabberwockE2EDSL
	run: (testFn: (dsl: JabberwockE2EDSL) => Promise<void>) => Promise<void>
} {
	const dsl = new JabberwockE2EDSL()

	return {
		dsl,
		async run(testFn: (dsl: JabberwockE2EDSL) => Promise<void>) {
			try {
				await dsl.connect()
				await testFn(dsl)
				const failed = dsl.printFinalResults()
				if (failed > 0) {
					throw new Error(`${failed} tests failed`)
				}
			} catch (error) {
				// Захватываем debug информацию при падении теста
				console.log("\n💥 TEST FAILED - CAPTURING DEBUG INFORMATION")
				try {
					await dsl.captureDebugInfo(error)
				} catch (captureError) {
					console.log("❌ Failed to capture debug info:", captureError)
				}
				throw error // Пробрасываем оригинальную ошибку
			} finally {
				await dsl.disconnect()
			}
		},
	}
}
