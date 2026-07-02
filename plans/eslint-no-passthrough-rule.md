# ESLint Rules: Passthrough, Re-export, and Index File Purity

Three custom ESLint rules to prevent unnecessary wrapper files and enforce index file discipline.

---

## Rule 1: `local/no-passthrough` — Ban Exported Passthrough Wrappers

### Problem

Files that exist only to export a function that does nothing except call another function:

```typescript
// File: createUpdateApiReqMsg.ts  ← this file shouldn't exist
export function createUpdateApiReqMsg(sh, tokenState, store, taskId, delegate, retryCount = 0) {
	return updateApiReqMsg(sh, tokenState, store, taskId, delegate, retryCount)
}

// File: someWrapper.ts  ← this file shouldn't exist
export const doThing = (...args) => otherModule.doThing(...args)
```

**Only EXPORTED functions are checked.** Internal helpers, callbacks, handlers, etc. are NOT flagged:

```typescript
// NOT flagged — not exported
function helper(x) {
	return g(x)
}
array.map((x) => transform(x))
useCallback((x) => f(x), [x])
;() => deps.foo()
```

### AST Logic

```
For each FunctionDeclaration, FunctionExpression, ArrowFunctionExpression:

1. Collect into candidates array for later processing
2. Also collect all exported names from ExportNamedDeclaration nodes
   (both direct `export function f` and indirect `export { f }`)

After all nodes processed (Program:exit):
3. Check if the function is exported:
   a. Direct: parent chain reaches ExportNamedDeclaration/ExportDefaultDeclaration
   b. Indirect: function/variable name matches an ExportNamedDeclaration specifier
   -> If NOT exported -> skip

4. Get the return expression:
   - Block body: must have EXACTLY 1 statement = ReturnStatement
   - Arrow expression body: use directly
   - Otherwise -> skip

5. The return expression must be a CallExpression -> otherwise skip

6. Report violation
```

### Exported vs Non-exported examples

| Pattern                                         | Exported?                                              | Result         |
| ----------------------------------------------- | ------------------------------------------------------ | -------------- |
| `export function f(x) { return g(x); }`         | ✅ Yes (parent ExportNamedDeclaration)                 | ❌ Flagged     |
| `export const f = (x) => g(x)`                  | ✅ Yes (chain reaches ExportNamedDeclaration)          | ❌ Flagged     |
| `export default function f(x) { return g(x); }` | ✅ Yes (parent ExportDefaultDeclaration)               | ❌ Flagged     |
| `export default (x) => g(x)`                    | ✅ Yes (parent ExportDefaultDeclaration)               | ❌ Flagged     |
| `const f = (x) => g(x); export { f }`           | ✅ Yes (indirect via ExportNamedDeclaration specifier) | ❌ Flagged     |
| `const f = (x) => g(x); export { f as alias }`  | ✅ Yes (indirect via specifier)                        | ❌ Flagged     |
| `function f(x) { return g(x); }`                | ❌ No (parent Program)                                 | ✅ Not flagged |
| `const f = (x) => g(x)`                         | ❌ No (chain stops at VariableDeclaration)             | ✅ Not flagged |
| `{ key: (x) => f(x) }`                          | ❌ No (parent Property)                                | ✅ Not flagged |
| `array.map(x => f(x))`                          | ❌ No (parent CallExpression)                          | ✅ Not flagged |
| `export const api = { key: (x) => f(x) }`       | ❌ No (arrow is under Property, not directly exported) | ✅ Not flagged |

### Rule Code

