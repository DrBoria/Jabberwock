# Jabberwock E2E Testing Framework

## Overview

Extension Model + BDD Given/When/Then framework for testing the Jabberwock VS Code extension through the MCP devtool server.

**Architecture (like Playwright):**

| Layer                                 | Role                                                    | File                                                                                                         |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@jabberwock/devtool` (DevtoolClient) | Playwright — transport, WebSocket, JSON-RPC, primitives | [`packages/devtool/src/client.ts`](../packages/devtool/src/client.ts)                                        |
| `ExtensionModel`                      | Page Model — declarative methods composing primitives   | [`tests/ExtensionModel.ts`](tests/ExtensionModel.ts)                                                         |
| BDD helpers                           | Scenario/Given/When/Then wrappers                       | [`tests/given-when-then.ts`](tests/given-when-then.ts)                                                       |
| Tests                                 | BDD test scenarios                                      | [`tests/smoke_test.ts`](tests/smoke_test.ts), [`tests/hard_tests_examples.ts`](tests/hard_tests_examples.ts) |

**Separation of concerns:**

- `DevtoolClient` handles: reading WebSocket URL from `mcp_settings.json`, connection management, reconnect, JSON-RPC message passing, exposing raw primitives
- `ExtensionModel` handles: composing primitives into domain-specific methods (navigation, verification, task management)
- Tests handle: BDD scenarios using `Scenario`/`Given`/`When`/`Then`

## DevtoolClient (Playwright Layer)

Located in [`packages/devtool/src/client.ts`](../packages/devtool/src/client.ts).

Handles all transport and connection logic:

- Reads WebSocket URL from `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`
- Falls back to `ws://127.0.0.1:60060/ws`
- WebSocket connection with MCP initialize handshake
- Auto-reconnect support
- JSON-RPC request/response with timeout

**Core primitives:**

| Method                                                        | Description                          |
| ------------------------------------------------------------- | ------------------------------------ |
| `connect()`                                                   | Connect to devtool server            |
| `disconnect()`                                                | Disconnect from devtool server       |
| `getDom(maxDepth?, maxChildren?)`                             | Get DOM serialization                |
| `findElement(selector)`                                       | Find element by CSS selector or text |
| `clickElement(id)`                                            | Click element by ID/selector         |
| `typeText(id, text)`                                          | Type into input                      |
| `scrollElement(id, direction)`                                | Scroll element                       |
| `selectOption(id, value)`                                     | Select dropdown option               |
| `getConsoleLogs(level?, limit?, offset?)`                     | Get console logs                     |
| `getLogs(lines?)`                                             | Get extension logs                   |
| `getDiagnosticsSnapshot(...)`                                 | Get diagnostics snapshot             |
| `clearDiagnostics()`                                          | Clear diagnostics                    |
| `getMstState(store?, mode?, depth?, path?, nodeId?, fields?)` | Query MST state                      |
| `getExtensionInfo()`                                          | Get extension info                   |
| `getCurrentState()`                                           | Get current extension state          |
| `getSettings()`                                               | Get extension settings               |
| `createNewTask(text, mode?, force?)`                          | Create a new task                    |
| `startTask(text, mode?, force?)`                              | Start a task                         |
| `clearTask()`                                                 | Clear current task                   |
| `popWindow()`                                                 | Go to parent task                    |
| `navigateToTask(taskId)`                                      | Navigate to a specific task          |
| `getTaskStatus()`                                             | Get task status                      |
| `getTaskHierarchy()`                                          | Get task hierarchy                   |
| `getChildTasks()`                                             | Get child tasks                      |
| `getTaskSummary()`                                            | Get task summary                     |
| `getTodoList()`                                               | Get todo list                        |
| `markTaskAsync(taskId)`                                       | Mark task as async                   |
| `waitForTaskIdle(timeoutMs?)`                                 | Wait for task to be idle             |
| `waitForAsk(timeoutMs?, askType?)`                            | Wait for ask response                |
| `getWorkspaceState(fields?)`                                  | Get workspace state                  |
| `getVirtualFiles()`                                           | Get virtual files                    |
| `getCheckpointInfo()`                                         | Get checkpoint info                  |
| `createChildTasks(tasks)`                                     | Create child tasks                   |
| `getAvailableNativeTools()`                                   | Get available native tools           |

## ExtensionModel (Page Model)

Located in [`tests/ExtensionModel.ts`](tests/ExtensionModel.ts).

A Page Model that receives a `DevtoolClient` instance and composes its primitives into declarative, domain-specific methods. Contains **NO transport logic** — no WebSocket, no JSON-RPC, no reconnect.

**Usage:**

```typescript
import { DevtoolClient } from "../packages/devtool/src/client"
import { ExtensionModel } from "./ExtensionModel"

const client = new DevtoolClient()
await client.connect()
const page = new ExtensionModel(client)

await page.navigateToHistory()
await page.verifyActivePage("history")

await client.disconnect()
```

**Or using `createExtensionTest()` (auto lifecycle):**

```typescript
const { run } = createExtensionTest("My Test")

run(async (model: ExtensionModel) => {
	// client is auto-connected
	await model.navigateToHistory()
	await model.verifyActivePage("history")
	// client is auto-disconnected
})
```

**Page Model methods:**

