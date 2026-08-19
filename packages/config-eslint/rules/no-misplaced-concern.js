import fs from "node:fs"
import path from "node:path"

/**
 * @fileoverview Rule to enforce architectural concern placement:
 * - Check A: File name must be camelCase or kebab-case
 * - Check B: Content-based — each exported function must call the right API for its directory
 * - Check C: Path-based — file must be in the correct directory for its concern type
 * - Check D: File name must match expected pattern for its directory
 * - Check E: Reverse check — file name implies a required directory
 * - Check F: No direct handler import from outside handlers/
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the project root by looking for turbo.json or root package.json.
 * @returns {string}
 */
function findProjectRoot() {
	const cwd = process.cwd().replace(/\\/g, "/")
	let dir = cwd
	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			const hasTurbo = fs.existsSync(`${dir}/turbo.json`)
			if (hasTurbo) return dir
		} catch {
			// ignore
		}
		const parent = path.dirname(dir)
		if (parent === dir) return cwd // reached root, fallback to cwd
		dir = parent
	}
}

/**
 * Get the relative path from the project root.
 * @param {string} normalizedPath
 * @returns {string}
 */
function getRelativePath(normalizedPath) {
	const projectRoot = findProjectRoot()
	if (normalizedPath.startsWith(projectRoot + "/")) {
		return normalizedPath.slice(projectRoot.length + 1)
	}
	return normalizedPath
}

/**
 * Get the expected concern based on the full file path.
 * Priority: events/handlers > events/actions > handlers > actions > events
 * @param {string} normalizedPath
 * @returns {string|null}
 */
function getExpectedConcern(normalizedPath) {
	if (normalizedPath.includes("/events/handlers/")) return "event-handler"
	if (normalizedPath.includes("/events/actions/")) return "event-action"
	if (normalizedPath.includes("/handlers/")) return "intent-handler"
	if (normalizedPath.includes("/actions/")) return "action-creator"
	if (normalizedPath.includes("/events/")) return "event"
	return null
}

/**
 * Check if a file is inside handlers/ or events/handlers/
 * (import from handlers is allowed within these directories).
 * @param {string} normalizedPath
 * @returns {boolean}
 */
function isInHandlerDirectory(normalizedPath) {
	return normalizedPath.includes("/handlers/")
}

/**
 * Extract function info from an export declaration node.
 * @param {import("estree").Node} declaration
 * @returns {{ name: string, body: import("estree").Node, node: import("estree").Node } | null}
 */
function extractFunctionInfo(declaration) {
	if (!declaration) return null

	// export function foo() { ... }
	if (declaration.type === "FunctionDeclaration" && declaration.id) {
		return {
			name: declaration.id.name,
			body: declaration.body,
			node: declaration,
		}
	}

	// export const foo = () => { ... } or export const foo = function() { ... }
	if (declaration.type === "VariableDeclaration") {
		for (const declarator of declaration.declarations) {
			if (
				declarator.id &&
				(declarator.init?.type === "ArrowFunctionExpression" || declarator.init?.type === "FunctionExpression")
			) {
				return {
					name: declarator.id.type === "Identifier" ? declarator.id.name : "<anonymous>",
					body: declarator.init.body,
					node: declarator.init,
				}
			}
		}
	}

	return null
}

/**
 * Recursively find all call expression member chains in an AST node.
 * Returns an array of full call strings like "store.intentStore.createIntent"
 * @param {import("estree").Node} node
 * @param {Set<string>} [results]
 * @returns {string[]}
 */
function findApiCalls(node, results = new Set()) {
	if (!node || typeof node !== "object") return [...results]

	if (node.type === "CallExpression") {
		const callStr = getMemberChainString(node.callee)
		if (callStr) results.add(callStr)
	}

	for (const key of Object.keys(node)) {
		if (key === "parent" || key === "leadingComments" || key === "trailingComments") continue
		const child = node[key]
		if (Array.isArray(child)) {
			for (const item of child) {
				if (item && typeof item === "object") findApiCalls(item, results)
			}
		} else if (child && typeof child === "object") {
			findApiCalls(child, results)
		}
	}

	return [...results]
}

/**
 * Convert a callee node to a dot-separated string like "store.intentStore.createIntent".
 * @param {import("estree").Node} node
 * @returns {string}
 */
function getMemberChainString(node) {
	if (!node) return ""

	if (node.type === "Identifier") return node.name

	if (node.type === "MemberExpression") {
		const object = getMemberChainString(node.object)
		const property = getMemberChainString(node.property)
		if (object && property) return `${object}.${property}`
	}

	if (node.type === "CallExpression") {
		return getMemberChainString(node.callee)
	}

	return ""
}

// ---------------------------------------------------------------------------
// API patterns for Check B
// ---------------------------------------------------------------------------

