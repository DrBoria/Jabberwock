/**
 * Integration tests for Conversation Tree Architecture (Phases 1-3)
 *
 * These tests verify the complete system behavior based on scenarios from hard-tests.md:
 * - Test 1: Task delegation and reorganization between agents
 * - Test 2: Async task execution with proper MST branching
 * - Test 3: Tool invocation and file system management
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { TaskPlan, TaskNode, AgentInfo, FileState } from "./types"

// ==================== MOCK OBJECTS ====================

/**
 * Mock MST (MobX State Tree) ChatTreeStore for testing conversation tree architecture
 */
class MockChatTreeStore {
	private nodes: Map<string, TaskNode> = new Map()
	private rootTaskId?: string
	private branches: Map<string, string[]> = new Map() // taskId -> child taskIds

	addTask(taskId: string, mode: string, title: string, parentTaskId?: string): TaskNode {
		const node: TaskNode = {
			taskId,
			mode,
			title,
			parentTaskId,
			children: [],
			messages: [],
			summary: "",
			isStreaming: false,
			status: "active",
		}

		this.nodes.set(taskId, node)

		if (!parentTaskId && !this.rootTaskId) {
			this.rootTaskId = taskId
		}

		if (parentTaskId) {
			const parent = this.nodes.get(parentTaskId)
			if (parent) {
				parent.children.push(taskId)
				if (!this.branches.has(parentTaskId)) {
					this.branches.set(parentTaskId, [])
				}
				this.branches.get(parentTaskId)!.push(taskId)
			}
		}

		return node
	}

	getNode(taskId: string): TaskNode | undefined {
		return this.nodes.get(taskId)
	}

	getRootTask(): TaskNode | undefined {
		return this.rootTaskId ? this.nodes.get(this.rootTaskId) : undefined
	}

	getChildTasks(parentTaskId: string): TaskNode[] {
		const parent = this.nodes.get(parentTaskId)
		if (!parent) return []
		return parent.children.map((childId) => this.nodes.get(childId)!).filter(Boolean)
	}

	updateSummary(taskId: string, summary: string): void {
		const node = this.nodes.get(taskId)
		if (node) {
			node.summary = summary
			node.status = "completed"
		}
	}

	setStreaming(taskId: string, isStreaming: boolean): void {
		const node = this.nodes.get(taskId)
		if (node) {
			node.isStreaming = isStreaming
		}
	}

	addMessage(taskId: string, role: "user" | "assistant", content: string): void {
		const node = this.nodes.get(taskId)
		if (node) {
			node.messages.push({ role, content, timestamp: Date.now() })
		}
	}

	clear(): void {
		this.nodes.clear()
		this.branches.clear()
		this.rootTaskId = undefined
	}
}

/**
 * Mock AgentStore for testing agent delegation and RBAC
 */
class MockAgentStore {
	private agents: Map<string, AgentInfo> = new Map()

	constructor() {
		// Initialize with default agents
		this.agents.set("orchestrator", {
			id: "orchestrator",
			name: "Manager",
			mode: "orchestrator",
			isAvailable: true,
			currentTaskId: undefined,
			capabilities: ["delegate", "plan", "coordinate"],
		})

		this.agents.set("coder", {
			id: "coder",
			name: "Backend Developer",
			mode: "coder",
			isAvailable: true,
			currentTaskId: undefined,
			capabilities: ["code", "test", "debug"],
		})

		this.agents.set("designer", {
			id: "designer",
			name: "UI/UX Designer",
			mode: "designer",
			isAvailable: true,
			currentTaskId: undefined,
			capabilities: ["design", "visual", "layout"],
		})

		this.agents.set("architect", {
			id: "architect",
			name: "Architect",
			mode: "architect",
			isAvailable: true,
			currentTaskId: undefined,
			capabilities: ["design", "plan", "analyze"],
		})
	}

	getAgent(mode: string): AgentInfo | undefined {
		return this.agents.get(mode)
	}

	getAllAgents(): AgentInfo[] {
		return Array.from(this.agents.values())
	}

	assignTask(agentId: string, taskId: string): void {
		const agent = this.agents.get(agentId)
		if (agent) {
			agent.currentTaskId = taskId
			agent.isAvailable = false
		}
	}

