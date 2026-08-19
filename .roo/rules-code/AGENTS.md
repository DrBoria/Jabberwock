# Code Mode — Jabberwock Implementation Rules

## 🚫 Code Mode Does NOT Debug

**Code mode implements changes ONLY after root cause is confirmed via Debug mode (devtool + debugger).**

- NEVER call `mcp--debug-mcp--start_debugging` directly. Debug mode handles all debug sessions.
- If you need to verify a fix: use devtool (`mcp--jabberwock-devtools--*`), which works without DebugMCP.
- If you receive a task about a BUG without a confirmed root cause → STOP, tell user to use Debug mode
- Do NOT search for bugs via code exploration — devtool + debugger are the single source of truth

## Feature Implementation Workflow

1. **Architecture exploration** via Serena MCP + RPG Encoder:

    - `mcp--serena--get_symbols_overview` → understand file AST
    - `mcp--serena--find_symbol` / `mcp--serena--find_referencing_symbols`
    - `mcp--rpg-encoder--search_node` / `mcp--rpg-encoder--explore_rpg`

2. **Plan** the changes (what symbols need modification)

3. **Implement** using Serena LSP editing tools:

    - PREFER: `mcp--serena--replace_symbol_body`, `mcp--serena--insert_after_symbol`, `mcp--serena--insert_before_symbol`
    - SECOND: `mcp--serena--replace_content` (regex mode preferred)
    - LAST: `mcp--serena--create_text_file` (new files only)

4. **Run `pnpm check-all`** — lint + check-types + tests. All must pass 0 errors.

5. **Verify with devtool** — after code changes, restart debugger and verify via Jabberwock Devtool (автоконнект через stdio MCP proxy, не требует ручного подключения)

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

## Coding Standards

- **NO `any`, `as unknown`, `ts-ignore`, `eslint-ignore`** — fix all type issues properly
- Fix all pre-existing errors and warnings encountered
- When deleting code, delete cleanly — no leftover comments

## Code Navigation (NEVER grep/find/read_file for exploration)

- `get_symbols_overview` → first step for any file
- `find_symbol` → locate definitions
- `find_referencing_symbols` → find usages
- `search_node` → semantic intent search
- `explore_rpg` → dependency graph
- `mcp--serena--read_file` → config files only (.json, .yaml, .md)
