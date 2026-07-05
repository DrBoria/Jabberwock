# AGENTS.md — Jabberwock Development Guide

## ⚠️ CRITICAL: Mandatory Verification Before Completion

**YOU MUST RUN `pnpm check-all` BEFORE CALLING `attempt_completion`.**

- This is **NOT optional**. It is a **hard requirement**.
- `pnpm check-all` runs: `pnpm lint` + `pnpm check-types` + `pnpm test`
- **ALL three must pass with 0 errors.**
- If any fail, **FIX them first**, then **re-run `pnpm check-all`** until it passes.
- Defined at [`package.json:21`](package.json:21)
- **Failure to comply will result in build failures and broken code.**

## Project Overview

Jabberwock is a VS Code extension for AI-assisted development. The monorepo uses pnpm workspaces and Turborepo for orchestration.

## Development Workflow

1. Make code changes
2. Run `pnpm lint` to verify no lint errors
3. Run `pnpm check-types` to verify type correctness
4. Run `pnpm test` to verify tests pass
5. Run `pnpm build --force` to verify the build succeeds
6. Use `attempt_completion` only after all checks pass