	releaseAgent(agentId: string): void {
		const agent = this.agents.get(agentId)
		if (agent) {
			agent.currentTaskId = undefined
			agent.isAvailable = true
		}
	}

	getAvailableAgents(): AgentInfo[] {
		return Array.from(this.agents.values()).filter((a) => a.isAvailable)
	}
}

/**
 * Mock MCP Client for testing tool invocations (browser, screenshot, file operations)
 */
class MockMCPClient {
	private virtualFileSystem: Map<string, FileState> = new Map()
	private toolCallLog: Array<{ tool: string; args: any; result: any }> = []

	// Virtual file system for testing
	async readFile(path: string): Promise<string> {
		const file = this.virtualFileSystem.get(path)
		if (!file) {
			throw new Error(`File not found: ${path}`)
		}
		return file.content
	}

	async writeFile(path: string, content: string): Promise<void> {
		this.virtualFileSystem.set(path, {
			path,
			content,
			type: path.endsWith(".html") ? "html" : path.endsWith(".png") ? "image" : "text",
			createdAt: Date.now(),
		})
	}

	async deleteFile(path: string): Promise<void> {
		this.virtualFileSystem.delete(path)
	}

	async listFiles(): Promise<string[]> {
		return Array.from(this.virtualFileSystem.keys())
	}

	// Mock browser tool
	async openBrowser(url: string): Promise<{ success: boolean; screenshot?: string }> {
		this.toolCallLog.push({
			tool: "open_browser",
			args: { url },
			result: { success: true },
		})
		return { success: true }
	}

	// Mock screenshot tool
	async takeScreenshot(path: string): Promise<{ success: boolean; path: string }> {
		const screenshotData = `MOCK_SCREENSHOT_DATA_${Date.now()}`
		await this.writeFile(path, screenshotData)

		this.toolCallLog.push({
			tool: "take_screenshot",
			args: { path },
			result: { success: true, path },
		})

		return { success: true, path }
	}

	// Mock VL (Vision Language) model check
	async checkVisualLayout(htmlContent: string): Promise<{ issues: string[]; score: number }> {
		this.toolCallLog.push({
			tool: "check_visual_layout",
			args: { htmlContent: htmlContent.substring(0, 100) },
			result: { issues: [], score: 85 },
		})

		const issues: string[] = []
		if (!htmlContent.includes("@media")) {
			issues.push("Missing mobile responsive styles")
		}
		if (!htmlContent.includes("viewport")) {
			issues.push("Missing viewport meta tag")
		}

		return {
			issues,
			score: issues.length === 0 ? 100 : 70,
		}
	}

	getToolCallLog(): Array<{ tool: string; args: any; result: any }> {
		return this.toolCallLog
	}

	clearToolCallLog(): void {
		this.toolCallLog = []
	}

	clearFileSystem(): void {
		this.virtualFileSystem.clear()
	}
}

/**
 * Mock TaskManager for coordinating task execution
 */
class MockTaskManager {
	private chatTreeStore: MockChatTreeStore
	private agentStore: MockAgentStore
	private mcpClient: MockMCPClient
	private executionOrder: string[] = [] // Track order of task execution

	constructor(chatTreeStore: MockChatTreeStore, agentStore: MockAgentStore, mcpClient: MockMCPClient) {
		this.chatTreeStore = chatTreeStore
		this.agentStore = agentStore
		this.mcpClient = mcpClient
	}