const API_PATTERNS = [
	{
		match: (callStr) =>
			callStr.includes("intentStore.createIntent") || callStr.includes("intentStore.createIntentSync"),
		concern: "action-creator",
		message:
			'Функция "%s" вызывает intentStore.createIntent() (action creator), но файл находится в %s. Вынеси в actions/',
	},
	{
		match: (callStr) => callStr.includes("intentBus.emit") || callStr.includes("bus.createIntent"),
		concern: "action-creator",
		message:
			'Функция "%s" эмитит intent через IntentBus (action creator), но файл находится в %s. Вынеси в actions/',
	},
	{
		match: (callStr) => callStr.includes(".register") && (callStr.includes("bus") || callStr.includes("IntentBus")),
		concern: "intent-handler",
		message: 'Функция "%s" регистрируется на IntentBus (handler), но файл находится в %s. Вынеси в handlers/',
	},
	{
		match: (callStr) => callStr.includes("postMessageToWebview"),
		concern: "event-action",
		message:
			'Функция "%s" отправляет event на фронтенд (event action), но файл находится в %s. Вынеси в events/actions/',
	},
	{
		match: (callStr) => callStr === "vscode.postMessage" || callStr.endsWith(".vscode.postMessage"),
		concern: "event-action",
		message:
			'Функция "%s" отправляет event на бэкенд (event action), но файл находится в %s. Вынеси в events/actions/',
	},
	{
		match: (callStr) => callStr.includes("onWebviewMessage"),
		concern: "event-handler",
		message:
			'Функция "%s" обрабатывает входящий event (event handler), но файл находится в %s. Вынеси в events/handlers/',
	},
]

/**
 * For the concern inferred from content, get the directories where it's allowed.
 * @param {string} concern
 * @returns {string[]}
 */
function getAllowedDirectories(concern) {
	switch (concern) {
		case "action-creator":
			return ["actions"]
		case "intent-handler":
			return ["handlers", "events/handlers"]
		case "event-action":
			return ["events/actions"]
		case "event-handler":
			return ["events/handlers"]
		default:
			return []
	}
}

/**
 * Convert concern to a human-readable folder path for error messages.
 * @param {string} concern
 * @returns {string}
 */
function concernToPath(concern) {
	switch (concern) {
		case "action-creator":
			return "actions/"
		case "intent-handler":
			return "handlers/"
		case "event-action":
			return "events/actions/"
		case "event-handler":
			return "events/handlers/"
		default:
			return ""
	}
}

// ---------------------------------------------------------------------------
// Check helpers
// ---------------------------------------------------------------------------

/**
 * Check A: Validate file name format (camelCase or kebab-case).
 * @param {string} nameWithoutExt
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateFileName(nameWithoutExt) {
	// Special names always allowed
	const specialNames = new Set(["store", "index", "constants"])
	if (specialNames.has(nameWithoutExt)) return { valid: true }

	const isCamelCase = /^[a-z][a-zA-Z0-9]*$/.test(nameWithoutExt)
	const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(nameWithoutExt)
	const isKebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(nameWithoutExt)

	if (isCamelCase || isPascalCase || isKebabCase) return { valid: true }

	return {
		valid: false,
		reason: `Имя файла "${nameWithoutExt}" не соответствует camelCase, PascalCase или kebab-case. Используй: startTask.ts, TelemetryService.ts, on-task-started.ts, store.ts, index.ts, constants.ts.`,
	}
}

/**
 * Check D: Validate file name matches expected pattern for its directory.
 * @param {string} nameWithoutExt
 * @param {string|null} expectedConcern
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateNameByDirectory(nameWithoutExt, expectedConcern) {
	if (!expectedConcern) return { valid: true }

	const specialNames = new Set(["store", "index", "constants"])
	if (specialNames.has(nameWithoutExt)) return { valid: true }

	switch (expectedConcern) {
		case "event-handler":
			if (!nameWithoutExt.endsWith("-received")) {
				return {
					valid: false,
					reason: `Файл в events/handlers/ должен заканчиваться на "-received". Например: on-state-received.ts. Текущее имя: "${nameWithoutExt}".`,
				}
			}
			return { valid: true }

		case "event-action":
			if (nameWithoutExt.startsWith("on-")) {
				return {
					valid: false,
					reason: `Файл в events/actions/ не должен начинаться с "on-". Например: sendState.ts. Текущее имя: "${nameWithoutExt}".`,
				}
			}
			return { valid: true }

		case "intent-handler":
			if (!nameWithoutExt.startsWith("on-")) {
				return {
					valid: false,
					reason: `Файл в handlers/ должен начинаться с "on-". Например: on-task-started.ts. Текущее имя: "${nameWithoutExt}".`,
				}
			}
			return { valid: true }

		case "action-creator":
			if (nameWithoutExt.startsWith("on-")) {
				return {
					valid: false,
					reason: `Файл в actions/ не должен начинаться с "on-". Например: startTask.ts. Текущее имя: "${nameWithoutExt}".`,
				}
			}
			return { valid: true }

		case "event":
			if (nameWithoutExt !== "index" && nameWithoutExt !== "constants") {
				return {
					valid: false,
					reason: `В папке events/ (без actions/ или handlers/) допускаются только index.ts и constants.ts. Текущее имя: "${nameWithoutExt}".`,
				}
			}
			return { valid: true }

		default:
			return { valid: true }
	}
}

/**
 * Check E: Reverse check — file name implies a required directory.
 * @param {string} nameWithoutExt
 * @param {string} normalizedPath
 * @returns {{ valid: boolean, reason?: string } | null}
 */
