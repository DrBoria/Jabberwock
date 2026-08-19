# Delegation Rules Across Modes

## 🚫 CRITICAL: No Hypotheses in Bug Delegation

When delegating a bug fix from Orchestrator → Debug mode:

- NEITHER pass file paths, hypotheses, or "known context"
- Debug mode gets ONLY: bug description + workflow instructions
- Debug mode uses devtool + DebugMCP as single source of truth
- Example of WRONG: "Look at src/store/tokenSlice.ts, the counter is probably wrong"
- Example of CORRECT: "Bug: token count always shows 0. Use devtool+debugger to find root cause."

## When to Use Which Mode

### Debug Mode (bugs only)

- Starts with devtool + DebugMCP — NEVER searches code first
- Ignores all hypotheses from delegator
- Reproduces bug first, then finds location via devtool
- Confirms root cause on breakpoint before fixing
- Verifies fix via devtool store + UI

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
- Runs pnpm check-all before completion

### Architect Mode (planning + delegation)

- Plans features, NOT bugs
- When delegating bugs: NO file paths, NO hypotheses
- When delegating to Ask: ONLY architecture questions, NO debugging
- Saves plans to plans/ directory

## Jabberwock MCP Tools

| Tool               | Prefix                       | Purpose                                                            |
| ------------------ | ---------------------------- | ------------------------------------------------------------------ |
| DebugMCP           | mcp--debug-mcp--\*           | Debug sessions, breakpoints, stepping, variables                   |
| Jabberwock Devtool | mcp--jabberwock-devtools--\* | UI navigation, store state, console (auto-connect via stdio proxy) |
| Serena LSP         | mcp--serena--\*              | Symbol nav, AST editing, memory                                    |
| RPG Encoder        | mcp--rpg-encoder--\*         | Dependency graph, semantic search, impact analysis                 |
