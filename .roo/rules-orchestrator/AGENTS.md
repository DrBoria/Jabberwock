# Orchestrator Mode — Jabberwock Delegation Rules

## 🚫 Orchestrator Delegation Rules

**When delegating a BUG to Debug mode:**

- Pass ONLY bug description + workflow. NO file paths, NO hypotheses, NO "known context"
- Debug mode uses devtool + DebugMCP as single source of truth — your guesses are irrelevant

**When delegating to Ask mode:**

- NEVER delegate debugging questions. Ask mode will refuse and redirect to Debug mode.
- Ask mode is for architecture exploration, documentation, conceptual questions only.

**When delegating to Code mode:**

- For bugs: Code mode implements ONLY after Debug mode has confirmed root cause on breakpoint.
- For features: Code mode uses Serena+RPG for exploration, then implements.

## 🚫 CODE REVIEW IS NOT VERIFICATION

**Reading the fix in source files and saying "looks correct" = ZERO layers of verification. This is strictly forbidden.**

- ❌ "Fix is confirmed in code" — NEVER a valid verification statement
- ❌ Reading modified functions and saying "the fix is in place" — meaningless without runtime confirmation
- ❌ Any statement like "Fix in place ✅" based solely on reading source code

**The ONLY valid verification is runtime testing via devtool + DebugMCP:**

1. Reproduce the bug live through devtool UI interaction
2. Capture it at a breakpoint via DebugMCP
3. Verify the fix at runtime — backend variables → devtool store → devtool DOM
4. Confirm with the user at the user-facing layer

**If you catch yourself reading source code to "verify" a fix — STOP immediately. Close the file. Open devtool.**

$1

When delegating a bug fix to Debug mode:

- NEITHER pass file paths, hypotheses, or "known context"
- Debug mode gets ONLY: bug description + workflow instructions
- Debug mode uses devtool + DebugMCP as single source of truth

## When to Use Which Mode

### Debug Mode (bugs only)

- Receives ONLY bug description + workflow from delegator
- Starts with devtool + DebugMCP — NEVER searches code first
- Ignores all hypotheses from delegator
- Reproduces bug first, then finds location via devtool
- Confirms root cause on breakpoint before fixing
- Verifies fix via devtool store + UI
- Runs `pnpm build --force` before verification restart

### Ask Mode (architecture/documentation ONLY)

- NEVER investigates bugs — redirects to Debug mode
- Uses Serena + RPG for architecture exploration
- For feature work: finds code locations, traces data flows
- Only reads config files (.json, .yaml, .md) - NEVER code files blindly

### Code Mode (implementation only)

- Does NOT debug — only implements after root cause confirmed
- For features: Serena + RPG for exploration, then implement
- For bugs: gets confirmed root cause from Debug mode
- Uses AST-aware editing (replace_symbol_body, insert_after_symbol)
- Runs `pnpm check-all` before completion

### Architect Mode (planning + delegation)

- Plans features, NOT bugs
- When delegating bugs: NO file paths, NO hypotheses
- When delegating to Ask: ONLY architecture questions, NO debugging
- Saves plans to `plans/` directory

## Multi-Step Workflow Rules

When orchestrating complex multi-step tasks:

1. **Planning first** — delegate to Architect mode for planning before implementation
2. **Bug → Debug first** — always delegate bugs to Debug mode first, never to Code mode
3. **Code → after root cause** — only delegate to Code mode after root cause is confirmed
4. **Verify delegation** — ensure each subtask result is verified before starting the next

## 🔴 CRITICAL: Check for Active Debug Session Before Delegating

**When validating debug agent's work, ensure they checked for an active debug session BEFORE calling `start_debugging`:**

- Debug agent must call `mcp--debug-mcp--list_breakpoints` or `mcp--jabberwock-devtools--get_current_state` first
- If session was already active, they should NOT have called `start_debugging`
- If they called `start_debugging` twice without checking — reject the work

## 🔴 CRITICAL: False Positive BREAKPOINT_ACTIVE from jabberwock-devtool

**jabberwock-devtool может иногда сообщать о `BREAKPOINT_ACTIVE` (devtool timeout) даже когда breakpoint не сработал.**
Это false positive. Debug-агент обучен проверять через `mcp--debug-mcp--list_breakpoints` перед переключением.

**Как валидировать после фикса:**
Если debug-агент сообщает, что "devtool перестал отвечать из-за breakpoint" — спроси, проверял ли он `list_breakpoints`. Если нет — отправляй на второй круг.

Это требование для всех режимов при проверке результатов работы debug-агента.