```javascript
// packages/config-eslint/rules/no-passthrough.js

/** @type {import("eslint").Rule.RuleModule} */
const noPassthroughRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow exported functions that do nothing except call another function and return its result.",
		},
		fixable: "code",
		schema: [],
		messages: {
			passthrough:
				"'{{name}}' is an exported passthrough wrapper that only calls '{{target}}'. Extract the file's logic or remove this function.",
		},
	},
	create(context) {
		/** @type {Array<{node: import("estree").Function, name: string | null}>} */
		const candidates = []

		/** @type {Set<string>} */
		const exportedNames = new Set()

		return {
			// ----- Collect all function candidates -----
			FunctionDeclaration(node) {
				candidates.push({ node, name: node.id?.name ?? null })
			},
			FunctionExpression(node) {
				candidates.push({ node, name: getCandidateName(node) })
			},
			ArrowFunctionExpression(node) {
				candidates.push({ node, name: getCandidateName(node) })
			},

			// ----- Collect all exported names -----
			ExportNamedDeclaration(node) {
				// Case 1: export function f() {} / export const f = () => {}
				if (node.declaration) {
					if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
						exportedNames.add(node.declaration.id.name)
					} else if (node.declaration.type === "VariableDeclaration") {
						for (const decl of node.declaration.declarations) {
							if (decl.id?.type === "Identifier") {
								exportedNames.add(decl.id.name)
							}
						}
					}
				}
				// Case 2: export { name } or export { name as alias }
				if (node.specifiers) {
					for (const spec of node.specifiers) {
						exportedNames.add(spec.local.name)
					}
				}
			},

			// ----- Check all candidates after full traversal -----
			"Program:exit"() {
				for (const { node, name } of candidates) {
					const isExported = checkIsExported(node, name, exportedNames)
					if (!isExported) continue

					const returnArg = getReturnExpression(node)
					if (!returnArg || returnArg.type !== "CallExpression") continue

					const funcName = getFunctionName(node)
					const target = getCallTarget(returnArg)

					context.report({
						node,
						messageId: "passthrough",
						data: { name: funcName, target },
					})
				}
			},
		}
	},
}

/**
 * Get the candidate name for tracking whether the function might be indirectly exported.
 */
function getCandidateName(node) {
	if (node.type === "FunctionDeclaration") {
		return node.id?.name ?? null
	}
	// ArrowFunctionExpression or FunctionExpression assigned to a variable
	if (node.parent?.type === "VariableDeclarator") {
		return node.parent.id?.type === "Identifier" ? node.parent.id.name : null
	}
	if (node.parent?.type === "AssignmentExpression") {
		return node.parent.left?.type === "Identifier" ? node.parent.left.name : null
	}
	return null
}

/**
 * Check if a function node is exported -- either directly or indirectly.
 *
 * "Directly" means the AST parent chain includes ExportNamedDeclaration/ExportDefaultDeclaration.
 * "Indirectly" means the function/variable name appears in an `export { name }` statement.
 */
function checkIsExported(node, name, exportedNames) {
	// Direct: export function f() {} / export default function f() {}
	if (node.parent?.type === "ExportNamedDeclaration" || node.parent?.type === "ExportDefaultDeclaration") {
		return true
	}

	// Direct: export const f = () => {} / export const f = function() {}
	if (node.parent?.type === "VariableDeclarator") {
		if (
			node.parent.parent?.type === "VariableDeclaration" &&
			node.parent.parent.parent?.type === "ExportNamedDeclaration"
		) {
			return true
		}
		// Indirect: const f = () => {} followed by export { f } elsewhere
		if (name && exportedNames.has(name)) {
			return true
		}
	}

	// Indirect: function f() {} followed by export { f } elsewhere
	if (name && exportedNames.has(name)) {
		return true
	}

	return false
}

/**
 * Extract the return expression from a function node.
 */
function getReturnExpression(node) {
	// Block body: must be exactly 1 return statement
	if (node.body.type === "BlockStatement") {
		const stmts = node.body.body
		if (stmts.length !== 1) return null
		const first = stmts[0]
		if (first.type !== "ReturnStatement" || !first.argument) return null
		return first.argument
	}
	// Arrow with expression body: (x) => g(x)
	if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement") {
		return node.body
	}
	return null
}

function getFunctionName(node) {
	if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
		return node.id?.name || "(anonymous)"
	}
	const parent = node.parent
	if (!parent) return "(anonymous)"

	if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
		return parent.id.name
	}
	if (parent.type === "Property" && parent.key.type === "Identifier") {
		return parent.key.name
	}
	if (parent.type === "AssignmentExpression" && parent.left.type === "Identifier") {
		return parent.left.name
	}
	return "(anonymous)"
}

function getCallTarget(expr) {
	const callee = expr.callee
	if (callee.type === "Identifier") return callee.name
	if (callee.type === "MemberExpression") {
		const object =
			callee.object.type === "ThisExpression"
				? "this"
				: callee.object.type === "Identifier"
					? callee.object.name
					: "?"
		const prop = callee.property.type === "Identifier" ? callee.property.name : "?"
		return `${object}.${prop}`
	}
	return "(expression)"
}

export default noPassthroughRule
```

