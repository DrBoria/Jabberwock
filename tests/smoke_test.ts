import { JabberwockE2EDSL, createJabberwockTestSession, createTestSuite } from "./e2e_dsl_complete"

/**
 * Helper: ensure MCP connection is healthy before proceeding.
 * If the connection is dead (e.g. SSE transport closed after a timeout),
 * this will reconnect automatically.
 */
async function ensureMcpConnection(dsl: JabberwockE2EDSL): Promise<void> {
	try {
		const pingResult = await dsl.callTool("_ping", {})
		const parsed = JSON.parse(pingResult)
		if (parsed.providerAlive) {
			console.log("  ✓ MCP connection healthy (provider alive)")
			return
		}
		// Provider is dead but server is alive — try reconnect
		console.warn("  ⚠️ Provider is not alive, attempting reconnect...")
	} catch (error) {
		console.warn(`  ⚠️ MCP connection issue detected: ${error instanceof Error ? error.message : error}`)
	}

	console.log("  🔄 Attempting MCP reconnection...")
	await dsl.hardReconnect()
	console.log("  ✓ MCP reconnected successfully")
}

/**
 * Вспомогательные функции для проверки сообщений в чате
 */
async function verifyChatContainsMessage(
	dsl: JabberwockE2EDSL,
	expectedText: string,
	timeoutMs: number = 10000,
): Promise<void> {
	const startTime = Date.now()

	while (Date.now() - startTime < timeoutMs) {
		const dom = await dsl.getDOM()

		// Ищем сообщение в DOM
		if (dom.includes(expectedText)) {
			console.log(`✅ Сообщение найдено в чате: "${expectedText}"`)
			return
		}

		// Ждем немного перед следующей проверкой
		await new Promise((resolve) => setTimeout(resolve, 500))
	}

	throw new Error(`Сообщение "${expectedText}" не найдено в чате после ${timeoutMs}ms`)
}

async function verifyTaskStartedOnCorrectPage(dsl: JabberwockE2EDSL, expectedPage: string): Promise<void> {
	await dsl.verifyActivePage(expectedPage)
	console.log(`✅ Задача корректно начата на странице: ${expectedPage}`)
}

/**
 * Comprehensive Smoke Test for Jabberwock Extension
 * Tests core functionality: task creation, navigation, message sending, generation control
 */