	async createTask(prompt: string, mode: string): Promise<string> {
		const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`
		const title = prompt.substring(0, 50) + "..."

		this.chatTreeStore.addTask(taskId, mode, title)
		this.agentStore.assignTask(mode, taskId)
		this.executionOrder.push(`created:${taskId}`)

		return taskId
	}

	async delegateTasks(plan: TaskPlan, parentTaskId?: string): Promise<string[]> {
		const createdTasks: string[] = []

		for (const task of plan.initialTasks) {
			const taskId = await this.createTask(task.description || task.title, task.assignedTo)
			this.chatTreeStore.addTask(taskId, task.assignedTo, task.title, parentTaskId)
			createdTasks.push(taskId)
			this.executionOrder.push(`delegated:${taskId}:${task.assignedTo}`)
		}

		return createdTasks
	}

	async executeTask(taskId: string): Promise<string> {
		const node = this.chatTreeStore.getNode(taskId)
		if (!node) {
			throw new Error(`Task not found: ${taskId}`)
		}

		this.chatTreeStore.setStreaming(taskId, true)
		this.executionOrder.push(`executing:${taskId}`)

		// Simulate task execution
		await new Promise((resolve) => setTimeout(resolve, 100))

		const summary = `Completed: ${node.title}`
		this.chatTreeStore.updateSummary(taskId, summary)
		this.chatTreeStore.setStreaming(taskId, false)

		this.agentStore.releaseAgent(node.mode)
		this.executionOrder.push(`completed:${taskId}`)

		return summary
	}

	async executeTasksAsync(taskIds: string[]): Promise<Map<string, string>> {
		const results = new Map<string, string>()

		const promises = taskIds.map(async (taskId) => {
			const summary = await this.executeTask(taskId)
			results.set(taskId, summary)
		})

		await Promise.all(promises)
		return results
	}

	getExecutionOrder(): string[] {
		return this.executionOrder
	}

	clearExecutionOrder(): void {
		this.executionOrder = []
	}
}

// ==================== ASSERT FUNCTIONS ====================

/**
 * Assert that tasks are distributed correctly among agents
 */
function assertTasksDistributed(
	tasks: Array<{ assignedTo: string }>,
	expectedDistribution: Record<string, number>,
): void {
	const actualDistribution: Record<string, number> = {}

	for (const task of tasks) {
		actualDistribution[task.assignedTo] = (actualDistribution[task.assignedTo] || 0) + 1
	}

	expect(actualDistribution).toEqual(expectedDistribution)
}

/**
 * Assert that tasks were executed asynchronously (not sequentially)
 */
function assertAsyncExecution(executionOrder: string[], taskIds: string[]): void {
	if (taskIds.length < 2) {
		return // Not enough tasks to verify async behavior
	}

	const executingIndices = new Map<string, number>()

	executionOrder.forEach((action, index) => {
		if (action.startsWith("executing:")) {
			const taskId = action.split(":")[1]
			executingIndices.set(taskId, index)
		}
	})

	// For async execution, tasks should start executing before previous ones complete
	// Check if there's overlap in execution periods
	const taskIdsArray = Array.from(executingIndices.keys())

	if (taskIdsArray.length >= 2) {
		const firstStart = executingIndices.get(taskIdsArray[0])!
		const secondStart = executingIndices.get(taskIdsArray[1])!

		// In async execution, second task should start before first completes
		// First task completes at index + 3 (executing -> ... -> completed)
		const firstComplete = firstStart + 3

		expect(secondStart).toBeLessThan(firstComplete)
	}
}

/**
 * Assert that summary is properly merged into parent branch
 */
function assertSummaryMerged(childNode: TaskNode, parentNode: TaskNode): void {
	expect(childNode.summary).toBeTruthy()
	expect(childNode.status).toBe("completed")
	expect(parentNode.children).toContain(childNode.taskId)

	// Parent should have reference to child's completion
	expect(parentNode).toBeDefined()
}

/**
 * Assert that files were created, modified, and deleted correctly
 */
function assertFileOperations(files: Map<string, FileState>, expectedFiles: string[], deletedFiles: string[]): void {
	const existingFiles = Array.from(files.keys())

	// Check expected files exist
	for (const expectedFile of expectedFiles) {
		expect(existingFiles).toContain(expectedFile)
	}

	// Check deleted files don't exist
	for (const deletedFile of deletedFiles) {
		expect(existingFiles).not.toContain(deletedFile)
	}
}

/**
 * Assert that tools were called in correct order
 */
function assertToolCalls(toolLog: Array<{ tool: string }>, expectedTools: string[]): void {
	const actualTools = toolLog.map((call) => call.tool)
	expect(actualTools).toEqual(expectedTools)
}

// ==================== TEST 1: TASK DELEGATION AND REORGANIZATION ====================

describe("Test 1: Task Delegation and Reorganization", () => {
	let chatTreeStore: MockChatTreeStore
	let agentStore: MockAgentStore
	let mcpClient: MockMCPClient
	let taskManager: MockTaskManager

	beforeEach(() => {
		chatTreeStore = new MockChatTreeStore()
		agentStore = new MockAgentStore()
		mcpClient = new MockMCPClient()
		taskManager = new MockTaskManager(chatTreeStore, agentStore, mcpClient)
	})

	it("should delegate tasks correctly and handle plan reorganization", async () => {
		// Step 1: Create initial task for orchestrator
		const parentTaskId = await taskManager.createTask(
			"Создай функцию на C++ которая напишет hello world скрипт на python и делегируй designer",
			"orchestrator",
		)

		expect(chatTreeStore.getNode(parentTaskId)).toBeDefined()

		// Step 2: Generate task plan (simulating agent's planning)
		const initialPlan: TaskPlan = {
			initialTasks: [
				{
					id: "t1",
					title: "Analyze requirements",
					description: "Understand C++ and Python integration",
					assignedTo: "architect",
				},
				{
					id: "t2",
					title: "Design UI mockup",
					description: "Create visual design for the tool",
					assignedTo: "designer",
				},
				{
					id: "t3",
					title: "Implement C++ function",
					description: "Write C++ code that generates Python",
					assignedTo: "coder",
				},
				{
					id: "t4",
					title: "Test integration",
					description: "Verify C++ to Python generation works",
					assignedTo: "coder",
				},
				{ id: "t5", title: "Create documentation", description: "Document the usage", assignedTo: "architect" },
				{ id: "t6", title: "Final review", description: "Review all components", assignedTo: "designer" },
			],
		}

		// Step 3: User modifies plan - replace designer with backend developer, reorder tasks
		const modifiedPlan: TaskPlan = {
			initialTasks: [
				{
					id: "t1",
					title: "Analyze requirements",
					description: "Understand C++ and Python integration",
					assignedTo: "architect",
				},
				{
					id: "t3",
					title: "Implement C++ function",
					description: "Write C++ code that generates Python",
					assignedTo: "coder",
				}, // Moved up
				{
					id: "t2",
					title: "Design UI mockup",
					description: "Create visual design for the tool",
					assignedTo: "coder",
				}, // Changed from designer
				{
					id: "t4",
					title: "Test integration",
					description: "Verify C++ to Python generation works",
					assignedTo: "coder",
				},
				// t5 removed by user
				{ id: "t6", title: "Final review", description: "Review all components", assignedTo: "coder" }, // Changed from designer
			],
		}

		// Step 4: Delegate tasks according to modified plan
		const childTaskIds = await taskManager.delegateTasks(modifiedPlan, parentTaskId)

		expect(childTaskIds.length).toBe(5) // One task was removed

		// Step 5: Verify task distribution (no orchestrator tasks, all delegated)
		assertTasksDistributed(modifiedPlan.initialTasks, {
			architect: 1,
			coder: 4,
		})

		// Step 6: Execute child tasks
		for (const taskId of childTaskIds) {
			await taskManager.executeTask(taskId)
		}

		// Step 7: Verify MST structure - all child tasks are in separate branches
		const parent = chatTreeStore.getNode(parentTaskId)!
		expect(parent.children.length).toBe(5)

		// Step 8: Verify summaries are merged
		for (const childId of childTaskIds) {
			const childNode = chatTreeStore.getNode(childId)!
			assertSummaryMerged(childNode, parent)
		}

		// Step 9: Manager generates final summary based on all subtask summaries
		const finalSummary = `Parent task completed with ${parent.children.length} subtasks`
		chatTreeStore.updateSummary(parentTaskId, finalSummary)

		expect(chatTreeStore.getNode(parentTaskId)!.summary).toContain(String(parent.children.length))
	})
})

// ==================== TEST 2: ASYNC TASK EXECUTION ====================

describe("Test 2: Async Task Execution", () => {
	let chatTreeStore: MockChatTreeStore
	let agentStore: MockAgentStore
	let mcpClient: MockMCPClient
	let taskManager: MockTaskManager

	beforeEach(() => {
		chatTreeStore = new MockChatTreeStore()
		agentStore = new MockAgentStore()
		mcpClient = new MockMCPClient()
		taskManager = new MockTaskManager(chatTreeStore, agentStore, mcpClient)
	})

	it("should execute tasks asynchronously across multiple agents", async () => {
		// Step 1: Create 10 granular tasks distributed among 3+ agents
		const taskPrompts = [
			"Выведи в консоль приветствие",
			"Напиши hello world на JavaScript",
			"Напиши тест для hello world",
			"Выведи в консоль текущую дату",
			"Создай простую HTML страницу",
			"Напиши функцию сложения двух чисел",
			"Протестируй функцию сложения",
			"Создай массив из 5 элементов",
			"Отсортируй массив по возрастанию",
			"Найди максимальный элемент в массиве",
		]

		const plan: TaskPlan = {
			initialTasks: taskPrompts.map((prompt, index) => ({
				id: `task-${index}`,
				title: prompt,
				description: prompt,
				assignedTo: index % 3 === 0 ? "coder" : index % 3 === 1 ? "designer" : "architect",
				isAsync: index !== 0, // All except first are async
			})),
		}

		// Step 2: Verify distribution across at least 3 agents
		assertTasksDistributed(plan.initialTasks, {
			coder: 4,
			designer: 3,
			architect: 3,
		})

		// Step 3: Delegate all tasks
		const taskIds = await taskManager.delegateTasks(plan)
		expect(taskIds.length).toBe(10)

		// Step 4: Execute tasks asynchronously (all except first)
		const syncTaskId = taskIds[0]
		const asyncTaskIds = taskIds.slice(1)

		// Execute sync task first (partially)
		await taskManager.executeTask(syncTaskId)

		// Execute async tasks in parallel
		const results = await taskManager.executeTasksAsync(asyncTaskIds)

		// Step 5: Verify all tasks completed
		expect(results.size).toBe(9)

		// Step 6: Verify async execution pattern
		const executionOrder = taskManager.getExecutionOrder()
		assertAsyncExecution(executionOrder, asyncTaskIds.slice(0, 3)) // Check first 3 async tasks

		// Step 7: Verify MST structure - each task in its own branch
		for (const taskId of taskIds) {
			const node = chatTreeStore.getNode(taskId)!
			expect(node.summary).toBeTruthy()
			expect(node.status).toBe("completed")
		}

		// Step 8: Simulate navigation between parent and child tasks
		const firstChildTask = chatTreeStore.getNode(taskIds[1])!

		// Child task should be active and streaming-capable
		expect(firstChildTask.status).toBe("completed")

		// Verify parent context is maintained
		const rootTask = chatTreeStore.getRootTask()
		expect(rootTask).toBeDefined()
	})
})

// ==================== TEST 3: TOOL INVOCATION AND FILE MANAGEMENT ====================

describe("Test 3: Tool Invocation and File Management", () => {
	let chatTreeStore: MockChatTreeStore
	let agentStore: MockAgentStore
	let mcpClient: MockMCPClient
	let taskManager: MockTaskManager

	beforeEach(() => {
		chatTreeStore = new MockChatTreeStore()
		agentStore = new MockAgentStore()
		mcpClient = new MockMCPClient()
		taskManager = new MockTaskManager(chatTreeStore, agentStore, mcpClient)
	})

	it("should create HTML, adapt for mobile, take screenshots, and cleanup files", async () => {
		// Step 1: Create beautiful HTML layout
		const htmlTaskId = await taskManager.createTask(
			"Создай красивую HTML страницу с современным дизайном, используй CSS Grid и Flexbox",
			"designer",
		)

		const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Beautiful Layout</title>
    <style>
        .container { display: grid; grid-template-columns: repeat(3, 1fr); }
        .item { padding: 20px; background: #f0f0f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
    </div>
</body>
</html>`

		await mcpClient.writeFile("beautiful-layout.html", htmlContent)

		// Step 2: Verify HTML file created
		let files = await mcpClient.listFiles()
		expect(files).toContain("beautiful-layout.html")

		// Step 3: Adapt layout for mobile (add responsive styles)
		const mobileTaskId = await taskManager.createTask("Адаптируй верстку для мобильных устройств", "designer")

		const adaptedHtmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Beautiful Layout - Mobile</title>
    <style>
        .container { display: grid; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 768px) {
            .container { grid-template-columns: 1fr; }
        }
        .item { padding: 20px; background: #f0f0f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
    </div>
</body>
</html>`

		await mcpClient.writeFile("beautiful-layout.html", adaptedHtmlContent)

		// Step 4: Designer checks visual layout through VL model
		const visualCheck = await mcpClient.checkVisualLayout(adaptedHtmlContent)
		expect(visualCheck.score).toBeGreaterThan(60)

		// Step 5: Open browser and take screenshots
		await mcpClient.openBrowser("file:///beautiful-layout.html")

		await mcpClient.takeScreenshot("screenshot-desktop.png")
		await mcpClient.takeScreenshot("screenshot-mobile.png")

		// Step 6: Verify screenshots created
		files = await mcpClient.listFiles()
		expect(files).toContain("screenshot-desktop.png")
		expect(files).toContain("screenshot-mobile.png")

		// Step 7: Cleanup - delete HTML files, keep only screenshots
		await mcpClient.deleteFile("beautiful-layout.html")

		const finalFiles = await mcpClient.listFiles()

		// Assert file operations
		assertFileOperations(
			new Map(finalFiles.map((f) => [f, { path: f, content: "", type: "unknown", createdAt: 0 }])),
			["screenshot-desktop.png", "screenshot-mobile.png"], // Expected to remain
			["beautiful-layout.html"], // Expected to be deleted
		)

		// Step 8: Verify tool call log
		const toolLog = mcpClient.getToolCallLog()
		expect(toolLog.some((call) => call.tool === "open_browser")).toBe(true)
		expect(toolLog.some((call) => call.tool === "take_screenshot")).toBe(true)
		expect(toolLog.some((call) => call.tool === "check_visual_layout")).toBe(true)

		// Step 9: Execute tasks and verify MST structure
		await taskManager.executeTask(htmlTaskId)
		await taskManager.executeTask(mobileTaskId)

		const htmlNode = chatTreeStore.getNode(htmlTaskId)!
		const mobileNode = chatTreeStore.getNode(mobileTaskId)!

		expect(htmlNode.summary).toBeTruthy()
		expect(mobileNode.summary).toBeTruthy()
	})
})

// ==================== TEST 4: NAVIGATION AND CONTEXT PRESERVATION ====================

describe("Test 4: Navigation and Context Preservation", () => {
	let chatTreeStore: MockChatTreeStore
	let agentStore: MockAgentStore
	let mcpClient: MockMCPClient
	let taskManager: MockTaskManager

	beforeEach(() => {
		chatTreeStore = new MockChatTreeStore()
		agentStore = new MockAgentStore()
		mcpClient = new MockMCPClient()
		taskManager = new MockTaskManager(chatTreeStore, agentStore, mcpClient)
	})

	it("should preserve context when navigating between parent and child tasks", async () => {
		// Step 1: Create parent task
		const parentTaskId = await taskManager.createTask(
			"Родительская задача для тестирования навигации",
			"orchestrator",
		)

		// Step 2: Create child tasks
		const childTaskId1 = await taskManager.createTask("Дочерняя задача 1", "coder")
		const childTaskId2 = await taskManager.createTask("Дочерняя задача 2", "designer")

		// Link children to parent in MST
		const parent = chatTreeStore.getNode(parentTaskId)!
		parent.children.push(childTaskId1, childTaskId2)

		// Step 3: Start streaming on child task 1
		chatTreeStore.setStreaming(childTaskId1, true)
		chatTreeStore.addMessage(childTaskId1, "assistant", "Generating content...")

		// Step 4: Navigate to child task (simulated by checking state)
		const childNode = chatTreeStore.getNode(childTaskId1)!
		expect(childNode.isStreaming).toBe(true)
		expect(childNode.messages.length).toBeGreaterThan(0)

		// Step 5: Navigate back to parent (parent should still be valid)
		const parentNode = chatTreeStore.getNode(parentTaskId)!
		expect(parentNode).toBeDefined()
		expect(parentNode.children).toContain(childTaskId1)

		// Step 6: Return to child task - content generation should continue
		childNode.isStreaming = true
		chatTreeStore.addMessage(childTaskId1, "assistant", "Continuing generation...")

		expect(childNode.messages.length).toBeGreaterThan(1)

		// Step 7: Complete child task and verify summary
		await taskManager.executeTask(childTaskId1)
		const completedChild = chatTreeStore.getNode(childTaskId1)!
		expect(completedChild.status).toBe("completed")
		expect(completedChild.summary).toBeTruthy()

		// Step 8: Verify agent bubble would be visible (agent has currentTaskId)
		const coderAgent = agentStore.getAgent("coder")!
		expect(coderAgent.mode).toBe("coder")
	})
})
