/**
 * A function node counts as an empty stub when its body has no statements
 * (arrow '() => {}' or classic 'function f() {}').
 * @param {object} fn
 * @returns {boolean}
 */
function isEmptyFunction(fn) {
	if (!fn) return false
	if (
		fn.type === "ArrowFunctionExpression" ||
		fn.type === "FunctionExpression" ||
		fn.type === "FunctionDeclaration"
	) {
		// Expression-bodied arrows ('() => 5') are not stubs — only a
		// BlockStatement body can be empty.
		return fn.body && fn.body.type === "BlockStatement" && fn.body.body.length === 0
	}
	return false
}

/**
 * A declaration (the payload of an export) is trivial when it only declares
 * empty stubs: 'export const noop = () => {}' / 'export function noop() {}'.
 * @param {object} decl
 * @returns {boolean}
 */
function declarationIsTrivial(decl) {
	if (!decl) return false
	if (decl.type === "FunctionDeclaration") return isEmptyFunction(decl)
	if (decl.type === "VariableDeclaration") {
		return decl.declarations.length > 0 && decl.declarations.every((d) => isEmptyFunction(d.init))
	}
	return false
}

/**
 * Match a basename against a simple glob (`*` = any run of chars, `?` = one char).
 *
 * `allow` entries are PATTERNS on purpose: a rule may encode a naming CONVENTION ("ambient
 * declaration files are types-only by construction"), never a single reviewed file — a
 * one-file entry stops applying the moment that file is renamed or a second one appears.
 *
 * @param {string} name
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesGlob(name, pattern) {
	if (!pattern.includes("*") && !pattern.includes("?")) return name === pattern
	const rx = new RegExp(
		`^${pattern
			.replace(/[.+^${}()|[\]\\]/g, "\\$&")
			.replace(/\*/g, ".*")
			.replace(/\?/g, ".")}$`,
	)
	return rx.test(name)
}

/** @type {import("eslint").Rule.RuleModule} */
const noEmptyFilesRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow files that carry no code: either completely empty (only comments/whitespace) or a " +
				"re-export barrel that also declares only empty function stubs and nothing else. Such files " +
				"are dead artifacts — usually a leftover after a model was merged into store.ts (v2: 'all " +
				"state in MST, one store per feature'). Example: backend/features/chat/task/notifications-model.ts, " +
				"which only said 'merged into store.ts'. Delete the file; keep the note as a comment in the " +
				"file that absorbed the code. Note: a pure re-export barrel (no stubs) is legitimate and is " +
				"NOT reported.",
		},
		schema: [
			{
				type: "object",
				properties: {
					allow: {
						type: "array",
						items: { type: "string" },
						description: "Basename GLOB PATTERNS allowed to be empty (e.g. '*.d.ts', stub mocks).",
						default: [],
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			emptyFile:
				"File '{{file}}' contains no code — only comments/whitespace. " +
				"Architecture (v2, architectural-restructure-v2.md §4 'ALL state in MST', §14 whitelist rule): " +
				"files must not exist in the tree unless they carry code. If a model was merged into " +
				"'store.ts', DELETE this file and leave the migration note as a comment inside 'store.ts'. " +
				"Example: 'notifications-model.ts' with only '// merged into store.ts' must be deleted, " +
				"the note moves to store.ts.",
			trivialFile:
				"File '{{file}}' carries no logic — only re-exports and empty function stubs " +
				"('() => {}' / 'function f() {}'). A file must carry code, not just forward declarations. " +
				"Fix: move the re-exports into the folder's 'index.ts' (the barrel) and DELETE this file, " +
				"or give the stub functions actual bodies.",
		},
	},
	create(context) {
		const options = context.options[0] || {}
		const allow = options.allow ?? []

		return {
			Program(node) {
				const filename = context.filename ?? context.getFilename()
				let basename = filename.split("/").pop() ?? ""
				basename = filename.split("/").pop() ?? ""
				if (allow.some((pattern) => matchesGlob(basename, pattern))) return
				const body = node.body
				if (body.length === 0) {
					context.report({ node, messageId: "emptyFile", data: { file: basename } })
					return
				}
				// Trivial file: EVERY statement is a re-export (legitimate barrel part),
				// an import (imports carry no logic — they are wiring, not code),
				// or an export/declaration of an EMPTY function stub, AND at least one
				// statement is a stub (a pure re-export barrel is NOT trivial).
				let stubCount = 0
				let allTrivial = true
				for (const stmt of body) {
					if (stmt.type === "ImportDeclaration") continue
					if (stmt.type === "ExportAllDeclaration") continue
					if (stmt.type === "ExportNamedDeclaration" && stmt.source) continue
					if (stmt.type === "FunctionDeclaration" && isEmptyFunction(stmt)) {
						stubCount += 1
						continue
					}
					if (
						stmt.type === "ExportNamedDeclaration" &&
						!stmt.source &&
						declarationIsTrivial(stmt.declaration)
					) {
						stubCount += 1
						continue
					}
					if (stmt.type === "ExportDefaultDeclaration" && declarationIsTrivial(stmt.declaration)) {
						stubCount += 1
						continue
					}
					allTrivial = false
					break
				}
				if (allTrivial && stubCount > 0) {
					context.report({ node, messageId: "trivialFile", data: { file: basename } })
				}
			},
		}
	},
}

export default noEmptyFilesRule
