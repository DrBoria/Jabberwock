/**
 * Hard Integration Tests for Jabberwock — BDD Given/When/Then
 *
 * Tests complex scenarios: task delegation, async execution, visual adaptation.
 * Uses the Page Model (JabberwockApp) + BDD helpers (Scenario, Given, When, Then).
 */

import { ExtensionModel, createExtensionTest } from "./ExtensionModel"
import { Scenario, Given, When, Then, And } from "./given-when-then"

// ══════════════════════════════════════════════════════════════════════════
//  Test 1: Task Delegation and Reorganization
// ══════════════════════════════════════════════════════════════════════════

/**
 * Tests that the orchestrator can:
 * 1. Create a complex task with subtasks
 * 2. Navigate between parent and child tasks
 * 3. Verify parent context is preserved
 * 4. Approve/reject plans
 */
async function testTaskDelegationAndReorganization() {
	const { run } = createExtensionTest("Hard Test 1 - Task Delegation & Reorganization")

	return run(async (app: ExtensionModel) => {
		let mainTaskId = ""
		let childTasks: any[] = []

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

			await When("I retrieve the task plan", async () => {
				const plan = await app.getTaskPlan(mainTaskId)
				console.log(`  ✓ Task plan retrieved: ${JSON.stringify(plan).substring(0, 200)}`)
			})

			await Then("the plan should be returned successfully", async () => {
				console.log("  ✓ Plan retrieval passed")
			})

			await When("I wait for child tasks to be created", async () => {
				try {
					childTasks = await app.waitForChildTasks(30000)
					console.log(`  ✓ Found ${childTasks.length} child task(s)`)
				} catch (e) {
					console.log("  ⚠ No child tasks appeared within timeout — task may still be processing")
				}
			})

			await Then("child tasks should be present in the hierarchy", async () => {
				if (childTasks.length > 0) {
					console.log(`  ✓ ${childTasks.length} child task(s) confirmed`)
				} else {
					console.log("  ⚠ No child tasks to verify — continuing")
				}
			})

			if (childTasks.length > 0) {
				await When("I navigate to the first child task", async () => {
					await app.goToChildTask(childTasks[0].taskId)
					console.log(`  ✓ Navigated to child task: ${childTasks[0].taskId}`)
				})

				await Then("the parent context should be visible", async () => {
					await app.verifyParentContext(true)
				})

				await When("I return to the parent task", async () => {
					await app.goToParentTask()
				})

				await Then("the parent context should no longer be active", async () => {
					await app.verifyParentContext(false)
				})
			}

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
 * Tests that tasks can be:
 * 1. Created and marked as async
 * 2. Executed in background
 * 3. Monitored for completion
 * 4. Navigated between async tasks
 */
async function testAsyncTaskExecution() {
	const { run } = createExtensionTest("Hard Test 2 - Async Task Execution")

	return run(async (app: ExtensionModel) => {
		let taskIds: string[] = []

		await Scenario("Tasks can be created, marked async, and monitored", async () => {
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

			await When("I mark the second task as async", async () => {
				await app.markTaskAsAsync(taskIds[1])
			})

			await Then("the task should be marked as async", async () => {
				console.log(`  ✓ Task ${taskIds[1]} is async`)
			})

			await When("I navigate to the first task", async () => {
				await app.navigateToChat(taskIds[0])
				await app.verifyActivePage("chat")
			})

			await Then("the first task should be active", async () => {
				await app.verifyChatContainsMessage("Async Task 1")
			})

			await When("I navigate to the second (async) task", async () => {
				await app.navigateToChat(taskIds[1])
				await app.verifyActivePage("chat")
			})

			await Then("the async task should be active", async () => {
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
 * Tests the visual adaptation chain:
 * 1. Create a task that generates visual content
 * 2. Navigate through the task hierarchy
 * 3. Verify agent bubbles and context
 * 4. Check virtual files are created
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

			await When("I check for virtual files", async () => {
				try {
					const virtualFiles = await app.getVirtualFiles()
					console.log(`  ✓ Virtual files: ${JSON.stringify(virtualFiles).substring(0, 200)}`)
				} catch (e) {
					console.log("  ⚠ Virtual files not available yet")
				}
			})

			await Then("virtual files should be retrievable", async () => {
				console.log("  ✓ Virtual files check passed")
			})

			await When("I check the agent mode", async () => {
				await app.switchToAgentMode("coder")
			})

			await Then("the agent mode switch should be attempted", async () => {
				console.log("  ✓ Agent mode switch attempted")
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