---

## Rule 2: `local/no-reexport` — Ban Re-exports in Non-index Files

### Problem

Files that are NOT named `index.ts`/`index.tsx` but contain re-exports, creating empty/dependency-only files:

```typescript
// File: ViewComponent.ts  <- BAD: this file is not index.ts
export { ViewComponent } from "../some/place.tsx"
```

This is acceptable ONLY for `index.ts`/`index.tsx` files (barrel exports).

### AST Logic

```
For each ExportNamedDeclaration and ExportAllDeclaration:
1. If the file is named index.ts or index.tsx -> skip
2. If the declaration has no `source` (from 'path') -> skip (it's a local export)
3. Otherwise -> report violation
```

### Rule Code

```javascript
// packages/config-eslint/rules/no-reexport.js

import path from "node:path"

/** @type {import("eslint").Rule.RuleModule} */
const noReexportRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow re-exports in non-index files. Only index.ts/index.tsx should re-export from other modules.",
		},
		schema: [],
		messages: {
			noReexport:
				"Re-exports are only allowed in index.ts/index.tsx files. Move this export to an index file or import directly.",
		},
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const basename = path.basename(filename)
		const isIndexFile = /^index\.[a-z]+$/.test(basename)

		if (isIndexFile) {
			// Index files are exempt -- skip entirely
			return {}
		}

		return {
			ExportNamedDeclaration(node) {
				// Only flag re-exports with `from 'path'`
				if (!node.source) return
				context.report({ node, messageId: "noReexport" })
			},
			ExportAllDeclaration(node) {
				// export * from 'path'
				if (!node.source) return
				context.report({ node, messageId: "noReexport" })
			},
		}
	},
}

export default noReexportRule
```

---

## Rule 3: `local/no-logic-in-index` — Ban Logic in Index Files

### Problem

Index files (`index.ts`/`index.tsx`) should be pure barrel files — only import/export statements, never actual logic.

```typescript
// File: index.ts  <- BAD: contains logic
export const API_URL = "https://api.example.com"

// File: index.ts  <- also BAD
export function helper() {
	return 42
}

// File: index.ts  <- also BAD
import { processData } from "./processor"
processData() // side effect at module level
```

Allowed:

```typescript
// File: index.ts  <- GOOD: pure barrel
export { ViewComponent } from "./ViewComponent"
export { useHook } from "./useHook"
export type { Props } from "./types"

// File: index.ts  <- also GOOD
import { ViewComponent } from "./ViewComponent"
import { useHook } from "./useHook"
export { ViewComponent, useHook }
```

### AST Logic

```
For each index.ts/index.tsx file:
1. Check every top-level statement in Program.body
2. Allowed statements:
   - ImportDeclaration (import ...)
   - ExportAllDeclaration (export * from ...)
   - ExportNamedDeclaration with specifiers and NO declaration (export { ... })
3. Flagged statements:
   - ExportNamedDeclaration with declaration (export const x = ...)
   - ExportDefaultDeclaration (export default ...)
   - VariableDeclaration (const x = ...)
   - FunctionDeclaration (function ...)
   - ClassDeclaration (class ...)
   - ExpressionStatement (side effects)
   - Any other non-import/export statement type
```

### Rule Code