| Method                                        | Description                                        |
| --------------------------------------------- | -------------------------------------------------- |
| `navigateToHistory()`                         | DOM-based: find "History" → click → wait → verify  |
| `navigateToSettings()`                        | DOM-based: find "Settings" → click → wait → verify |
| `navigateToChat(taskId?)`                     | DOM-based or via MCP tool                          |
| `navigateToPage(page, taskId?)`               | Generic page navigation                            |
| `getActivePage()`                             | Read `data-window-type` from DOM                   |
| `verifyActivePage(expected)`                  | Assert active page                                 |
| `waitForDataWindowType(expected, timeoutMs?)` | Poll DOM for expected window type                  |
| `createNewTask(text, mode?)`                  | Create task and return ID                          |
| `getTaskPlan(taskId?)`                        | Get task plan from MST                             |
| `approvePlan()`                               | Approve current plan                               |
| `rejectPlan()`                                | Reject current plan                                |
| `markTaskAsAsync(taskId)`                     | Mark task as async                                 |
| `waitForAsyncTask(taskId, timeoutMs?)`        | Wait for async task completion                     |
| `goToChildTask(taskId)`                       | Navigate to child task                             |
| `goToParentTask()`                            | Navigate to parent task                            |
| `waitForChildTasks(timeoutMs?)`               | Wait for child tasks to appear                     |
| `waitForAgentMode(mode, timeoutMs?)`          | Wait for agent mode switch                         |
| `verifyChatContainsMessage(text, timeoutMs?)` | Wait for message in chat                           |
| `verifyCleanConsole()`                        | Assert no console errors                           |
| `verifyMstTaskState(taskId, expected)`        | Verify MST task state                              |
| `verifyMstActiveNode(taskId)`                 | Verify MST active node                             |
| `verifyMstHasMessages(taskId, minCount)`      | Verify MST has messages                            |
| `switchToAgentMode(mode)`                     | Switch agent mode                                  |
| `getAvailableAgents()`                        | Get available agents                               |
| `verifyAgentBubble(agent, visible)`           | Verify agent bubble visibility                     |
| `verifyParentContext(visible)`                | Verify parent context visibility                   |
| `verifyTaskProgress(expectedPercent)`         | Verify task progress                               |
| `getWorkspaceState()`                         | Get workspace state                                |
| `getVirtualFiles()`                           | Get virtual files                                  |
| `executeConcurrently(tasks)`                  | Run tasks concurrently                             |
| `executeSequentially(tasks)`                  | Run tasks sequentially                             |

## BDD Test Pattern

Tests follow Given/When/Then structure:

```typescript
import { ExtensionModel, createExtensionTest } from "./ExtensionModel"
import { Scenario, Given, When, Then, And } from "./given-when-then"

const { run } = createExtensionTest("My Test Suite")

run(async (model: ExtensionModel) => {
	await Scenario("User can navigate to History", async () => {
		await Given("the app is connected", async () => {
			// model is already connected by createExtensionTest
		})

		await When("I navigate to the History page", async () => {
			await model.navigateToHistory()
		})

		await Then("the active page should be history", async () => {
			await model.verifyActivePage("history")
		})
	})
})
```

### BDD Helpers

| Helper                      | Purpose                                    | Prefix       |
| --------------------------- | ------------------------------------------ | ------------ |
| `Scenario(title, fn)`       | Wraps a test scenario                      | `Scenario: ` |
| `Given(title, fn)`          | Sets up preconditions                      | `Given `     |
| `When(title, fn)`           | Performs an action                         | `When `      |
| `Then(title, fn)`           | Verifies an outcome                        | `Then `      |
| `And(title, fn)`            | Additional context (after Given/When/Then) | `And `       |
| `Examples(cases, callback)` | Data-driven tests                          | —            |

## Navigation (DOM-based)

Navigation is **purely DOM-based** — no events, no MCP tools for switching tabs.

Each navigation method:

1. Finds the target element by text or `data-testid`
2. Clicks it
3. Waits for `data-window-type` attribute to change
4. Verifies the active page

```typescript
await model.navigateToHistory() // Find "History" → click → wait → verify
await model.navigateToSettings() // Find "Settings" → click → wait → verify
await model.navigateToChat() // Find "New Chat" → click → wait → verify
await model.navigateToChat(taskId) // Navigate to specific task via MCP tool
```

## Running Tests

```bash
# Smoke test
npx tsx tests/smoke_test.ts

# Hard tests
npx tsx tests/hard_tests_examples.ts
```

## Requirements

- Node.js 18+
- Jabberwock MCP devtool server running on port 60060
- VS Code with Jabberwock extension and connected MCP client

## Best Practices

1. Use `Scenario`/`Given`/`When`/`Then` for all tests — keeps test reports readable
2. `ExtensionModel` should contain NO transport logic — only declarative methods composing primitives
3. `DevtoolClient` handles all imperative complexity (WebSocket, JSON-RPC, reconnect)
4. Core primitives (`getDom`, `clickElement`, `findElement`) stay simple — like Playwright
5. Navigation is always DOM-based: find → click → wait for `data-window-type` → verify
6. Use `verifyCleanConsole()` after each scenario to catch console errors early
7. Always use `createExtensionTest()` for auto lifecycle management
