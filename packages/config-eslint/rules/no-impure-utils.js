/**
 * Rule: no-impure-utils
 *
 * A file named `*-utils.ts` (or `utils.ts`) is a PURE-HELPER contract: it
 * holds stateless transformations — filter, sort, parse, format, map,
 * string/date math. It is NOT a place for:
 *
 *   - handler / orchestration logic (async flows that await services,
 *     dispatch intents, or switch on user actions)
 *   - store access (reading or mutating the MST/MobX store)
 *   - side-effecting service calls (network, fs, git, checkpoints, …)
 *
 * The classic violation (the one that motivated this rule):
 * `window-utils.ts` / `mode-utils.ts` — files named "utils" that actually
 * contain handlers (`handleModeSwitch`, `initWindowManagerState`) and store
 * reads (`getStore()`, `getHostEnvironment().getGlobalState(...)`). Those are
 * handlers/services wearing a "utils" costume.
 *
 * Detection is by PATTERN, not by file path, so it applies to every
 * `*-utils.ts` in the checked scopes:
 *   - impureAsyncExport : an exported (or exported-transitively) top-level
 *                         function is `async` (awaits = orchestration, not a
 *                         pure transform) OR its body contains an `await`.
 *   - impureStoreAccess : the file references the store (getStore / getRoot /
 *                         getParent / a `*Store` identifier) or a host
 *                         environment accessor — utils must not touch state.
 *   - impureHandlerName : an exported function whose name is a handler verb
 *                         (handle…, init…, on…, process…, dispatch…, run…,
 *                         execute…) — that is an action/handler, not a util.
 *
 * Fix: rename the file to its real concern (…/handlers/…, …/actions/…) and
 * split the pure helpers out into a genuine `*-utils.ts`.
 */

/**
 * Is the filename a "utils" file by name contract?
 * @param {string} basename
 * @returns {boolean}
 */
function isUtilsFile(basename) {
	if (!basename) return false
	const noExt = basename.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "")
	return noExt === "utils" || noExt.endsWith("-utils")
}

/**
 * Handler-ish exported name: an exported function that is clearly an
 * action/handler/orchestrator, not a pure transform. Deliberately excludes
 * pure-transform verbs (build/parse/format/map/filter/sort/compute/…).
 * @param {string} name
 * @returns {boolean}
 */
function isHandlerName(name) {
	if (!name) return false
	// Deliberately NARROW: only verbs that unambiguously denote orchestration /
	// side-effects / lifecycle. Broad transform verbs (process/emit/add/create/
	// update/parse/format/build…) are common in PURE helpers and would flood the
	// rule with false positives, so they are excluded — a pure `processX` that
	// is sync and stateless is a legitimate util.
	return /^(handle|init|dispatch|execute|perform|switch|reset|load|save|delete|remove|toggle|send|post|register|activate|deactivate|enable|disable|start|stop|restart|resume|pause|abort|cancel|refresh|reload|sync|hydrate)/i.test(
		name,
	)
}

/**
 * Does a function body contain an `await` (top-level await or nested)?
 * @param {object} fn
 * @returns {boolean}
 */
function bodyHasAwait(fn) {
	if (!fn || !fn.body) return false
	let found = false
	const walk = (node) => {
		if (found || !node || typeof node.type !== "string") return
		if (node.type === "AwaitExpression") {
			found = true
			return
		}
		for (const key of Object.keys(node)) {
			if (key === "parent") continue
			const child = node[key]
			if (Array.isArray(child)) {
				for (const c of child) if (c && typeof c.type === "string") walk(c)
			} else if (child && typeof child.type === "string") {
				walk(child)
			}
		}
	}
	walk(fn.body)
	return found
}

/**
 * Collect top-level exported function names + nodes.
 * @param {object} program
 * @returns {{name: string, node: object, isAsync: boolean, hasAwait: boolean}[]}
 */
function collectExportedFns(program) {
	const out = []
	for (const b of program.body) {
		if (b.type !== "ExportNamedDeclaration" || !b.declaration) continue
		const d = b.declaration
		if (d.type === "FunctionDeclaration" && d.id) {
			out.push({ name: d.id.name, node: d, isAsync: d.async, hasAwait: bodyHasAwait(d) })
		} else if (d.type === "VariableDeclaration") {
			for (const dec of d.declarations) {
				const init = dec.init
				if (init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
					const name = dec.id && dec.id.type === "Identifier" ? dec.id.name : null
					if (name) out.push({ name, node: init, isAsync: init.async, hasAwait: bodyHasAwait(init) })
				}
			}
		}
	}
	return out
}