function validateReverseCheck(nameWithoutExt, normalizedPath) {
	if (nameWithoutExt.endsWith("-received")) {
		if (!normalizedPath.includes("/events/handlers/")) {
			return {
				valid: false,
				reason: `Файл "${nameWithoutExt}.ts" заканчивается на "-received", значит должен быть в events/handlers/. Сейчас находится в "${normalizedPath}".`,
			}
		}
		return { valid: true }
	}

	if (nameWithoutExt.startsWith("on-")) {
		// on-* that is NOT -received (that case is handled above)
		if (!normalizedPath.includes("/handlers/") && !normalizedPath.includes("/events/handlers/")) {
			return {
				valid: false,
				reason: `Файл "${nameWithoutExt}.ts" начинается с "on-", значит должен быть в handlers/. Сейчас находится в "${normalizedPath}".`,
			}
		}
		return { valid: true }
	}

	return null
}

// ---------------------------------------------------------------------------
// Rule definition
// ---------------------------------------------------------------------------

/** @type {import("eslint").Rule.RuleModule} */
const noMisplacedConcernRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce architectural concern placement rules: " +
				"actions create intents (in actions/), handlers process intents (in handlers/), " +
				"event actions send events (in events/actions/), event handlers process events (in events/handlers/). " +
				"No direct handler imports from outside handlers/.",
		},
		schema: [
			{
				type: "object",
				properties: {
					includes: {
						type: "array",
						items: { type: "string" },
						description:
							"Path prefixes to check (e.g. src/, webview-ui/src/). If empty, all paths are checked.",
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			invalidFileName: "{{reason}}",
			contentMismatch: "{{reason}}",
			nameMismatchByDirectory: "{{reason}}",
			reverseCheckMismatch: "{{reason}}",
			directHandlerImport:
				"Handler функции нельзя вызывать напрямую. Импорт из '{{source}}' находится в handlers/ и не может быть импортирован отсюда. Создай action creator в actions/, который эмитит Intent, и подпишись на него в handlers/.",
			importFromEventsHandlers:
				"Event handler функции нельзя вызывать напрямую. Импорт из '{{source}}' находится в events/handlers/. Создай action creator в actions/ или event action в events/actions/.",
		},
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const normalizedPath = filename.replace(/\\/g, "/")
		const basename = path.basename(filename)
		// Handle .d.ts files — strip both .d and .ts
		let nameWithoutExt = basename.replace(/\.[^.]+$/, "")
		if (basename.endsWith(".d.ts") || basename.endsWith(".d.tsx")) {
			nameWithoutExt = nameWithoutExt.replace(/\.d$/, "")
		}
		// Path-based concern checks only apply for included paths
		const includes = context.options[0]?.includes ?? []
		const relativePath = getRelativePath(normalizedPath)
		const isIncluded =
			includes.length === 0 ||
			includes.some((inc) => {
				const prefix = inc.endsWith("/") ? inc.slice(0, -1) : inc
				return relativePath === prefix || relativePath.startsWith(prefix + "/")
			})
		const expectedConcern = isIncluded ? getExpectedConcern(normalizedPath) : null
		const fileIsInHandlers = isInHandlerDirectory(normalizedPath)

		// Check if file should be excluded from checks
		const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(basename)
		const isReadme = basename === "README.md"
		const isInExcludedDir =
			normalizedPath.includes("/helpers/") ||
			normalizedPath.includes("/components/") ||
			normalizedPath.includes("/hooks/") ||
			normalizedPath.includes("/__mocks__/")
		const isExcluded = isTestFile || isReadme || isInExcludedDir

		// Track already-reported nodes to avoid duplicates
		const reportedNodes = new Set()

		/** @type {Array<{ name: string, calls: string[], node: import("estree").Node }>} */
		const exportedFunctions = []

		return {
			// Collect exported functions for Check B
			ExportNamedDeclaration(node) {
				if (isExcluded) return

				const info = extractFunctionInfo(node.declaration)
				if (!info) return

				const calls = findApiCalls(info.body)
				exportedFunctions.push({
					name: info.name,
					calls,
					node: info.node,
				})
			},

			// Run checks on Program exit so we have all the data
			"Program:exit"(program) {
				if (isExcluded) return

				// All checks only apply inside included directories
				if (!isIncluded) return

				// -- Check A: File name validation --
				const nameCheck = validateFileName(nameWithoutExt)
				if (!nameCheck.valid) {
					context.report({
						node: program,
						messageId: "invalidFileName",
						data: { reason: nameCheck.reason },
					})
					reportedNodes.add("A")
				}

				// -- Check D: Name by directory --
				if (expectedConcern) {
					const dirNameCheck = validateNameByDirectory(nameWithoutExt, expectedConcern)
					if (!dirNameCheck.valid) {
						context.report({
							node: program,
							messageId: "nameMismatchByDirectory",
							data: { reason: dirNameCheck.reason },
						})
						reportedNodes.add("D")
					}
				}

				// -- Check E: Reverse check --
				const reverseResult = validateReverseCheck(nameWithoutExt, normalizedPath)
				if (reverseResult && !reverseResult.valid) {
					context.report({
						node: program,
						messageId: "reverseCheckMismatch",
						data: { reason: reverseResult.reason },
					})
					reportedNodes.add("E")
				}

				// -- Check B: Content-based per function --
				for (const func of exportedFunctions) {
					if (func.calls.length === 0) {
						// Function doesn't call any tracked API.
						// If it's in actions/ or events/actions/ and doesn't call the expected API,
						// it might be misplaced (like abortTask.ts mutating state directly instead of creating intents).
						if (expectedConcern === "action-creator" && !normalizedPath.includes("/events/handlers/")) {
							context.report({
								node: func.node,
								messageId: "contentMismatch",
								data: {
									reason: `Функция "${func.name}" не вызывает intentStore.createIntent() (не action creator), но файл находится в actions/. Если эта функция мутирует стейт — перенеси в handlers/on-${func.name}.ts.`,
								},
							})
						}
						continue
					}

					for (const pattern of API_PATTERNS) {
						const matchedCall = func.calls.find((c) => pattern.match(c))
						if (!matchedCall) continue

						const allowed = getAllowedDirectories(pattern.concern)
						const isInAllowedDir = allowed.some((dir) => normalizedPath.includes(`/${dir}/`))

						if (!isInAllowedDir) {
							const currentPath = concernToPath(expectedConcern)
							context.report({
								node: func.node,
								messageId: "contentMismatch",
								data: {
									reason: pattern.message
										.replace("%s", func.name)
										.replace("%s", currentPath || "неизвестной папке"),
								},
							})
						}
						break // Only first matching pattern per function
					}
				}
			},

			// -- Check F: No direct handler import (only inside included directories) --
			ImportDeclaration(node) {
				if (isExcluded) return
				if (!isIncluded) return
				if (fileIsInHandlers) return // handlers can import from handlers

				// Allow special barrel files to re-export
				const specialNames = new Set(["store", "index", "constants"])
				if (specialNames.has(nameWithoutExt)) return

				checkImportSource(node.source.value, node, context, normalizedPath)
			},
			ExportNamedDeclaration(node) {
				if (isExcluded) return
				if (!isIncluded) return
				if (fileIsInHandlers) return
				if (!node.source) return

				const specialNames = new Set(["store", "index", "constants"])
				if (specialNames.has(nameWithoutExt)) return

				checkImportSource(node.source.value, node, context, normalizedPath)
			},
			ExportAllDeclaration(node) {
				if (isExcluded) return
				if (!isIncluded) return
				if (fileIsInHandlers) return
				if (!node.source) return

				const specialNames = new Set(["store", "index", "constants"])
				if (specialNames.has(nameWithoutExt)) return

				checkImportSource(node.source.value, node, context, normalizedPath)
			},
		}
	},
}

/**
 * Check import source for handler directory references (Check F).
 * @param {string} source - The import source string
 * @param {import("estree").Node} node
 * @param {import("eslint").Rule.RuleContext} context
 * @param {string} normalizedPath
 */
function checkImportSource(source, node, context, normalizedPath) {
	// Check if source imports from handlers/ (but NOT from events/handlers/ which is sibling)
	if (source.includes("/handlers/") || source.startsWith("handlers/")) {
		// If the import is from events/handlers/, it's a sibling of handlers/ — still not allowed from outside
		const isFromEventsHandlers = source.includes("/events/handlers/") || source.startsWith("events/handlers/")

		if (isFromEventsHandlers) {
			context.report({
				node,
				messageId: "importFromEventsHandlers",
				data: { source },
			})
		} else {
			context.report({
				node,
				messageId: "directHandlerImport",
				data: { source },
			})
		}
	}
}

export default noMisplacedConcernRule
