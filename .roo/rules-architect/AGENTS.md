# Architect Mode — Jabberwock Planning Rules

## 🔴 CRITICAL: Debug Agent Must Check for Active Session First

**When debugging, the debug agent MUST check for an active debug session BEFORE calling `start_debugging`:**

- They must use `mcp--debug-mcp--list_breakpoints` or `mcp--jabberwock-devtools--get_current_state` first
- If session is already active: DO NOT call `start_debugging` — just proceed with breakpoints
- Never call `start_debugging` twice in a row without checking

If the debug agent fails to follow this protocol, reject and send back.

## 🚫 Delegation Rules for Bug Fixes

**When delegating a BUG to Debug mode:**

- You MUST NOT pass file paths, hypotheses, or "known context"
- Debug mode gets ONLY: bug description + workflow instructions
- Debug mode uses devtool + DebugMCP as single source of truth — your hypotheses are irrelevant
- Example of WRONG delegation: _"Look at src/store/tokenSlice.ts, the token counter is probably wrong there"_
- Example of CORRECT delegation: _"Bug: token count always shows 0. Use devtool+debugger to find root cause."_

**When delegating to Ask mode:**

- NEVER delegate debugging-related questions to Ask mode
- Ask mode is for architecture exploration, documentation, and conceptual questions only
- Ask mode will refuse to investigate bugs

## 🚫 CODE REVIEW IS NOT VERIFICATION

**Reading the fix in source files and saying "looks correct" = ZERO layers of verification. This is strictly forbidden.**

- ❌ "Fix is confirmed in code" — NEVER a valid verification statement
- ❌ Reading modified functions and saying "the fix is in place" — meaningless without runtime confirmation
- ❌ Any statement like "Fix in place ✅" based solely on reading source code

**The ONLY valid verification is runtime testing via devtool + DebugMCP.**

$1

1. **Gather context** using Serena MCP + RPG Encoder:

    - `mcp--serena--get_symbols_overview` → file structure
    - `mcp--serena--find_symbol` / `mcp--serena--find_referencing_symbols` → relationships
    - `mcp--rpg-encoder--search_node` / `mcp--rpg-encoder--explore_rpg` → dependency graph
    - `mcp--serena--read_memory` → existing project memories

2. **Create a clear plan** with specific steps in logical execution order

3. **Delegate** to appropriate modes:

    - Debug mode for bug investigation (ONLY bug description, no hypotheses)
    - Code mode for implementation (with confirmed root cause)
    - Ask mode for architecture questions (no debugging)

4. **Save plans** to `plans/` directory

## Documentation Rules

- AGENTS.md and .roo/rules-\* files must be MAXIMALLY LACONIC — only non-obvious project-specific info
- Serena memories should be used for detailed architectural knowledge
