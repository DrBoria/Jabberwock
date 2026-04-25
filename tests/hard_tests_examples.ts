import { JabberwockE2EDSL, createJabberwockTestSession, createTestSuite } from "./e2e_dsl_complete"

// ==================== TEST 1: TASK DELEGATION AND REORGANIZATION ====================

async function testTaskDelegationAndReorganization() {
	const { run } = createTestSuite("Task Delegation and Reorganization")

	await run(async (dsl) => {
		// 1. Create task first to activate the extension and provider
		await dsl.recordTest("Create manager task", "PASS", "Creating C++ to Python task")
		const taskId = await dsl.createNewTask(
			"Создай функцию на C++ которая напишет hello world скрипт на python и обязательно делегируй эту задачу designer",
			"orchestrator",
		)

		// 2. Now navigate to history page (provider is now active)
		await dsl.recordTest("Navigate to history page", "PASS", "Navigating after task creation")
		await dsl.navigateToPage("history")
		await dsl.verifyActivePage("history")
		await dsl.verifyCleanConsole()

		// 3. Return to chat with the created task
		await dsl.recordTest("Navigate back to chat", "PASS", "Returning to chat after history check")
		await dsl.navigateToPage("chat", { taskId })
		await dsl.verifyActivePage("chat")
		await dsl.recordTest("Check current page", "PASS", "Checking current page after task creation")
		const currentPage = await dsl.getActivePage()
		console.log(`[DEBUG] Current page after task creation: ${currentPage}`)

		if (currentPage !== "chat") {
			await dsl.recordTest("Manual navigation to chat", "PASS", "Manually navigating to chat page")
			await dsl.navigateToPage("chat", { taskId })
			await dsl.verifyActivePage("chat")
		} else {
			console.log("  ✓ Already on chat page")
		}
		await dsl.verifyCleanConsole()

		// 4. Ждем план задач (добавляем дополнительное время для генерации)
		await dsl.recordTest("Wait for task plan", "PASS", "Waiting for task plan generation")
		console.log("[DEBUG] Waiting 5 seconds for task plan generation...")
		await dsl.wait(55000)

		// Проверяем статус задачи перед получением плана
		await dsl.recordTest("Check task status", "PASS", "Checking task status before getting plan")
		try {
			const taskStatus = await dsl.callTool("get_task_status", {})
			console.log("[DEBUG] Task status:", taskStatus)
		} catch (error) {
			console.log("[DEBUG] Error getting task status:", error.message)
		}

		const plan = await dsl.getTaskPlan()
		await dsl.verifyCleanConsole()

		// 5. Проверяем что задача делегирована designer
		await dsl.recordTest("Check designer delegation", "PASS", "Verifying task is delegated to designer")
		const hasDesignerTask = plan.initialTasks.some((task) => task.assignedTo.toLowerCase().includes("designer"))

		if (!hasDesignerTask) {
			throw new Error("Task was not delegated to designer")
		}

		// 6. Модифицируем план: заменяем designer на backend developer
		await dsl.recordTest("Modify task plan", "PASS", "Replacing designer with backend developer")
		const mutatedPlan: typeof plan = {
			initialTasks: plan.initialTasks.map((task) => ({
				...task,
				assignedTo: task.assignedTo.toLowerCase().includes("designer") ? "backend developer" : task.assignedTo,
			})),
		}

		// 7. Меняем порядок пунктов (2-3 местами)
		if (mutatedPlan.initialTasks.length >= 3) {
			const temp = mutatedPlan.initialTasks[1]
			mutatedPlan.initialTasks[1] = mutatedPlan.initialTasks[2]
			mutatedPlan.initialTasks[2] = temp
		}

		// 8. Удаляем первый пункт
		if (mutatedPlan.initialTasks.length > 0) {
			mutatedPlan.initialTasks.shift()
		}

		// 9. Утверждаем модифицированный план
		await dsl.approvePlan(mutatedPlan)
		await dsl.verifyCleanConsole()

		// 10. Проверяем выполнение задач
		await dsl.recordTest("Verify task execution", "PASS", "Monitoring task execution")
		await dsl.verifyTaskProgress(30)

		// 11. Проверяем иерархию задач (с ожиданием появления дочерних задач)
		await dsl.recordTest("Check task hierarchy", "PASS", "Verifying task hierarchy structure")
		const hierarchy = await dsl.waitForChildTasks(30000)

		if (!hierarchy.children || hierarchy.children.length === 0) {
			throw new Error("No child tasks found in hierarchy")
		}

		// 12. Проверяем summary
		await dsl.recordTest("Verify summary generation", "PASS", "Checking summary integration")
		const summary = await dsl.getTaskSummary()

		if (summary.summaryScore < 20) {
			throw new Error("Summary score too low, possible missing subtask integration")
		}
	})
}

