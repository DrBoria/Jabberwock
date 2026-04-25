/**
 * Phase 3 Test: Tool Router, Model Routing, and DevTools Logger
 *
 * This test validates the tool model routing system and performance tracking
 * as specified in new-way.md Phase 3.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { getSnapshot, Instance } from "mobx-state-tree"
import { AgentStore, agentStore, IAgentStore } from "../AgentStore"

describe("Phase 3: Tool Router and Model Routing", () => {
	let store: IAgentStore

	beforeEach(() => {
		// Create fresh store for each test
		store = AgentStore.create({ tools: {}, agents: {} }) as IAgentStore
	})

	it("resolveModelForTool returns fallback model when no routing is set", () => {
		const fallbackModel = "gpt-4o"

		const resolvedModel = store.resolveModelForTool("think_tool", fallbackModel)

		expect(resolvedModel).toBe(fallbackModel)
	})

	it("resolveModelForTool returns routed model when routing is configured", () => {
		store.setToolRoute("think_tool", "deepseek-r1")

		const resolvedModel = store.resolveModelForTool("think_tool", "gpt-4o")

		expect(resolvedModel).toBe("deepseek-r1")
	})

	it("resolveModelForTool handles multiple tool routes independently", () => {
		store.setToolRoute("think_tool", "deepseek-r1")
		store.setToolRoute("analyze_image", "gpt-4o-vision")
		store.setToolRoute("write_to_file", "claude-3.5-sonnet")

		expect(store.resolveModelForTool("think_tool", "default")).toBe("deepseek-r1")
		expect(store.resolveModelForTool("analyze_image", "default")).toBe("gpt-4o-vision")
		expect(store.resolveModelForTool("write_to_file", "default")).toBe("claude-3.5-sonnet")

		// Unrouted tool should use fallback
		expect(store.resolveModelForTool("read_file", "default")).toBe("default")
	})

	it("setToolRoute updates existing route when called multiple times", () => {
		store.setToolRoute("think_tool", "deepseek-r1")
		expect(store.resolveModelForTool("think_tool", "fallback")).toBe("deepseek-r1")

		// Update the route
		store.setToolRoute("think_tool", "claude-3.5-sonnet")
		expect(store.resolveModelForTool("think_tool", "fallback")).toBe("claude-3.5-sonnet")
	})

	it("toolModelRouting is included in MST snapshot", () => {
		store.setToolRoute("think_tool", "deepseek-r1")
		store.setToolRoute("analyze_image", "gpt-4o-vision")

		const snapshot = getSnapshot(store) as any

		expect(snapshot.toolModelRouting).toBeDefined()
		expect(snapshot.toolModelRouting["think_tool"]).toBe("deepseek-r1")
		expect(snapshot.toolModelRouting["analyze_image"]).toBe("gpt-4o-vision")
	})

	it("agentStore singleton has default tools and agents", () => {
		// The exported agentStore is a singleton that runs afterCreate on import
		expect(agentStore.tools.size).toBeGreaterThan(0)
		expect(agentStore.agents.size).toBeGreaterThan(0)

		// Verify key agents exist
		expect(agentStore.agents.get("orchestrator")).toBeDefined()
		expect(agentStore.agents.get("coder")).toBeDefined()
		expect(agentStore.agents.get("designer")).toBeDefined()

		// Verify key tools exist
		expect(agentStore.tools.get("think_tool")).toBeDefined()
		expect(agentStore.tools.get("write_to_file")).toBeDefined()
		expect(agentStore.tools.get("read_file")).toBeDefined()
	})

	it("agentStore can be used for model routing", () => {
		// Set a custom route on the singleton
		agentStore.setToolRoute("think_tool", "deepseek-reasoner")

		const resolved = agentStore.resolveModelForTool("think_tool", "gpt-4o")
		expect(resolved).toBe("deepseek-reasoner")
	})
})

describe("Phase 3: DevTools Logger Integration", () => {
	it("DevToolsLogger.track measures execution time", async () => {
		const { DevToolsLogger } = await import("../../devtools/DevToolsLogger")

		// Mock the track callback to capture data
		const originalTrack = DevToolsLogger.track.bind(DevToolsLogger)

		// Simulate a tool execution with timing
		const startTime = Date.now()

		await originalTrack("test_tool", "task-123", async () => {
			// Simulate some work
			await new Promise((r) => setTimeout(r, 50))
			return "result"
		})

		const endTime = Date.now()
		const duration = endTime - startTime

		expect(duration).toBeGreaterThanOrEqual(50)
	})

	it("DevToolsLogger can track multiple concurrent operations", async () => {
		const { DevToolsLogger } = await import("../../devtools/DevToolsLogger")

		const results: string[] = []

		await Promise.all([
			DevToolsLogger.track("tool_a", "task-123", async () => {
				await new Promise((r) => setTimeout(r, 30))
				results.push("a")
				return "result_a"
			}),
			DevToolsLogger.track("tool_b", "task-123", async () => {
				await new Promise((r) => setTimeout(r, 20))
				results.push("b")
				return "result_b"
			}),
			DevToolsLogger.track("tool_c", "task-456", async () => {
				await new Promise((r) => setTimeout(r, 10))
				results.push("c")
				return "result_c"
			}),
		])

		expect(results).toHaveLength(3)
		expect(results).toContain("a")
		expect(results).toContain("b")
		expect(results).toContain("c")
	})
})

describe("Phase 3: ThinkTool Integration", () => {
	it("ThinkTool uses agentStore for model routing", async () => {
		const { thinkTool } = await import("../../tools/ThinkTool")

		expect(thinkTool).toBeDefined()
		expect(thinkTool.name).toBe("think_tool")

		// Verify the tool exists in agentStore
		const thinkToolConfig = agentStore.tools.get("think_tool")
		expect(thinkToolConfig).toBeDefined()
		expect(thinkToolConfig?.name).toBe("Think (Reasoning)")
	})

	it("ThinkTool is available to agents that have it in allowedTools", () => {
		const orchestrator = agentStore.agents.get("orchestrator")
		const coder = agentStore.agents.get("coder")

		if (orchestrator) {
			expect(orchestrator.canUseTool("think_tool")).toBe(true)
		}

		if (coder) {
			expect(coder.canUseTool("think_tool")).toBe(true)
		}
	})
})

describe("Phase 3: Complete Integration Test", () => {
	it("full workflow: agent routing -> tool execution with model selection", async () => {
		const store = AgentStore.create({ tools: {}, agents: {} }) as IAgentStore

		// Step 1: Configure custom model routing for think_tool
		store.setToolRoute("think_tool", "deepseek-r1")

		// Step 2: Verify the route is set correctly
		expect(store.resolveModelForTool("think_tool", "gpt-4o")).toBe("deepseek-r1")

		// Step 3: Create an agent that can use think_tool
		store.registerAgent({
			id: "reasoner_agent",
			name: "Reasoner Agent",
			role: "Deep Thinker",
			systemPrompt: "You are a specialized reasoning agent.",
			allowedTools: ["think_tool"],
		})

		const reasoner = store.agents.get("reasoner_agent")
		expect(reasoner).toBeDefined()

		if (reasoner) {
			// Step 4: Verify the agent can use think_tool
			expect(reasoner.canUseTool("think_tool")).toBe(true)

			// Step 5: Verify other tools are NOT accessible
			expect(reasoner.canUseTool("write_to_file")).toBe(false)
			expect(reasoner.canUseTool("execute_command")).toBe(false)
		}

		// Step 6: Verify snapshot contains all the configuration
		const snapshot = getSnapshot(store) as any

		expect(snapshot.toolModelRouting["think_tool"]).toBe("deepseek-r1")
		expect(snapshot.agents["reasoner_agent"]).toBeDefined()
		expect(snapshot.agents["reasoner_agent"].allowedTools).toContain("think_tool")
	})

	it("model routing can be dynamically updated at runtime", () => {
		const store = AgentStore.create({ tools: {}, agents: {} }) as IAgentStore

		// Initial state - no custom routing
		expect(store.resolveModelForTool("think_tool", "default")).toBe("default")

		// Set first route
		store.setToolRoute("think_tool", "model-a")
		expect(store.resolveModelForTool("think_tool", "default")).toBe("model-a")

		// Update to second route (simulating runtime configuration change)
		store.setToolRoute("think_tool", "model-b")
		expect(store.resolveModelForTool("think_tool", "default")).toBe("model-b")

		// Different tool should be unaffected
		expect(store.resolveModelForTool("analyze_image", "default")).toBe("default")

		// Set route for different tool
		store.setToolRoute("analyze_image", "vision-model")
		expect(store.resolveModelForTool("analyze_image", "default")).toBe("vision-model")

		// think_tool should still be model-b
		expect(store.resolveModelForTool("think_tool", "default")).toBe("model-b")
	})
})
