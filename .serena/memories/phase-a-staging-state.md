# Phase A staging state (branch mega-refactoring, HEAD 2574bd280)

Phase A (A0–A3 of plans/architecture-v4-connector-abstraction.md) is implemented and **STAGED (not committed)**. Task: cleanup + staging only; do NOT start Phase B / protocol types.

## Staged set (index = exactly Part A)

- RENAMES (R): 2483 — src→backend, webview-ui→frontend (A1)
- MODIFICATIONS (M): 22 — A2/A3 config edits (.rooignore, backend/package.json, AGENTS.md, root configs, scripts/\*)
- ADDITIONS (A): 9 — backend/shared/webviewBuildDir.ts, connectors/{vscode,web}/{package.json,tsconfig.json} (4), reports/audit-platform.json, scripts/audit-platform.mjs, backend/.prettierignore, backend/eslint.config.mjs
- DELETIONS (D): 3 — src/.prettierignore, src/eslint.config.mjs, scripts/compact-max-lines.mjs (tracked junk)

## Files DELETED from worktree (not in staged set)

- frontend/vite.config.ts.bak — removed from index + worktree; original webview-ui/vite.config.ts.bak stays in HEAD untracked-staged-removed (git show shows D webview-ui/vite.config.ts.bak unstaged)
- scripts/compact-max-lines.mjs (was TRACKED, git rm -f)
- connectors/\*/README.md ×4 (untracked, plain rm)

## KEPT (plan-mandated)

- scripts/audit-platform.mjs, reports/audit-platform.json (audit baseline), connectors/\*/tsconfig.json + package.json, plans/architecture-audit-report.md

## Excluded (NOT staged, NOT touched)

- DebugMCP/, loseless-context/ — untracked nested git repos (NEVER stage/touch)
- md-todo-mcp — nested repo (gitlink), pre-existing dirty, excluded
- .rpg/graph.json — tooling cache, unstaged after git add -A sweep
- webview-ui/vite.config.ts.bak — left in HEAD (git add -A re-stages its deletion; must git restore --staged it)

## Gates (both PASS)

- pnpm check-all → exit 0 (lint 17/17, check-types 19/19, test 2/2)
- pnpm audit:platform → exit 0, "inventory matches committed baseline" (169 backend / 56 frontend)

## Edits made this task

- backend/package.json watch:tsc → `cd .. && tsc --noEmit --watch --project backend/tsconfig.json` (was src/tsconfig.json)
- .rooignore: webview-ui/node_modules→frontend/node_modules, webview-ui/.turbo→frontend/.turbo
- Comment-only: backend/shared/string-extensions.d.ts (2), backend/services/command/built-in-commands/init-command-p2.ts, frontend/src/features/intents/IntentConstants.ts, scripts/find-missing-translations.js

## Verification commands

- `git status --porcelain=v1` → 2 ?? (DebugMCP, loseless-context), 9 A, 4 D, 24 M, 2483 R
- `git diff --cached --stat` → 2517 files changed
- NO commit made (git log HEAD unchanged)