// ==================== TEST 2: ASYNC TASK EXECUTION ====================

async function testAsyncTaskExecution() {
	const { run } = createTestSuite("Async Task Execution")

	await run(async (dsl) => {
		// 1. Переходим на страницу чата
		await dsl.recordTest("Navigate to chat", "PASS", "Navigating to chat page")
		await dsl.navigateToChat()
		await dsl.verifyCleanConsole()

		// 2. Создаем multiple granular tasks
		await dsl.recordTest("Create multiple tasks", "PASS", "Creating 10 granular tasks")

		const tasks = [
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

		const taskPromises = tasks.map((prompt, index) => dsl.createNewTask(prompt, "coder"))

		const taskIds = await Promise.all(taskPromises)

		// 3. Получаем информацию об агентах
		await dsl.recordTest("Get agent information", "PASS", "Checking available agents")
		const agents = await dsl.getAvailableAgents()

		if (agents.length < 3) {
			throw new Error("Not enough agents available for distribution")
		}

		// 4. Помечаем все задачи кроме одной как async
		await dsl.recordTest("Mark tasks as async", "PASS", "Setting async flags for tasks")
		const asyncTaskIds = taskIds.slice(1) // Все кроме первой

		for (const taskId of asyncTaskIds) {
			await dsl.markTaskAsAsync(taskId)
		}

		// 5. Проверяем асинхронное выполнение
		await dsl.recordTest("Verify async execution", "PASS", "Monitoring async task execution")

		// Мониторим прогресс основной (синхронной) задачи
		let mainTaskProgress = 0
		const startTime = Date.now()

		while (Date.now() - startTime < 30000) {
			const summary = await dsl.getTaskSummary()

			if (summary.summaryScore > mainTaskProgress) {
				mainTaskProgress = summary.summaryScore
				console.log(`Main task progress: ${mainTaskProgress}`)
			}

			// Проверяем что async задачи еще выполняются
			const hierarchy = await dsl.getTaskHierarchy()
			const asyncTasksStillRunning = asyncTaskIds.some((asyncTaskId) => {
				const findTask = (h: any): boolean => {
					if (h.taskId === asyncTaskId) return true
					if (h.children) return h.children.some((child: any) => findTask(child))
					return false
				}
				return findTask(hierarchy)
			})

			if (!asyncTasksStillRunning && mainTaskProgress < 50) {
				throw new Error("Async tasks completed too quickly - possible sync execution")
			}

			if (mainTaskProgress > 70 && !asyncTasksStillRunning) {
				break // Основная задача завершена, async тоже
			}

			await dsl.wait(1000)
		}

		// 6. Проверяем навигацию между задачами
		await dsl.recordTest("Test task navigation", "PASS", "Testing parent-child navigation")

		// Переходим в child task
		await dsl.goToChildTask(asyncTaskIds[0])
		await dsl.verifyParentContext(true)

		// Возвращаемся к parent
		await dsl.goToParentTask()
		await dsl.verifyParentContext(false)

		// Снова переходим в child и проверяем продолжение генерации
		await dsl.goToChildTask(asyncTaskIds[0])
		await dsl.wait(2000)

		const status = await dsl.getTaskStatus()
		if (!status.isStreaming) {
			throw new Error("Content generation should continue in child task")
		}
	})
}

// ==================== TEST 3: VISUAL ADAPTATION CHAIN ====================

async function testVisualAdaptationChain() {
	const { run } = createTestSuite("Visual Adaptation Chain")

	await run(async (dsl) => {
		// 1. Переходим на страницу чата
		await dsl.recordTest("Navigate to chat", "PASS", "Navigating to chat page")
		await dsl.navigateToChat()
		await dsl.verifyCleanConsole()

		// 2. Создаем HTML с красивой версткой
		await dsl.recordTest("Create HTML layout", "PASS", "Creating beautiful HTML layout")
		const htmlTaskId = await dsl.createNewTask(
			"Создай красивую HTML страницу с современным дизайном, используй CSS Grid и Flexbox",
			"designer",
		)

		// Ждем завершения
		await dsl.verifyTaskProgress(60)
		await dsl.verifyCleanConsole()

		// 3. Проверяем что HTML файл создан
		await dsl.recordTest("Check HTML file creation", "PASS", "Verifying HTML file exists")
		const files = await dsl.getVirtualFiles()
		const htmlFiles = Object.keys(files).filter((name) => name.endsWith(".html"))

		if (htmlFiles.length === 0) {
			throw new Error("No HTML files created")
		}

		// 4. Адаптируем верстку для мобилок
		await dsl.recordTest("Adapt for mobile", "PASS", "Making layout responsive for mobile")
		const mobileTaskId = await dsl.createNewTask(
			`Адаптируй эту HTML верстку для мобильных устройств: ${htmlFiles[0]}`,
			"designer",
		)

		// 5. Ждем пока designer проверит через VL модель
		await dsl.waitForAgentMode("designer", 45000)

		// 6. Проверяем что верстка изменена
		await dsl.recordTest("Verify layout changes", "PASS", "Checking mobile adaptation")
		const updatedFiles = await dsl.getVirtualFiles()
		const mobileHtml = updatedFiles[htmlFiles[0]]

		if (!mobileHtml.includes("@media") && !mobileHtml.includes("viewport")) {
			throw new Error("Mobile adaptation not detected in HTML")
		}

		// 7. Создаем скриншоты
		await dsl.recordTest("Create screenshots", "PASS", "Generating visual screenshots")
		const screenshotTaskId = await dsl.createNewTask(
			`Сделай 2-3 скриншота адаптированной верстки: ${htmlFiles[0]}`,
			"designer",
		)

		await dsl.verifyTaskProgress(40)

		// 8. Проверяем что скриншоты созданы
		await dsl.recordTest("Verify screenshots", "PASS", "Checking screenshot creation")
		const finalFiles = await dsl.getVirtualFiles()
		const screenshotFiles = Object.keys(finalFiles).filter(
			(name) => name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg"),
		)

		if (screenshotFiles.length < 2) {
			throw new Error(`Expected at least 2 screenshots, got ${screenshotFiles.length}`)
		}

		// 9. Удаляем HTML файлы
		await dsl.recordTest("Cleanup HTML files", "PASS", "Removing temporary HTML files")
		const cleanupTaskId = await dsl.createNewTask("Удали все HTML файлы, оставь только скриншоты", "coder")

		await dsl.verifyTaskProgress(30)

		// 10. Финальная проверка - только скриншоты остались
		await dsl.recordTest("Final verification", "PASS", "Verifying only screenshots remain")
		const finalCheckFiles = await dsl.getVirtualFiles()
		const remainingHtmlFiles = Object.keys(finalCheckFiles).filter((name) => name.endsWith(".html"))
		const remainingScreenshots = Object.keys(finalCheckFiles).filter(
			(name) => name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg"),
		)

		if (remainingHtmlFiles.length > 0) {
			throw new Error("HTML files were not deleted")
		}

		if (remainingScreenshots.length === 0) {
			throw new Error("Screenshots were accidentally deleted")
		}

		// 11. Проверяем навигацию и контекст
		await dsl.recordTest("Test navigation context", "PASS", "Testing navigation between tasks")

		// Переходим в child task и обратно
		await dsl.goToChildTask(screenshotTaskId)
		await dsl.verifyAgentBubble("D", true) // Designer bubble should be visible
		await dsl.verifyParentContext(true)

		await dsl.goToParentTask()
		await dsl.verifyParentContext(false)

		// Проверяем что контент продолжает генерироваться при возврате
		await dsl.goToChildTask(screenshotTaskId)
		await dsl.wait(2000)

		const status = await dsl.getTaskStatus()
		if (!status.hasTask) {
			throw new Error("Task should still be active after navigation")
		}
	})
}

// ==================== MAIN TEST RUNNER ====================

async function runAllHardTests() {
	console.log("🚀 Starting Hard Tests Suite...\n")

	try {
		console.log("=== TEST 1: Task Delegation and Reorganization ===")
		await testTaskDelegationAndReorganization()

		console.log("\n=== TEST 2: Async Task Execution ===")
		await testAsyncTaskExecution()

		console.log("\n=== TEST 3: Visual Adaptation Chain ===")
		await testVisualAdaptationChain()

		console.log("\n🎉 All hard tests completed successfully!")
	} catch (error) {
		console.error("❌ Test failed:", error)
		process.exit(1)
	}
}

// Export for individual test execution
export { testTaskDelegationAndReorganization, testAsyncTaskExecution, testVisualAdaptationChain, runAllHardTests }

// Run if this file is executed directly
if (require.main === module) {
	runAllHardTests().catch(console.error)
}