```javascript
// packages/config-eslint/rules/no-logic-in-index.js

import path from "node:path"

/** @type {import("eslint").Rule.RuleModule} */
const noLogicInIndexRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow logic in index.ts/index.tsx files. Index files should only contain import/export statements.",
		},
		schema: [],
		messages: {
			logicInIndex: "Index files must not contain logic. Only imports and re-exports are allowed here.",
		},
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const basename = path.basename(filename)
		const isIndexFile = /^index\.[a-z]+$/.test(basename)

		if (!isIndexFile) {
			return {}
		}

		return {
			Program(program) {
				for (const node of program.body) {
					if (isAllowedInIndex(node)) continue
					context.report({ node, messageId: "logicInIndex" })
				}
			},
		}
	},
}

/**
 * Check if a top-level statement is allowed in an index file.
 */
function isAllowedInIndex(node) {
	// import { X } from '...'
	if (node.type === "ImportDeclaration") return true

	// export * from '...'
	if (node.type === "ExportAllDeclaration") return true

	// export { Foo } or export { Foo } from '...' (specifiers only, no declaration)
	if (node.type === "ExportNamedDeclaration") {
		// export const x = ... or export function f() {} -> NOT allowed (= has declaration)
		if (node.declaration) return false
		// export { Foo } -> allowed (has specifiers, no declaration)
		return true
	}

	// Everything else (VariableDeclaration, FunctionDeclaration, ClassDeclaration,
	// ExpressionStatement, ExportDefaultDeclaration, etc.) -> NOT allowed
	return false
}

export default noLogicInIndexRule
```

---

## Base Config Update

In `packages/config-eslint/base.js`:

```diff
  import onlyWarn from "eslint-plugin-only-warn"
+ import noPassthrough from "./rules/no-passthrough.js"
+ import noReexport from "./rules/no-reexport.js"
+ import noLogicInIndex from "./rules/no-logic-in-index.js"

  export const config = [
  	js.configs.recommended,
  	eslintConfigPrettier,
  	...tseslint.configs.recommended,
  	{
  		plugins: {
  			turbo: turboPlugin,
+ 			local: {
+ 				rules: {
+ 					"no-passthrough": noPassthrough,
+ 					"no-reexport": noReexport,
+ 					"no-logic-in-index": noLogicInIndex,
+ 				},
+ 			},
  		},
  		rules: {
  			"turbo/no-undeclared-env-vars": "off",
+ 			"local/no-passthrough": "error",
+ 			"local/no-reexport": "error",
+ 			"local/no-logic-in-index": "error",
  		},
  	},
```

---

## Test Cases

### `local/no-passthrough`

| #   | Code                                                                   | Expected                                        |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `export function f(x) { return g(x); }`                                | ❌ error                                        |
| 2   | `export const f = (x) => g(x)`                                         | ❌ error                                        |
| 3   | `export default function f(x) { return g(x); }`                        | ❌ error                                        |
| 4   | `export default (x) => g(x)`                                           | ❌ error                                        |
| 5   | `export function f(...args) { return g(...args); }`                    | ❌ error                                        |
| 6   | `export function f({a,b}) { return bar(a,b); }`                        | ❌ error                                        |
| 7   | `export function f(e) { return onClick(e.target.value); }`             | ❌ error                                        |
| 8   | `export function f(x = 1) { return g(x); }`                            | ❌ error                                        |
| 9   | `export async function f(x) { return g(x); }`                          | ❌ error                                        |
| 10  | `export function f() { return g(); }`                                  | ❌ error                                        |
| 11  | `const f = (x) => g(x); export { f }`                                  | ❌ error (indirect export)                      |
| 12  | `const f = (x) => g(x); export { f as alias }`                         | ❌ error (indirect export with alias)           |
| 13  | `function f(x) { return g(x); }`                                       | ✅ no error (not exported)                      |
| 14  | `const f = (x) => g(x)`                                                | ✅ no error (not exported)                      |
| 15  | `array.map(x => f(x))`                                                 | ✅ no error (not exported)                      |
| 16  | `useCallback((x) => f(x), [x])`                                        | ✅ no error (not exported)                      |
| 17  | `export function f(x) { if (!x) throw E(); return g(x); }`             | ✅ no error (has validation)                    |
| 18  | `export function f(x) { const y = x + 1; return g(y); }`               | ✅ no error (has transform)                     |
| 19  | `export function f(x) { return x > 0 ? g(x) : h(x); }`                 | ✅ no error (not a CallExpression)              |
| 20  | `export function f(x) { try { return g(x); } catch { return h(x); } }` | ✅ no error (TryStatement, not ReturnStatement) |

