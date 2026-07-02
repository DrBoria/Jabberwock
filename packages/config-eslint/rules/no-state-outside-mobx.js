import fs from "node:fs"
import path from "node:path"

/**
 * @fileoverview Rule to prevent state management outside MobX.
 * Bans:
 * - Zustand create() - anywhere in checked paths
 * - React.createContext / useContext - for state management
 * - Plain singleton pattern (class with static instance + getInstance())
 *
 * Does NOT ban:
 * - Module-level mutable state (let x = ... at top level)
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

/**
 * Check if a node was imported from a specific module.
 * @param {import("estree").Node} node
 * @param {string} moduleName
 * @param {Map<string, string>} importMap - Map of local names to module sources
 * @returns {boolean}
 */
function isImportedFrom(node, moduleName, importMap) {
	if (node.type === "Identifier" && importMap.has(node.name)) {
		return importMap.get(node.name) === moduleName
	}
	return false
}

// ---------------------------------------------------------------------------
// Rule definition
// ---------------------------------------------------------------------------

/** @type {import("eslint").Rule.RuleModule} */
const noStateOutsideMobxRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Prevent state management outside MobX. " +
				"Bans Zustand create(), React.createContext/useContext for state, " +
				"and plain singleton pattern (class with static instance + getInstance()).",
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
					excludedFiles: {
						type: "array",
						items: { type: "string" },
						description: "Regex patterns for files to exclude from checks (e.g. 'useRootStore\\\\.ts$').",
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			zustandCreate:
				"Использование Zustand create() запрещено. Всё состояние должно быть в MobX сторах. Файл: {{path}}",
			createContext:
				"Использование React.createContext() для состояния запрещено. Всё состояние должно быть в MobX сторах. Если это DI для MobX стора — добавь файл в excludedFiles. Файл: {{path}}",
			singletonPattern:
				"Обнаружен singleton-паттерн (class с static instance + getInstance()). Всё состояние должно быть в MobX сторах. Файл: {{path}}",
		},
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const normalizedPath = filename.replace(/\\/g, "/")
		const basename = filename.split("/").pop() ?? ""

		const options = context.options[0] ?? {}
		const includes = options.includes ?? []
		const excludedFiles = options.excludedFiles ?? []

		// Check if file is in included path
		const relativePath = getRelativePath(normalizedPath)
		const isIncluded =
			includes.length === 0 ||
			includes.some((inc) => {
				const prefix = inc.endsWith("/") ? inc.slice(0, -1) : inc
				return relativePath === prefix || relativePath.startsWith(prefix + "/")
			})

		if (!isIncluded) return {}

		// Check if file is excluded by regex pattern
		const isExcluded = excludedFiles.some((pattern) => new RegExp(pattern).test(basename))

		if (isExcluded) return {}

		// Track imports: local name -> module source
		/** @type {Map<string, string>} */
		const importMap = new Map()

		// Track if this file has a singleton class
		/** @type {import("estree").Node[]} */
		const singletonReports = []

		/** @type {Set<number>} */
		const reportedNodes = new Set()

		return {
			// Track imports to know what comes from where
			ImportDeclaration(node) {
				const source = node.source.value

				if (source === "zustand") {
					// Any import from "zustand" is banned (create is the main export)
					context.report({
						node,
						messageId: "zustandCreate",
						data: { path: normalizedPath },
					})
					return
				}

				if (source === "react") {
					for (const specifier of node.specifiers) {
						if (
							specifier.type === "ImportSpecifier" &&
							(specifier.imported.name === "createContext" || specifier.imported.name === "useContext")
						) {
							importMap.set(specifier.local.name, "react")
						}
					}
				}
			},

			// Detect createContext() calls
			CallExpression(node) {
				if (node.callee.type === "Identifier" && isImportedFrom(node.callee, "react", importMap)) {
					const name = node.callee.name
					// Only report createContext, not useContext (it's used inside components
					// but its presence alone indicates context usage)
					if (name === "createContext") {
						if (!reportedNodes.has(node.range?.[0] ?? 0)) {
							context.report({
								node,
								messageId: "createContext",
								data: { path: normalizedPath },
							})
							reportedNodes.add(node.range?.[0] ?? 0)
						}
					}
				}

				// Also detect direct React.createContext() calls without import
				if (
					node.callee.type === "MemberExpression" &&
					node.callee.object.type === "Identifier" &&
					node.callee.object.name === "React" &&
					node.callee.property.type === "Identifier" &&
					node.callee.property.name === "createContext"
				) {
					if (!reportedNodes.has(node.range?.[0] ?? 0)) {
						context.report({
							node,
							messageId: "createContext",
							data: { path: normalizedPath },
						})
						reportedNodes.add(node.range?.[0] ?? 0)
					}
				}
			},

			// Detect singleton pattern
			ClassDeclaration(node) {
				// Check for static instance property
				const hasStaticInstance = node.body.body.some(
					(member) =>
						member.type === "PropertyDefinition" &&
						member.static &&
						member.key.type === "Identifier" &&
						member.key.name === "instance",
				)

				if (!hasStaticInstance) return

				// Check for getInstance method
				const hasGetInstance = node.body.body.some(
					(member) =>
						member.type === "MethodDefinition" &&
						member.key.type === "Identifier" &&
						member.key.name === "getInstance",
				)

				if (!hasGetInstance) return

				// This is a singleton, report it
				singletonReports.push(node)
			},

			"Program:exit"() {
				for (const node of singletonReports) {
					context.report({
						node,
						messageId: "singletonPattern",
						data: { path: normalizedPath },
					})
				}
			},
		}
	},
}

export default noStateOutsideMobxRule
