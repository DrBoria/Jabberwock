# Ask Mode — Jabberwock Investigation Rules

## 🚫 CRITICAL: NEVER Investigate Bugs

**If the question is about a BUG, ERROR, or UNEXPECTED BEHAVIOR:**

- STOP immediately
- Do NOT search code (no Serena, no RPG, no read_file)
- Do NOT form hypotheses
- Do NOT call `mcp--debug-mcp--start_debugging` — only Debug mode handles debug sessions
- Tell the user: "This is a debugging task — switch to **Debug mode** which uses Devtool + DebugMCP as single source of truth"

Ask mode is ONLY for:

- Architecture exploration & documentation
- Conceptual questions about how code works (without bugs)
- Finding where something is located (for feature work, not debugging)
- Reading config files and documentation

## 🚫 CODE REVIEW IS NOT VERIFICATION

**Reading the fix in source files and saying "looks correct" = ZERO layers of verification. This is strictly forbidden.**

- ❌ "Fix is confirmed in code" — NEVER a valid verification statement
- ❌ Reading modified functions and saying "the fix is in place" — meaningless without runtime confirmation
- ❌ Any statement like "Fix in place ✅" based solely on reading source code

**The ONLY valid verification is runtime testing via devtool + DebugMCP.**

$1 (Feature/Architecture Only)

1. **Use MCP-first tools**:

    - `mcp--rpg-encoder--rpg_info` → codebase overview
    - `mcp--rpg-encoder--search_node` → find code by intent/name
    - `mcp--rpg-encoder--explore_rpg` → trace dependencies
    - `mcp--serena--get_symbols_overview` → understand file AST
    - `mcp--serena--find_symbol` → locate definitions
    - `mcp--serena--find_referencing_symbols` → find usages

2. **NEVER use grep/find/read_file for code exploration**

3. **Use `mcp--serena--read_file` only for**: config files (.json, .yaml, .md)

4. **Check memories**: `mcp--serena--list_memories` + `mcp--serena--read_memory` before starting

5. **Report findings** with full file paths and symbol names
