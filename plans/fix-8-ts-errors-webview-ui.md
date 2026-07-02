# Fix 8 TypeScript Errors in `@jabberwock/vscode-webview`

## Root Cause

Previous "unused variable" lint fix renamed destructured props with `_` prefix. However, TypeScript destructuring rename (`{ propName: _propName }`) requires the original name to exist in the props interface. The `_`-prefixed names don't exist in the interfaces, causing `TS2339: Property does not exist on type`.

## Fix

**Remove unused props from destructuring entirely** in 3 files. These props are passed FROM the parent TO the child, but the child component never uses them in its JSX — they simply don't need to be destructured.

---

### File 1: [`webview-ui/src/features/settings/agents/components/modes-view/header-section.tsx`](webview-ui/src/features/settings/agents/components/modes-view/header-section.tsx)

**Line 74** — Remove `_setIsCreateModeDialogOpen` from destructuring:

```diff
-	_setIsCreateModeDialogOpen,
+	// Remove this line entirely
}) => {
```

The prop `setIsCreateModeDialogOpen` is received from parent (`layout.tsx:88`) but is never used in `HeaderSection`'s JSX. It was being passed through to `<ModeToolbar>` but `ModeToolbar` doesn't use it either.

---

### File 2: [`webview-ui/src/features/settings/agents/components/modes-view/layout.tsx`](webview-ui/src/features/settings/agents/components/modes-view/layout.tsx)

**Line 54** — Remove `_renameInputRef, _searchInputRef` from destructuring:

```diff
-	_renameInputRef, _searchInputRef, isExporting, isImporting, isCreateModeDialogOpen,
+	isExporting, isImporting, isCreateModeDialogOpen,
```

These props are received from the parent but never used in `ModesViewLayout`'s JSX. They are NOT passed to any child component.

---

### File 3: [`webview-ui/src/features/settings/agents/components/modes-view/toolbar.tsx`](webview-ui/src/features/settings/agents/components/modes-view/toolbar.tsx)

**Lines 45-55** — Remove `_isRenamingMode`, `_renameInputValue`, `_onSaveRename`, `_onCancelRename`, `_onRenameInputChange` from destructuring:

```diff
-	_isRenamingMode,
-	_renameInputValue,
	isExporting,
	...
-	_onSaveRename,
-	_onCancelRename,
-	_onRenameInputChange,
```

These props are received from parent but never used in `ModeToolbar`'s JSX (the rename UI is rendered elsewhere — in `header-section.tsx` lines 147-166 which passes them down, but `ModeToolbar` just receives and ignores them).

---

## Verification

After applying these 3 edits, verify with:

```bash
cd /Users/mikita_dusmikeev/Documents/Work/jabberwock/Jabberwock && pnpm --filter @jabberwock/vscode-webview build 2>&1
```

```bash
cd /Users/mikita_dusmikeev/Documents/Work/jabberwock/Jabberwock && CI=true npx turbo check-types 2>&1
```

```bash
cd /Users/mikita_dusmikeev/Documents/Work/jabberwock/Jabberwock && CI=true npx turbo lint 2>&1
```

Expected result: ALL 3 checks pass with zero errors.