/**
 * Scan the whole program for identifiers that indicate store / host-environment
 * access (state). Returns the distinct offending names found.
 * @param {object} program
 * @returns {string[]}
 */
function findStateAccess(program) {
	const hits = new Set()
	const STORE_RE = /^(getStore|getBackendStore|getFrontendStore|getAppStore|getRoot|getParent|getEnv)$|^Store$|Store$/
	const HOST_RE =
		/^(getHostEnvironment|getHostContext|getProvider|getConnector|getBackendCapabilities|getHostCommands)$|^hostEnvironment$|^hostContext$/
	const walk = (node) => {
		if (!node || typeof node.type !== "string") return
		if (node.type === "Identifier") {
			if (STORE_RE.test(node.name)) hits.add(node.name)
			else if (HOST_RE.test(node.name)) hits.add(node.name)
		}
		for (const key of Object.keys(node)) {
			if (key === "parent") continue
			const child = node[key]
			if (Array.isArray(child)) {
				for (const c of child) if (c && typeof c.type === "string") walk(c)
			} else if (child && typeof child.type === "string") {
				walk(child)
			}
		}
	}
	walk(program)
	return [...hits]
}

import { applyDebt } from "../debt/debt.js"

/** @type {import("eslint").Rule.RuleModule} */
const noImpureUtilsRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Enforce the `*-utils.ts` purity contract: a utils file holds stateless transforms " +
				"(filter/sort/parse/format), NOT handlers, store access, or side-effecting service calls. " +
				"Reports async/awaiting exports, store/host-environment access, and handler-named exports " +
				"in any file named `*-utils.ts`.",
		},
		schema: [
			{
				type: "object",
				properties: {
					includes: {
						type: "array",
						items: { type: "string" },
						description: "Path prefixes to check. Default: ['backend/', 'frontend/src/', 'apps/'].",
					},
					excludePaths: {
						type: "array",
						items: { type: "string" },
						description: "Substrings of file paths excluded from the check.",
					},
					debt: {
						type: "object",
						additionalProperties: { type: "number" },
						description:
							"MACHINE-GENERATED ledger (reports/lint-debt.json): '<file>::<messageId>' → allowed " +
							"count. Never hand-edited, never disables the rule for a whole file, only shrinks.",
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			impureAsyncExport:
				"Impure utils: exported '{{name}}' in a `*-utils.ts` file is async / contains await. A utils file holds pure, stateless transforms — orchestration (awaiting services/intents) belongs in a handler or action. Rename the file to its real concern (…/handlers/…, …/actions/…) or extract the pure helper.",
			impureStoreAccess:
				"Impure utils: `*-utils.ts` references state ({{names}}). Utils must not read or mutate the store or host environment. Move this logic into a handler/action/store; keep only pure transforms in the utils file.",
			impureHandlerName:
				"Impure utils: exported '{{name}}' in a `*-utils.ts` is a handler/action by name (handle*/init*/process*/…). That is not a util — it is an action or handler. Move it to the actions/ or handlers/ layer; keep only pure transforms in the utils file.",
		},
	},
	create(context) {
		const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
		const options = context.options[0] ?? {}
		context = applyDebt(context, options.debt)
		const includes = options.includes ?? ["backend/", "frontend/src/", "apps/"]
		const excludePaths = options.excludePaths ?? [".test.", ".spec.", "__mocks__", "dist/"]

		if (!includes.some((p) => filename.includes(p))) return {}
		if (excludePaths.some((ex) => filename.includes(ex))) return {}

		const basename = filename.split("/").pop() ?? ""
		if (!isUtilsFile(basename)) return {}

		return {
			Program(program) {
				// 1) async / awaiting exports
				for (const fn of collectExportedFns(program)) {
					if (fn.isAsync || fn.hasAwait) {
						context.report({ node: fn.node, messageId: "impureAsyncExport", data: { name: fn.name } })
					}
				}
				// 2) store / host-environment access anywhere in the file
				const stateAccess = findStateAccess(program)
				if (stateAccess.length > 0) {
					const first = program.body[0]
					context.report({
						node: first,
						messageId: "impureStoreAccess",
						data: { names: stateAccess.join(", ") },
					})
				}
				// 3) handler-named exports
				for (const fn of collectExportedFns(program)) {
					if (isHandlerName(fn.name)) {
						context.report({ node: fn.node, messageId: "impureHandlerName", data: { name: fn.name } })
					}
				}
			},
		}
	},
}

export default noImpureUtilsRule