### `local/no-reexport`

| #   | Code                          | File name   | Expected                       |
| --- | ----------------------------- | ----------- | ------------------------------ |
| 1   | `export { Foo } from "./foo"` | `bar.ts`    | ❌ error                       |
| 2   | `export { Foo } from "./foo"` | `bar.tsx`   | ❌ error                       |
| 3   | `export * from "./foo"`       | `bar.ts`    | ❌ error                       |
| 4   | `export { Foo } from "./foo"` | `index.ts`  | ✅ no error                    |
| 5   | `export * from "./foo"`       | `index.ts`  | ✅ no error                    |
| 6   | `export { Foo } from "./foo"` | `index.tsx` | ✅ no error                    |
| 7   | `export const x = 1`          | `bar.ts`    | ✅ no error (no `from` source) |
| 8   | `export interface Foo {}`     | `bar.ts`    | ✅ no error (not a re-export)  |

### `local/no-logic-in-index`

| #   | Code                                          | File name      | Expected                        |
| --- | --------------------------------------------- | -------------- | ------------------------------- |
| 1   | `export { Foo } from "./foo"`                 | `index.ts`     | ✅ no error                     |
| 2   | `export * from "./foo"`                       | `index.ts`     | ✅ no error                     |
| 3   | `export { Foo, Bar }`                         | `index.ts`     | ✅ no error                     |
| 4   | `import { Foo } from "./foo"; export { Foo }` | `index.ts`     | ✅ no error                     |
| 5   | `export const API_URL = "..."`                | `index.ts`     | ❌ error                        |
| 6   | `export function helper() {}`                 | `index.ts`     | ❌ error                        |
| 7   | `export default 42`                           | `index.ts`     | ❌ error                        |
| 8   | `const x = 1`                                 | `index.ts`     | ❌ error                        |
| 9   | `function helper() {}`                        | `index.ts`     | ❌ error                        |
| 10  | `someSideEffect()`                            | `index.ts`     | ❌ error                        |
| 11  | `export const API_URL = "..."`                | `not-index.ts` | ✅ no error (not an index file) |
| 12  | `function helper() {}`                        | `not-index.ts` | ✅ no error (not an index file) |

---

## Real Codebase Impact

I scanned `src/` for patterns that would be caught:

**`local/no-passthrough` would catch:**

- `src/extension-activation/api.ts` — `healthcheck: () => healthcheck()`, etc. — BUT these are NOT exported individually, they're properties in an exported object -> NOT flagged ✅

**`local/no-reexport` would catch:**

- Empty non-index files that just re-export — need to verify if any exist

**`local/no-logic-in-index` would catch:**

- Index files in the codebase that contain logic — need to scan for these

---

## Implementation Steps

1. **Create** `packages/config-eslint/rules/no-passthrough.js`
2. **Create** `packages/config-eslint/rules/no-reexport.js`
3. **Create** `packages/config-eslint/rules/no-logic-in-index.js`
4. **Modify** `packages/config-eslint/base.js` — import + register all three rules under `local` plugin
5. **Verify** config loads: `npx eslint --print-config src/eslint.config.mjs | grep local/`
6. **Audit** violations: `npx eslint . --rule 'local/no-passthrough: error' --rule 'local/no-reexport: error' --rule 'local/no-logic-in-index: error'`
7. **Fix** violations — inline calls, move re-exports to index files, extract logic from index files, or add inline disable comments where intentional
