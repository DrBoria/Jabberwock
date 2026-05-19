# Smoke Tests

> These smoke tests verify the core functionality of the Jabberwock extension after the Settings crash fix (unhandled promise rejection in webview message handlers).

---

## Test 1: Settings Open/Close with State Persistence

**Goal:** Verify that opening and closing Settings multiple times doesn't break the extension, and that MST state persists across sessions.

**Preconditions:**

- Extension is running and DevTool is connected
- At least one API provider profile is configured

**Steps:**

1. Open Settings (click gear icon in Chat view)
2. Make a change to a setting (e.g., change language, toggle a checkbox)
3. Click "Done" to save and close Settings
4. Verify Chat view is displayed correctly
5. Re-open Settings
6. Verify the change from step 2 is still applied (state persisted)
7. Make another change
8. Close Settings without saving (if discard dialog appears, click Cancel → actually discard)
9. Repeat steps 1-8 at least 3 times total

**Expected Results:**

- [ ] Settings opens successfully each time (no "blank screen")
- [ ] DevTool remains connected throughout (no "DevTool disconnected" message)
- [ ] Messages can be sent and received after each cycle
- [ ] Settings state persists correctly (saved values are retained on re-open)
- [ ] No errors in DevTools console or extension logs

---

## Test 2: Agent-Specific Chat Messaging

**Goal:** Verify that messages are routed to the correct agent, and that independent chat states are maintained when switching agents.

**Preconditions:**

- Multiple agents/modes are configured
- Extension is running with an active chat

**Steps:**

1. Start a new chat and select a specific agent (e.g., "Code" mode)
2. Send a message to that agent
3. Wait for the agent's response
4. Verify the response is from the correct agent (check mode indicator)
5. Start a new chat (`/clear` or click "New Task")
6. Switch to a different agent (e.g., "Architect" mode)
7. Send a message to the new agent
8. Verify the response is from the new agent
9. Navigate back to the first chat (via task history or tab switch)0
10. Verify the first agent's chat history is intact and independent

**Expected Results:**

- [ ] Correct agent responds to each message
- [ ] Chat histories are independent per agent/task
- [ ] Switching between agents doesn't corrupt state
- [ ] No errors or unexpected behavior during agent switch

---

## Test 3: Orchestrator Todo Creation with md-todo-mcp

**Goal:** Verify that the orchestrator can use md-todo-mcp to create a todo list, and that it auto-executes the approved plan steps via deterministic delegation.

**Preconditions:**

- Orchestrator mode is available
- md-todo-mcp MCP server is configured and running

**Steps:**

1. Switch to Orchestrator mode
2. Send a message requesting todo creation with 3 steps, e.g.:
    ```
    Используй md-todo-mcp чтобы создать todo со следующими 3 шагами:
    1. Написать план
    2. Реализовать код
    3. Протестировать
    ```
3. Wait for the orchestrator to process the request
4. Verify the orchestrator calls md-todo-mcp to create the todo
5. Verify the todo is created with 3 steps
6. **CRITICAL:** After plan approval, verify that auto-execution happens correctly:
    - The first step (sync delegation) starts executing immediately via `delegateParentAndOpenChild`
    - Remaining tasks are created as async subtasks
    - All steps execute in the approved order without LLM re-planning
7. Verify that deterministic delegation rewrites the API conversation history to eliminate traces of the mutation conversation, so the child agent only sees the approved plan

**Expected Results:**

- [ ] Orchestrator successfully creates a todo via md-todo-mcp
- [ ] Todo contains exactly 3 steps
- [ ] **Auto-execution IS expected:** After plan approval, [`processDeterministicDelegation()`](src/core/tools/mcp/deterministicDelegation.ts:43) programmatically creates subtasks for each approved task, and the orchestration loop is stopped via `{ isDelegated: true }` (see [`executeTool.ts:98-139`](src/core/tools/mcp/executeTool.ts:98))
- [ ] Steps execute in the approved order without LLM re-planning
- [ ] After all steps are complete, the parent task resumes with a clean history containing only the approved plan
- [ ] No errors during MCP tool invocation or delegation
