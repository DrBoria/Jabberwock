# Jabberwock E2E DSL - Complete Testing Framework

## Overview

Это полная DSL (Domain Specific Language) для тестирования VS Code расширения Jabberwock через MCP сервер по SSE. Все коммуникации с SSE изолированы внутри класса, предоставляя человеко-читаемые команды для тестов.

## Основные возможности

### Подключение и управление

- `connect()` / `disconnect()` - подключение к MCP серверу
- `reconnect()` - переподключение при обрыве соединения
- Автоматические retries при ошибках связи

### Управление задачами

- `createNewTask(prompt, mode)` - создание новой задачи
- `getTaskPlan()` - получение плана задач
- `approvePlan()` / `rejectPlan()` - утверждение/отклонение планов
- `getTaskStatus()` - статус текущей задачи
- `getTaskHierarchy()` - иерархия задач
- `getTaskSummary()` - суммаризация прогресса

### Навигация

- `goToChildTask(taskId)` - переход к дочерней задаче
- `goToParentTask()` - возврат к родительской задаче
- `switchToAgentMode(mode)` - переключение режима агента

### Агенты и workspace

- `getAgentStore()` - информация о доступных агентах
- `getAvailableAgents()` - список доступных режимов
- `getVirtualFiles()` - виртуальные файлы workspace
- `getWorkspaceState()` - состояние workspace

### Диагностика и мониторинг

- `getExecutionTrace()` - трассировка выполнения
- `getPerformanceMetrics()` - метрики производительности
- `getDiagnosticSnapshot()` - диагностический снимок
- `getInternalState()` - внутреннее состояние системы

### Верификация UI

- `getDOM()` - получение DOM структуры
- `verifyParentContext()` - проверка видимости родительского контекста
- `verifyAgentBubble()` - проверка видимости bubble агента
- `verifyTaskProgress()` - верификация прогресса задачи

### Асинхронные операции

- `markTaskAsAsync()` - пометка задачи как асинхронной
- `waitForAsyncTask()` - ожидание завершения async задачи
- `executeConcurrently()` - параллельное выполнение операций
- `executeSequentially()` - последовательное выполнение

## Примеры использования

### Базовый тест

```typescript
import { createJabberwockTestSession } from "./e2e_dsl_complete"

async function basicTest() {
	const dsl = await createJabberwockTestSession()

	try {
		// Создаем задачу
		const taskId = await dsl.createNewTask("Напиши hello world на Python", "coder")

		// Ждем план
		const plan = await dsl.getTaskPlan()

		// Утверждаем план
		await dsl.approvePlan(plan)

		// Мониторим прогресс
		await dsl.verifyTaskProgress(50)

		// Проверяем результат
		const files = await dsl.getVirtualFiles()
		const pythonFiles = Object.keys(files).filter((f) => f.endsWith(".py"))

		if (pythonFiles.length === 0) {
			throw new Error("Python file was not created")
		}
	} finally {
		await dsl.disconnect()
	}
}
```

### Тест с навигацией

```typescript
async function navigationTest() {
	const dsl = await createJabberwockTestSession()

	try {
		// Создаем основную задачу
		const mainTaskId = await dsl.createNewTask("Создай комплексный проект", "orchestrator")

		// Ждем делегирования
		const plan = await dsl.getTaskPlan()
		await dsl.approvePlan(plan)

		// Получаем дочерние задачи
		const hierarchy = await dsl.getTaskHierarchy()
		const childTasks = hierarchy.children || []

		// Переходим к первой дочерней задаче
		if (childTasks.length > 0) {
			await dsl.goToChildTask(childTasks[0].taskId)

			// Проверяем что родительский контекст виден
			await dsl.verifyParentContext(true)

			// Возвращаемся обратно
			await dsl.goToParentTask()

			// Проверяем что родительский контекст скрыт
			await dsl.verifyParentContext(false)
		}
	} finally {
		await dsl.disconnect()
	}
}
```

### Асинхронный тест

```typescript
async function asyncTest() {
	const dsl = await createJabberwockTestSession()

	try {
		// Создаем несколько задач
		const tasks = ["Задача 1", "Задача 2", "Задача 3"]

		const taskIds = await Promise.all(tasks.map((task) => dsl.createNewTask(task, "coder")))

		// Помечаем все кроме первой как async
		const asyncTaskIds = taskIds.slice(1)
		for (const taskId of asyncTaskIds) {
			await dsl.markTaskAsAsync(taskId)
		}

		// Мониторим выполнение
		await dsl.waitForAsyncTask(asyncTaskIds[0])
	} finally {
		await dsl.disconnect()
	}
}
```

## Запуск тестов

### Индивидуальные тесты

```bash
npm test -- tests/hard_tests_examples.ts
```

### Конкретный тест

```typescript
import { testTaskDelegationAndReorganization } from "./hard_tests_examples"

// Запуск только первого теста
await testTaskDelegationAndReorganization()
```

### Все тесты

```typescript
import { runAllHardTests } from "./hard_tests_examples"

// Запуск всей test suite
await runAllHardTests()
```

## Структура DSL

### Core Connection

- Изолированная SSE коммуникация с автоматическими retries
- Безопасное управление подключениями
- Обработка обрывов соединения

### Human-Readable Commands

Все команды предназначены для использования в тестах без знания внутренней реализации SSE

### Error Handling

- Автоматические retries для всех операций
- Подробное логирование ошибок
- Graceful degradation при сбоях

### Test Management

- Встроенная система записи результатов тестов
- Автоматический подсчет статистики
- Подробное логирование прогресса

## Требования

- Node.js 16+
- Запущенный MCP сервер Jabberwock на порту 60060
- VS Code расширение Jabberwock с подключенным MCP клиентом

## Troubleshooting

### Connection Issues

```typescript
// При обрыве соединения
await dsl.reconnect()

// При частых таймаутах
const dsl = new JabberwockE2EDSL(60060) // кастомный порт
dsl.connectionTimeout = 60000 // увеличиваем таймаут
```

### Tool Call Failures

Все вызовы инструментов автоматически retryются 3 раза с задержкой 2 секунды

### Parse Errors

Используется безопасный JSON parsing с fallback значениями

## Best Practices

1. Всегда используйте `try/finally` с `disconnect()`
2. Используйте `verifyTaskProgress()` для мониторинга прогресса
3. Проверяйте `getAvailableAgents()` перед распределением задач
4. Используйте `executeConcurrently()` для параллельных операций
5. Включайте `verifyParentContext()` при навигации между задачами