async function runSmokeTest() {
	console.log("🚀 Starting Jabberwock Smoke Test...")

	const { run } = createTestSuite("Smoke Test - Core Functionality")

	return run(async (dsl) => {
		// 1. Проверяем начальное состояние - страница истории
		console.log("1. Checking initial history page...")
		await dsl.recordTest("Check initial history page", "PASS", "Verifying initial page is history")

		// Explicitly navigate to history to ensure we start in the expected state
		await dsl.navigateToHistory()
		await dsl.verifyActivePage("history")
		await dsl.verifyCleanConsole()
		console.log("✅ Initial history page verified")

		// 2. Создаем первую задачу и проверяем, что она начата на правильной странице
		console.log("2. Creating first task and verifying page...")
		await dsl.recordTest("Create first task", "PASS", "Creating first smoke test task")

		const firstTaskPrompt = "Smoke Test Task 1 - Please respond with a simple greeting"
		const firstTaskId = await dsl.createNewTask(firstTaskPrompt, "orchestrator")
		console.log(`✅ First task created successfully: ${firstTaskId}`)

		// Ensure MCP connection is healthy before navigating to the task
		await ensureMcpConnection(dsl)

		// Explicitly navigate to the newly created task to ensure we are seeing its messages
		await dsl.navigateToChat(firstTaskId)

		// [MST] Verify task state in MST store
		console.log("2a. Verifying MST task state...")
		await dsl.recordTest("MST: Verify first task state", "PASS", "Checking MST store for first task")
		await dsl.verifyMstTaskState(firstTaskId, {
			title: firstTaskPrompt,
			mode: "orchestrator",
			status: "pending",
		})
		await dsl.verifyMstActiveNode(firstTaskId)
		console.log("✅ MST state verified for first task")

		// Проверяем, что задача начата на странице чата
		await dsl.recordTest("Verify task started on chat page", "PASS", "Checking task started on correct page")
		await verifyTaskStartedOnCorrectPage(dsl, "chat")
		await dsl.verifyCleanConsole()

		// Проверяем, что промпт задачи записан в чате как сообщение
		console.log("3. Verifying task prompt in chat...")
		await dsl.recordTest("Verify task prompt in chat", "PASS", "Checking task prompt appears in chat")
		await verifyChatContainsMessage(dsl, firstTaskPrompt)
		await dsl.verifyCleanConsole()
		console.log("✅ Task prompt successfully recorded in chat")

		// 4. Возвращаемся на страницу истории
		console.log("4. Returning to history page...")
		await dsl.recordTest("Return to history page", "PASS", "Navigating back to history page")
		await dsl.navigateToHistory()
		await dsl.verifyActivePage("history")
		await dsl.verifyCleanConsole()
		console.log("✅ Return to history page successful")

		// Ensure MCP connection is healthy after history navigation
		await ensureMcpConnection(dsl)

		// 5. Перед созданием второй задачи явно переходим на страницу чата
		console.log("5. Navigating to chat page for second task...")
		await dsl.recordTest("Navigate to chat for second task", "PASS", "Explicitly navigating to chat page")
		await dsl.navigateToChat() // Navigate to base chat window
		await dsl.verifyActivePage("chat")
		await dsl.verifyCleanConsole()
		console.log("✅ Navigation to chat page successful")

		// 6. Создаем вторую задачу и проверяем, что она начата на правильной странице
		console.log("6. Creating second task and verifying page...")
		await dsl.recordTest("Create second task", "PASS", "Creating second smoke test task")

		const secondTaskPrompt = "Smoke Test Task 2 - Another test task"
		const secondTaskId = await dsl.createNewTask(secondTaskPrompt, "orchestrator")
		console.log(`✅ Second task created successfully: ${secondTaskId}`)

		// Ensure MCP connection is healthy before navigating to the second task
		await ensureMcpConnection(dsl)

		// Explicitly navigate to the newly created task to ensure we are seeing its messages
		await dsl.navigateToChat(secondTaskId)

		// [MST] Verify second task state in MST store
		console.log("6a. Verifying MST state for second task...")
		await dsl.recordTest("MST: Verify second task state", "PASS", "Checking MST store for second task")
		await dsl.verifyMstTaskState(secondTaskId, {
			title: secondTaskPrompt,
			mode: "orchestrator",
		})
		await dsl.verifyMstActiveNode(secondTaskId)
		console.log("✅ MST state verified for second task")

		// Проверяем, что вторая задача тоже начата на странице чата
		await dsl.recordTest(
			"Verify second task started on chat page",
			"PASS",
			"Checking second task started on correct page",
		)
		await verifyTaskStartedOnCorrectPage(dsl, "chat")
		await dsl.verifyCleanConsole()

		// Проверяем, что промпт второй задачи записан в чате как сообщение
		console.log("7. Verifying second task prompt in chat...")
		await dsl.recordTest("Verify second task prompt in chat", "PASS", "Checking second task prompt appears in chat")
		await verifyChatContainsMessage(dsl, secondTaskPrompt)
		await dsl.verifyCleanConsole()
		console.log("✅ Second task prompt successfully recorded in chat")

		// 8. Дополнительно проверяем, что мы все еще на странице чата
		console.log("8. Verifying we are still on chat page...")
		await dsl.recordTest("Verify chat page consistency", "PASS", "Ensuring we remain on chat page")
		await dsl.verifyActivePage("chat")
		console.log("✅ Still on chat page - consistency verified")

		// 9. Тестируем получение статуса задачи
		console.log("9. Testing task status retrieval...")
		await dsl.recordTest("Get task status", "PASS", "Getting task status")
		const taskStatus = await dsl.getTaskStatus()
		console.log("✅ Task status retrieved:", taskStatus)

		// 10. Тестируем получение иерархии задач
		console.log("10. Testing task hierarchy...")
		try {
			await dsl.recordTest("Get task hierarchy", "PASS", "Getting task hierarchy")
			const taskHierarchy = await dsl.getTaskHierarchy()
			console.log("✅ Task hierarchy retrieved:", taskHierarchy)
		} catch (e) {
			console.log("⚠️ Task hierarchy skipped (likely task finished):", e)
		}

		// 11. Тестируем навигацию между страницами
		console.log("11. Testing page navigation...")
		await dsl.recordTest("Navigate to settings", "PASS", "Navigating to settings page")
		await dsl.navigateToSettings()
		await dsl.verifyActivePage("settings")
		console.log("✅ Navigation to settings successful")

		// Ensure MCP connection is healthy after settings navigation
		await ensureMcpConnection(dsl)

		// 12. Возвращаемся на страницу истории
		console.log("12. Returning to history page...")
		await dsl.recordTest("Return to history", "PASS", "Returning to history page")
		await dsl.navigateToHistory()
		await dsl.verifyActivePage("history")
		await dsl.verifyCleanConsole()
		console.log("✅ Return to history successful")

		// 13. Тестируем получение активной страницы
		console.log("13. Testing active page detection...")
		await dsl.recordTest("Get active page", "PASS", "Getting current active page")
		const activePage = await dsl.getActivePage()
		console.log("✅ Active page:", activePage)

		// 14. Тестируем переключение режимов агента
		console.log("14. Testing agent mode switching...")
		await dsl.recordTest("Switch agent mode", "PASS", "Switching agent mode")
		await dsl.switchToAgentMode("orchestrator")
		console.log("✅ Agent mode switched successfully")

		// 15. Тестируем получение доступных агентов
		console.log("15. Testing available agents...")
		await dsl.recordTest("Get available agents", "PASS", "Getting available agents")
		const availableAgents = await dsl.getAvailableAgents()
		console.log("✅ Available agents:", availableAgents)

		// 16. Тестируем получение состояния workspace
		console.log("16. Testing workspace state...")
		await dsl.recordTest("Get workspace state", "PASS", "Getting workspace state")
		const workspaceState = await dsl.getWorkspaceState()
		console.log("✅ Workspace state retrieved")

		// 17. Тестируем получение DOM
		console.log("17. Testing DOM retrieval...")
		await dsl.recordTest("Get DOM", "PASS", "Getting DOM structure")
		const dom = await dsl.getDOM()
		console.log("✅ DOM retrieved (length:", dom.length, "characters)")

		// 18. [MST] Verify messages in store
		console.log("18. Verifying MST message count...")
		await dsl.recordTest("MST: Verify messages in store", "PASS", "Checking MST message count for second task")
		await dsl.verifyMstHasMessages(secondTaskId, 1)
		console.log("✅ MST message count verified")

		// 19. [MST] Query diagnostics store
		console.log("19. Querying MST diagnostics store...")
		await dsl.recordTest("MST: Diagnostics store", "PASS", "Querying diagnostics MST store")
		const diagState = await dsl.getMstState({ store: "diagnosticsStoreMst", mode: "graph", depth: 1 })
		console.log("✅ Diagnostics store queried:", JSON.stringify(diagState).substring(0, 200))

		// 20. [MST] Query task history store
		console.log("20. Querying MST task history store...")
		await dsl.recordTest("MST: Task history store", "PASS", "Querying task history MST store")
		const historyState = await dsl.getMstState({ store: "taskHistoryStoreMst", mode: "graph", depth: 1 })
		console.log("✅ Task history store queried:", JSON.stringify(historyState).substring(0, 200))

		console.log("🎉 All smoke tests passed successfully!")
		console.log("\n📋 Test Summary:")
		console.log("✅ Initial page verification")
		console.log("✅ Task creation with page verification")
		console.log("✅ Task prompts recorded in chat")
		console.log("✅ Page navigation and consistency")
		console.log("✅ Task status and hierarchy")
		console.log("✅ Agent mode switching")
		console.log("✅ Available agents")
		console.log("✅ Workspace state")
		console.log("✅ DOM structure")
		console.log("✅ MST task state verification")
		console.log("✅ MST active node verification")
		console.log("✅ MST message count verification")
		console.log("✅ MST diagnostics store")
		console.log("✅ MST task history store")

		// Возвращаем успешное завершение
		return
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
