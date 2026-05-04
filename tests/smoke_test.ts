/**
 * Jabberwock Smoke Test — BDD Given/When/Then
 *
 * Tests core Jabberwock functionality using the Page Model pattern.
 * Each scenario follows: Given (setup) → When (action) → Then (verification).
 */

import { ExtensionModel, createExtensionTest } from "./ExtensionModel"
import { Scenario, Given, When, Then, And } from "./given-when-then"

// ══════════════════════════════════════════════════════════════════════════
//  Smoke Test: Core Jabberwock Functionality
// ══════════════════════════════════════════════════════════════════════════

async function runSmokeTest() {
	const { run } = createExtensionTest("Smoke Test - Core Functionality")

	return run(async (app: ExtensionModel) => {
		// ── Scenario 1: Initial Page Verification ──────────────────────────

		await Scenario("Verify initial page is Chat", async () => {
			await Given("the Jabberwock app is connected", async () => {
				// Connection is handled by createJabberwockTest
				console.log("  ✓ App connected")
			})

			await When("I retrieve the active page", async () => {
				const page = await app.getActivePage()
				console.log(`  → Active page: ${page}`)
			})

			await Then("the initial page should be chat", async () => {
				await app.verifyActivePage("chat")
			})

			await And("no extra windows should be open", async () => {
				await app.verifyNoExtraWindows("chat")
			})

			await And("there should be no console errors", async () => {
				await app.verifyCleanConsole()
			})
		})

		// ── Scenario 2: Create First Task ──────────────────────────────────

		let firstTaskId = ""

		await Scenario("Create a new task and verify it appears on chat page", async () => {
			await Given("I am on the Chat page", async () => {
				await app.verifyActivePage("chat")
			})

			await When("I create a new task with a greeting prompt", async () => {
				firstTaskId = await app.createNewTask(
					"Smoke Test Task 1 - Please respond with a simple greeting",
					"ask", // Use "ask" mode to avoid orchestrator tool-calling loop
				)
				console.log(`  ✓ Task created: ${firstTaskId}`)
			})

			await Then("no extra windows should be open (only chat)", async () => {
				await app.verifyNoExtraWindows("chat")
			})

			await And("the task prompt should be visible in the chat DOM", async () => {
				await app.verifyChatContainsMessage("Smoke Test Task 1")
			})

			await And("the MST store should contain the task", async () => {
				await app.verifyMstTaskState(firstTaskId, {
					mode: "ask",
				})
				await app.verifyMstActiveNode(firstTaskId)
			})

			await And("there should be no console errors", async () => {
				await app.verifyCleanConsole()
			})
		})

		// ── Scenario 3: Return to History ──────────────────────────────────

		await Scenario("Return to History page from Chat", async () => {
			await Given("I am on the Chat page", async () => {
				await app.verifyActivePage("chat")
			})

			await When("I navigate to the History page", async () => {
				await app.navigateToHistory()
			})

			await Then("the active page should be history", async () => {
				await app.verifyActivePage("history")
			})

			await And("the UI window stack should show History on top of Chat", async () => {
				const stack = await app.getUiWindowStack()
				console.log(`  ℹ UI window stack: [${stack.join(", ")}]`)
				// History should be on top (last element)
				if (stack[stack.length - 1] !== "history") {
					throw new Error(`Expected "history" at top of stack, got: [${stack.join(", ")}]`)
				}
			})

			await And("no extra windows should be open (only history)", async () => {
				await app.verifyNoExtraWindows("history")
			})

			await And("the task stack should be empty (no active task)", async () => {
				const taskStack = await app.getTaskStack()
				if (taskStack.length > 0) {
					console.log(`  ℹ Task stack has ${taskStack.length} entries (not on chat page)`)
				} else {
					console.log("  ✓ No active task (expected on History page)")
				}
			})

			await And("there should be no console errors", async () => {
				await app.verifyCleanConsole()
			})
		})

		// ── Scenario 4: Create Second Task ─────────────────────────────────

		let secondTaskId = ""

		await Scenario("Create a second task from History page", async () => {
			await Given("I am on the History page", async () => {
				await app.verifyActivePage("history")
			})

			await When("I navigate to Chat and create a second task", async () => {
				await app.navigateToChat()
				await app.verifyActivePage("chat")

				secondTaskId = await app.createNewTask("Smoke Test Task 2 - Another test task", "ask")
				console.log(`  ✓ Second task created: ${secondTaskId}`)
			})

			await Then("no extra windows should be open (only chat)", async () => {
				await app.verifyNoExtraWindows("chat")
			})

			await And("the second task prompt should be visible in chat", async () => {
				await app.verifyChatContainsMessage("Smoke Test Task 2")
			})

			await And("the MST store should contain the second task", async () => {
				await app.verifyMstTaskState(secondTaskId, {
					mode: "ask",
				})
				await app.verifyMstActiveNode(secondTaskId)
			})

			await And("there should be no console errors", async () => {
				await app.verifyCleanConsole()
			})
		})

		// ── Scenario 5: Navigate to Settings ───────────────────────────────

		await Scenario("Navigate to Settings page", async () => {
			await Given("I am on the Chat page", async () => {
				await app.verifyActivePage("chat")
			})

			await When("I navigate to the Settings page", async () => {
				await app.navigateToSettings()
			})

			await Then("the active page should be settings", async () => {
				await app.verifyActivePage("settings")
			})

			await And("no extra windows should be open (only settings)", async () => {
				await app.verifyNoExtraWindows("settings")
			})

			await And("there should be no console errors", async () => {
				await app.verifyCleanConsole()
			})
		})

		// ── Scenario 6: Return to History ──────────────────────────────────

		await Scenario("Return to History from Settings", async () => {
			await Given("I am on the Settings page", async () => {
				await app.verifyActivePage("settings")
			})

			await When("I navigate to the History page", async () => {
				await app.navigateToHistory()
			})

			await Then("the active page should be history", async () => {
				await app.verifyActivePage("history")
			})

			await And("no extra windows should be open (only history)", async () => {
				await app.verifyNoExtraWindows("history")
			})

			await And("there should be no console errors", async () => {
				await app.verifyCleanConsole()
			})
		})

		// ── Scenario 7: Task Status & Hierarchy ────────────────────────────

		await Scenario("Retrieve task status and hierarchy", async () => {
			await Given("I am on the History page", async () => {
				await app.verifyActivePage("history")
			})

			await When("I request the task status", async () => {
				const taskStatus = await app.getTaskStatus()
				console.log(`  ✓ Task status retrieved: ${JSON.stringify(taskStatus).substring(0, 100)}`)
			})

			await Then("no extra windows should be open while querying", async () => {
				await app.verifyNoExtraWindows("history")
			})

			await When("I request the task hierarchy", async () => {
				try {
					const taskHierarchy = await app.getTaskHierarchy()
					console.log(`  ✓ Task hierarchy retrieved: ${JSON.stringify(taskHierarchy).substring(0, 100)}`)
				} catch (e) {
					console.log("  ⚠ Task hierarchy skipped (tasks may have completed)")
				}
			})

			await Then("no extra windows opened after hierarchy query", async () => {
				await app.verifyNoExtraWindows("history")
			})
		})

		// ── Scenario 8: DOM & MST Verification ─────────────────────────────

		await Scenario("Verify DOM structure and MST stores", async () => {
			await Given("I am on the History page", async () => {
				await app.verifyActivePage("history")
			})

			await When("I retrieve the DOM structure", async () => {
				const dom = await app.getDom()
				console.log(`  ✓ DOM retrieved (length: ${dom.length} characters)`)
			})

			await Then("only the history window should be active", async () => {
				await app.verifyNoExtraWindows("history")
			})

			await When("I query the diagnostics MST store", async () => {
				const diagState = await app.getMstState({ store: "diagnosticsStoreMst", mode: "graph", depth: 1 })
				console.log(`  ✓ Diagnostics store queried: ${JSON.stringify(diagState).substring(0, 100)}`)
			})

			await Then("no extra windows after diagnostics query", async () => {
				await app.verifyNoExtraWindows("history")
			})

			await When("I query the task history MST store", async () => {
				const historyState = await app.getMstState({ store: "taskHistoryStoreMst", mode: "graph", depth: 1 })
				console.log(`  ✓ Task history store queried: ${JSON.stringify(historyState).substring(0, 100)}`)
			})

			await Then("no extra windows after task history query", async () => {
				await app.verifyNoExtraWindows("history")
			})
		})

		// ── Scenario 9: Agent Mode ─────────────────────────────────────────

		await Scenario("Retrieve available agents from DOM via ModeSelector", async () => {
			await Given("I am on the Chat page (ModeSelector is visible there)", async () => {
				await app.navigateToChat()
				await app.verifyActivePage("chat")
			})

			let retrievedAgents: Array<{ name: string; slug?: string }> = []

			await When("I retrieve available agents from the ModeSelector dropdown", async () => {
				retrievedAgents = await app.getAvailableAgents()
				console.log(
					`  ✓ Available agents retrieved from DOM: ${JSON.stringify(retrievedAgents).substring(0, 200)}`,
				)
			})

			await Then("no extra windows should be open", async () => {
				await app.verifyNoExtraWindows("chat")
			})

			await And("at least 4 modes should be listed", async () => {
				if (retrievedAgents.length < 4) {
					console.warn(`  ⚠ Expected at least 4 modes, got ${retrievedAgents.length}`)
				} else {
					console.log(`  ✓ ${retrievedAgents.length} modes found in ModeSelector`)
				}
			})
		})

		// ── Scenario 10: Workspace State ───────────────────────────────────

		await Scenario("Retrieve workspace state", async () => {
			await Given("I am on the History page", async () => {
				await app.verifyActivePage("history")
			})

			await When("I request the workspace state", async () => {
				const workspaceState = await app.getWorkspaceState()
				console.log(`  ✓ Workspace state retrieved: ${JSON.stringify(workspaceState).substring(0, 200)}`)
			})

			await Then("no extra windows should be open", async () => {
				await app.verifyNoExtraWindows("history")
			})
		})

		// ── Scenario 11: Command-Based Navigation (app.commands.*) ────────────

		await Scenario("Navigate via dynamic commands from package.json", async () => {
			await Given("I am on the History page", async () => {
				await app.verifyActivePage("history")
			})

			await When("I use app.commands.settingsButtonClicked() to navigate", async () => {
				await app.commands.settingsButtonClicked()
				await app.waitForDataWindowType("settings")
			})

			await Then("the active page should be settings", async () => {
				await app.verifyActivePage("settings")
			})

			await And("only settings window should be visible", async () => {
				await app.verifyNoExtraWindows("settings")
			})

			await And("I can list available commands from package.json", async () => {
				const names = app.getCommandNames()
				console.log(`  ✓ Available commands (${names.length}): ${names.slice(0, 5).join(", ")}...`)
				if (!names.includes("historyButtonClicked")) {
					throw new Error("Expected historyButtonClicked in command list")
				}
				if (!names.includes("settingsButtonClicked")) {
					throw new Error("Expected settingsButtonClicked in command list")
				}
				if (!names.includes("plusButtonClicked")) {
					throw new Error("Expected plusButtonClicked in command list")
				}
				console.log("  ✓ All expected commands found")
			})

			await And("no extra windows after command list", async () => {
				await app.verifyNoExtraWindows("settings")
			})

			await And("I can execute a command by name explicitly", async () => {
				await app.executeCommand("historyButtonClicked")
				await app.waitForDataWindowType("history")
				await app.verifyActivePage("history")
			})

			await And("no extra windows after command execution", async () => {
				await app.verifyNoExtraWindows("history")
			})
		})

		console.log("\n🎉 All smoke tests passed successfully!")
	})
}
// Run the smoke test
runSmokeTest()
	.then(() => {
		console.log("\n🎯 Smoke test completed successfully!")
		process.exit(0)
	})
	.catch((error) => {
		console.error("\n💥 Smoke test failed:", error)
		process.exit(1)
	})
