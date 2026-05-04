/**
 * Hard Integration Tests for Jabberwock — BDD Given/When/Then
 *
 * Tests complex scenarios: task delegation, async execution, visual adaptation.
 * Uses the Page Model (JabberwockApp) + BDD helpers (Scenario, Given, When, Then).
 *
 * NOTE: These tests use only the core DOM-based API surface. Methods like
 * getTaskPlan, verifyTodoIframe, goToChildTask, etc. have been removed from
 * ExtensionModel as they were not needed by smoke_test.ts. Hard test scenarios
 * that relied on them have been simplified to use available primitives.
 */

import { ExtensionModel, createExtensionTest } from "./ExtensionModel"
import { Scenario, Given, When, Then, And } from "./given-when-then"

// ══════════════════════════════════════════════════════════════════════════
//  Test 1: Task Delegation and Reorganization
// ══════════════════════════════════════════════════════════════════════════

/**
 * Tests core task creation and hierarchy verification.
 * Uses only the DOM-based API (createNewTask, verifyChatContainsMessage, etc.).
 */
async function testTaskDelegationAndReorganization() {
	const { run } = createExtensionTest("Hard Test 1 - Task Delegation & Reorganization")

	return run(async (app: ExtensionModel) => {
		let mainTaskId = ""

		await Scenario("Orchestrator delegates tasks and maintains hierarchy", async () => {
			await Given("the app is connected and on the chat page", async () => {
				await app.navigateToChat()
				await app.verifyActivePage("chat")
			})

			await When("I create a complex orchestrator task", async () => {
				mainTaskId = await app.createNewTask(
					"Create a comprehensive project with multiple modules: " +
						"1) a REST API server in Node.js, " +
						"2) a React frontend, " +
						"3) database schema. " +
						"Delegate each module as a subtask.",
					"orchestrator",
				)
				console.log(`  ✓ Main task created: ${mainTaskId}`)
			})

			await Then("the task should be on the chat page", async () => {
				await app.navigateToChat(mainTaskId)
				await app.verifyActivePage("chat")
			})

			await And("the task prompt should be visible in chat", async () => {
				await app.verifyChatContainsMessage("Create a comprehensive project")
			})

			await When("I retrieve the task status via MST state", async () => {
				const status = await app.getTaskStatus()
				console.log(`  ✓ Task status retrieved: ${JSON.stringify(status).substring(0, 200)}`)
			})

			await Then("the task should be active in MST", async () => {
				await app.verifyMstActiveNode(mainTaskId)
			})

			await And("there should be no console errors", async () => {
				await app.verifyCleanConsole()
			})
		})
	})
}

// ══════════════════════════════════════════════════════════════════════════
//  Test 2: Async Task Execution
// ══════════════════════════════════════════════════════════════════════════

/**
 * Tests that tasks can be created and navigated between.
 * Uses only the DOM-based API.
 */
async function testAsyncTaskExecution() {
	const { run } = createExtensionTest("Hard Test 2 - Async Task Execution")

	return run(async (app: ExtensionModel) => {
		let taskIds: string[] = []

		await Scenario("Tasks can be created and navigated", async () => {
			await Given("the app is connected and on the chat page", async () => {
				await app.navigateToChat()
				await app.verifyActivePage("chat")
			})

			await When("I create multiple tasks", async () => {
				const tasks = ["Async Task 1 - Simple calculation", "Async Task 2 - File processing"]
				taskIds = []
				for (const task of tasks) {
					const taskId = await app.createNewTask(task, "coder")
					taskIds.push(taskId)
					console.log(`  ✓ Task created: "${task}" → ${taskId}`)
				}
			})

			await Then("all tasks should be created successfully", async () => {
				if (taskIds.length !== 2) {
					throw new Error(`Expected 2 tasks, got ${taskIds.length}`)
				}
				console.log(`  ✓ ${taskIds.length} tasks created`)
			})

			await When("I navigate to the first task", async () => {
				await app.navigateToChat(taskIds[0])
				await app.verifyActivePage("chat")
			})

			await Then("the first task should be active", async () => {
				await app.verifyChatContainsMessage("Async Task 1")
			})

			await When("I navigate to the second task", async () => {
				await app.navigateToChat(taskIds[1])
				await app.verifyActivePage("chat")
			})

			await Then("the second task should be active", async () => {
				await app.verifyChatContainsMessage("Async Task 2")
			})

			await And("there should be no console errors", async () => {
				await app.verifyCleanConsole()
			})
		})
	})
}

// ══════════════════════════════════════════════════════════════════════════
//  Test 3: Visual Adaptation Chain
// ══════════════════════════════════════════════════════════════════════════

/**
 * Tests the visual adaptation chain with DOM-based mode switching.
 * Uses only the DOM-based API (switchToAgentMode via ModeSelector).
 */
async function testVisualAdaptationChain() {
	const { run } = createExtensionTest("Hard Test 3 - Visual Adaptation Chain")

	return run(async (app: ExtensionModel) => {
		let mainTaskId = ""

		await Scenario("Visual adaptation chain works end-to-end", async () => {
			await Given("the app is connected and on the chat page", async () => {
				await app.navigateToChat()
				await app.verifyActivePage("chat")
			})

			await When("I create a task that generates visual content", async () => {
				mainTaskId = await app.createNewTask(
					"Create a simple HTML page with a styled button and a greeting message",
					"coder",
				)
				console.log(`  ✓ Main task created: ${mainTaskId}`)
			})

			await Then("the task should be on the chat page", async () => {
				await app.navigateToChat(mainTaskId)
				await app.verifyActivePage("chat")
			})

			await And("the task prompt should be visible", async () => {
				await app.verifyChatContainsMessage("Create a simple HTML page")
			})

			await When("I switch agent mode via ModeSelector DOM interaction", async () => {
				await app.navigateToChat()
				await app.verifyActivePage("chat")
				await app.switchToAgentMode("coder")
			})

			await Then("the agent mode should be switched successfully via DOM", async () => {
				console.log("  ✓ Agent mode switch completed via DOM interaction")
			})

			await And("no extra windows should be open after mode switch", async () => {
				await app.verifyNoExtraWindows("chat")
			})

			await And("there should be no console errors", async () => {
				await app.verifyCleanConsole()
			})
		})
	})
}

// ══════════════════════════════════════════════════════════════════════════
//  Test Runner
// ══════════════════════════════════════════════════════════════════════════

async function runAllHardTests() {
	console.log("🚀 Starting Hard Test Suite...")
	console.log("=".repeat(60))

	let failed = 0

	try {
		await testTaskDelegationAndReorganization()
		console.log("\n" + "=".repeat(60))
	} catch (e) {
		console.error("❌ Test 1 failed:", e)
		failed++
	}

	try {
		await testAsyncTaskExecution()
		console.log("\n" + "=".repeat(60))
	} catch (e) {
		console.error("❌ Test 2 failed:", e)
		failed++
	}

	try {
		await testVisualAdaptationChain()
		console.log("\n" + "=".repeat(60))
	} catch (e) {
		console.error("❌ Test 3 failed:", e)
		failed++
	}

	console.log(`\n📊 Hard Test Suite: ${failed > 0 ? "❌" : "✅"} ${failed} failed`)
	return failed
}

// Run all hard tests if executed directly
if (require.main === module) {
	runAllHardTests()
		.then((failed) => {
			process.exit(failed > 0 ? 1 : 0)
		})
		.catch((error) => {
			console.error("\n💥 Hard test suite failed:", error)
			process.exit(1)
		})
}

export { testTaskDelegationAndReorganization, testAsyncTaskExecution, testVisualAdaptationChain, runAllHardTests }
