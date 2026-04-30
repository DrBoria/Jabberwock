/**
 * Phase 2 Test: AgentStore with RBAC (Role-Based Access Control)
 *
 * This test validates the unified agent management and tool permission system
 * as specified in new-way.md Phase 2.
 */

import { describe, it, expect } from "vitest"
import { getSnapshot } from "mobx-state-tree"
import { AgentStore, ToolConfig, AgentProfile } from "../AgentStore"

describe("Phase 2: AgentStore with RBAC (Role-Based Access Control)", () => {
	it("initializes default tools and agents in afterCreate", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		// Verify default tools were registered
		expect(store.tools.size).toBeGreaterThan(0)

		// Check for key tools
		const writeToFileTool = store.tools.get("write_to_file")
		expect(writeToFileTool).toBeDefined()
		expect(writeToFileTool?.name).toBe("Write to File")
		expect(writeToFileTool?.isEnabled).toBe(true)

		// Verify default agents were registered
		expect(store.agents.size).toBeGreaterThan(0)

		const orchestrator = store.agents.get("orchestrator")
		expect(orchestrator).toBeDefined()
		expect(orchestrator?.name).toBe("Orchestrator")
		expect(orchestrator?.role).toBe("Coordinator")

		const coder = store.agents.get("coder")
		expect(coder).toBeDefined()
		expect(coder?.name).toBe("Coder")
	})

	it("canUseTool returns true when agent has permission and tool is enabled", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		const coder = store.agents.get("coder")
		expect(coder).toBeDefined()

		// Coder should have access to write_to_file by default
		if (coder) {
			expect(coder.canUseTool("write_to_file")).toBe(true)
			expect(coder.canUseTool("read_file")).toBe(true)
			expect(coder.canUseTool("execute_command")).toBe(true)
		}
	})

	it("canUseTool returns false when agent does not have the tool in allowedTools", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		const architect = store.agents.get("architect")

		// Architect might not exist by default, so test with orchestrator
		// who should NOT have write_to_file permission
		const orchestrator = store.agents.get("orchestrator")
		expect(orchestrator).toBeDefined()

		if (orchestrator) {
			// Orchestrator should NOT be able to write files
			expect(orchestrator.canUseTool("write_to_file")).toBe(false)

			// But SHOULD be able to manage todo plan
			expect(orchestrator.canUseTool("manage_todo_plan")).toBe(true)
		}
	})

	it("toggling tool isEnabled affects canUseTool for all agents", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		const coder = store.agents.get("coder")
		expect(coder).toBeDefined()

		if (coder) {
			// Initially enabled
			expect(coder.canUseTool("read_file")).toBe(true)

			// Find the tool and disable it
			const readFileTool = store.tools.get("read_file")
			expect(readFileTool).toBeDefined()

			if (readFileTool) {
				readFileTool.toggle() // Disable it
				expect(readFileTool.isEnabled).toBe(false)

				// Now coder should NOT be able to use it
				expect(coder.canUseTool("read_file")).toBe(false)

				// Re-enable it
				readFileTool.toggle()
				expect(readFileTool.isEnabled).toBe(true)

				// Coder can use it again
				expect(coder.canUseTool("read_file")).toBe(true)
			}
		}
	})

	it("registerTool adds new tool to the store", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		const initialSize = store.tools.size

		store.registerTool("custom_tool", "Custom Tool")

		expect(store.tools.size).toBe(initialSize + 1)

		const customTool = store.tools.get("custom_tool")
		expect(customTool).toBeDefined()
		expect(customTool?.name).toBe("Custom Tool")
		expect(customTool?.isEnabled).toBe(true)

		// Registering same tool again should not duplicate
		store.registerTool("custom_tool", "Another Name")
		expect(store.tools.size).toBe(initialSize + 1) // Still the same
		expect(customTool?.name).toBe("Custom Tool") // Original name preserved
	})

	it("registerAgent adds new agent with specified tools", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		store.registerAgent({
			id: "tester",
			name: "Tester",
			role: "QA Engineer",
			systemPrompt: "You are a QA engineer who writes tests.",
			allowedTools: ["read_file", "execute_command"],
		})

		const tester = store.agents.get("tester")
		expect(tester).toBeDefined()
		expect(tester?.name).toBe("Tester")
		expect(tester?.role).toBe("QA Engineer")

		if (tester) {
			expect(tester.canUseTool("read_file")).toBe(true)
			expect(tester.canUseTool("execute_command")).toBe(true)
			expect(tester.canUseTool("write_to_file")).toBe(false) // Not in allowedTools
		}
	})

	it("produces normalized MST snapshot for agents and tools", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		const snapshot = getSnapshot(store)

		expect(snapshot.tools).toBeDefined()
		expect(snapshot.agents).toBeDefined()

		// Tools should be in a map structure
		expect(Object.keys(snapshot.tools).length).toBeGreaterThan(0)

		// Agents should reference tools by ID
		const coderSnapshot = snapshot.agents["coder"]
		expect(coderSnapshot).toBeDefined()
		expect(Array.isArray(coderSnapshot.allowedTools)).toBe(true)
	})

	it("designer agent has appropriate tool restrictions", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		const designer = store.agents.get("designer")
		expect(designer).toBeDefined()

		if (designer) {
			// Designer should have analyze_image
			expect(designer.canUseTool("analyze_image")).toBe(true)

			// Designer should NOT have execute_command (terminal access)
			expect(designer.canUseTool("execute_command")).toBe(false)

			// Designer should NOT have write_to_file
			expect(designer.canUseTool("write_to_file")).toBe(false)
		}
	})

	it("setEnabled method works correctly", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		const tool = store.tools.get("think_tool")
		expect(tool).toBeDefined()

		if (tool) {
			// Initially enabled
			expect(tool.isEnabled).toBe(true)

			tool.setEnabled(false)
			expect(tool.isEnabled).toBe(false)

			tool.setEnabled(true)
			expect(tool.isEnabled).toBe(true)
		}
	})

	it("coder agent has full development tool access", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		const coder = store.agents.get("coder")
		expect(coder).toBeDefined()

		if (coder) {
			// Coder should have comprehensive tool access
			expect(coder.canUseTool("write_to_file")).toBe(true)
			expect(coder.canUseTool("read_file")).toBe(true)
			expect(coder.canUseTool("list_files")).toBe(true)
			expect(coder.canUseTool("execute_command")).toBe(true)
			expect(coder.canUseTool("search_files")).toBe(true)
		}
	})

	it("orchestrator agent has delegation-focused tool access", () => {
		const store = AgentStore.create({ tools: {}, agents: {} })

		const orchestrator = store.agents.get("orchestrator")
		expect(orchestrator).toBeDefined()

		if (orchestrator) {
			// Orchestrator should have delegation tools
			expect(orchestrator.canUseTool("delegate_task")).toBe(true)
			expect(orchestrator.canUseTool("manage_todo_plan")).toBe(true)

			// Should be able to read and search for context
			expect(orchestrator.canUseTool("read_file")).toBe(true)
			expect(orchestrator.canUseTool("search_files")).toBe(true)
			expect(orchestrator.canUseTool("list_files")).toBe(true)

			// Should NOT have execution tools
			expect(orchestrator.canUseTool("write_to_file")).toBe(false)
			expect(orchestrator.canUseTool("execute_command")).toBe(false)
		}
	})
})
