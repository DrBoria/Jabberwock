# Verification Rules for UI Bugs

## 🔴 TURBO CACHE RULE

**Always use `pnpm build --force` before verification, never `pnpm build`.**
Turbo cache serves stale artifacts. Extension Host runs old code even after build succeeds.

- ❌ `pnpm build` → debug restart → verify → "works" (cached code, NOT verified)
- ✅ `pnpm build --force` → debug restart → verify → actually confirmed

## 🚫 CODE REVIEW IS NOT VERIFICATION

**Reading the fix in source files and saying "looks correct" = ZERO layers of verification. This is strictly forbidden.**

- ❌ "Fix is confirmed in code" — this is NEVER a valid verification statement
- ❌ Reading the modified function and saying "the fix is in place" — this is meaningless without runtime confirmation
- ❌ Any statement like "Fix in place ✅" based solely on reading source code

**The ONLY valid verification is runtime testing via devtool + DebugMCP:**

1. Reproduce the bug live through devtool UI interaction
2. Capture it at a breakpoint via DebugMCP
3. Verify the fix at runtime — backend variables → devtool store → devtool DOM
4. Confirm with the user at the user-facing layer

**If you catch yourself reading source code to "verify" a fix — STOP immediately. Close the file. Open devtool.**

## 🔴 THREE-LAYER VERIFICATION

**UI bug = ALL THREE layers must be verified.** Never stop at layer 1 or 2.

1. **Backend/store state** — DebugMCP: `get_variables_values`, `evaluate_expression` — confirm data in runtime
2. **Store state** — devtool: `mcp--jabberwock-devtools--get_store_state` — confirm data in webview store
3. **UI** — devtool: `mcp--jabberwock-devtools--find_element` with `command="$0.textContent"` — confirm rendered UI shows correct values

**Нельзя валидировать фикс только в debugger'е (breakpoint/variables). Store и UI — единственный source of truth для UI-багов.**

## 🔴 DEFINITION OF "FIXED AND VERIFIED"

Bug is NOT "FIXED AND VERIFIED" until confirmed at the USER-FACING layer:

1. Fix applied in code ✓
2. `pnpm build --force` (bust turbo cache) ✓
3. Debug restart with fresh artifacts ✓
4. Runtime confirmation in debugger ✓
5. Store state AND webview UI verified via devtool ✓
6. User confirms fix works ✓

## 🔴 NO PREMATURE COMPLETION

Never mark a bug as "FIXED AND VERIFIED" in the todo list until ALL verification layers pass.

**Violation pattern (DO NOT REPEAT):**

1. ❌ Fix code → build → check backend → "looks correct" → mark "FIXED AND VERIFIED" → move to next bug
2. ✅ Fix code → `pnpm build --force` → restart debugger → check backend → check store → check UI → confirm with user → mark "FIXED AND VERIFIED"

**When verification fails at any layer, STOP. Do NOT proceed to the next bug. Investigate WHY (turbo cache? wrong data path? build not deployed?).**

## Warning Signs

- ❌ "Variables look right in debugger" → NOT verified. Check the UI too.
- ❌ "Build succeeded" → NOT verified. Check the running application.
- ❌ "pnpm build (no --force) passed" → NOT verified. Cached artifacts.
- ❌ "Store state is correct" → NOT verified. Check the rendered UI.
