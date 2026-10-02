import fs from "node:fs"
import path from "node:path"

/**
 * Actions purity rule (user doctrine, mega-refactoring):
 *
 *  A. NO kebab-case files or folders inside any .../actions/ directory.
 *     Actions are camelCase imperative-verb files (see feature-naming Check C);
 *     a kebab file/folder in actions/ (tool-executor/, parse-tool-call/,
 *     file-mentions/, emit-ask.ts, …) is a violation.
 *
 *  B. NO duplicate names among siblings of an actions/ directory — files AND
 *     folders, normalized camelCase ↔ kebab-case ('toolExecution' ≡ 'tool-executor').
 *     A file that is a special case of a sibling folder ('saveMessages.ts' next to
 *     'save/') must live INSIDE that folder — the duplicate name is the smell.
 *
 *  C. Max ONE level of nesting inside actions/: a folder directly under actions/
 *     may not contain sub-folders (actions/save/strategies/ is forbidden —
 *     flatten it or move the sub-tree to a non-actions home).
 *
 *  D. NO handler-shaped exports in actions/: exported functions named handle* / on*
 *     are handlers and belong in .../handlers/ (one file per Event/Intent, v2 plan).
 *     'onboarding'/'once' are real domain words — exempt.
 *
 * A–C are directory-level facts, so they are reported ONCE per actions/ directory:
 * on its index.ts if present, otherwise on any file directly inside it.
 */

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ON_EXEMPT = new Set(["onboarding", "once", "only", "onto"])

/** 'toolExecutor' / 'tool-executor' / 'ToolExecutor' → 'toolexecutor' */
function normalizeName(name) {
	return name
		.replace(/\.(tsx?|jsx?)$/, "")
		.replace(/-/g, "")
		.toLowerCase()
}

/** @type {import("eslint").Rule.RuleModule} */
const actionsPurityRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Actions purity: no kebab-case, no duplicate sibling names (files+folders), max 1 nesting level, no handle*/on* exports inside actions/.",
		},
		schema: [],
		messages: {
			kebabFile:
				"File '{{name}}' in an 'actions/' directory is kebab-case. Actions are camelCase " +
				"imperative-verb files — rename '{{name}}' to camelCase (e.g. 'tool-executor' → 'toolExecutor').",
			kebabFolder:
				"Folder '{{name}}/' in an 'actions/' directory is kebab-case. Rename it to camelCase " +
				"(e.g. 'parse-tool-call/' → 'parseToolCall/') or move its content to a domain folder.",
			duplicateName:
				"'{{a}}' and '{{b}}' in the same 'actions/' directory are the same name in different " +
				"cases (camelCase ≡ kebab-case). One entity per name: merge them, or if '{{a}}' is a " +
				"special case of '{{b}}' (e.g. 'saveMessages' is a 'save' command) put it INSIDE '{{b}}/'.",
			nestedFolder:
				"'{{name}}/' inside an 'actions/' directory contains sub-folders. Actions may have at " +
				"most ONE level of nesting — flatten the sub-folders into '{{name}}/' or move the " +
				"sub-tree to a non-actions home.",
			handlerExport:
				"Exported function '{{name}}' is handler-shaped. Handlers belong in 'handlers/' " +
				"(one file per Event/Intent constant) — actions/ contains only actions. Move it to the " +
				"feature's handlers/ directory.",
		},
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const parts = filename.split(path.sep)
		const actionsIndex = parts.lastIndexOf("actions")
		const inActions = actionsIndex !== -1 && actionsIndex < parts.length - 1
		const node = context.sourceCode.ast
		if (!inActions) return {}

		const basename = parts[parts.length - 1]
		const actionsDir = parts.slice(0, actionsIndex + 1).join(path.sep)
		const directFile = parts.length - 1 === actionsIndex + 1

		// ── Directory-level checks: once per actions/ dir (index.ts, or any direct file if no index) ──
		let entries = []
		try {
			entries = fs.readdirSync(actionsDir, { withFileTypes: true })
		} catch {
			entries = []
		}
		const files = entries.filter((e) => e.isFile()).map((e) => e.name)
		const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name)
		const isIndexFile = /^index\.(ts|tsx|js)$/.test(basename)
		const runDirChecks = directFile && (isIndexFile || !files.includes("index.ts"))

		if (runDirChecks) {
			// A. kebab-case files / folders
			for (const f of files) {
				const base = f.replace(/\.(tsx?|jsx?)$/, "")
				if (base !== "index" && f.includes("-") && KEBAB.test(base)) {
					context.report({ node, messageId: "kebabFile", data: { name: f } })
				}
			}
			for (const d of folders) {
				if (d.includes("-") && KEBAB.test(d)) {
					context.report({ node, messageId: "kebabFolder", data: { name: d } })
				}
			}

			// B. duplicate normalized names among siblings (files AND folders)
			const seen = new Map() // normalized → name
			const all = [...files.filter((f) => f.replace(/\.(tsx?|jsx?)$/, "") !== "index"), ...folders]
			for (const name of all) {
				const norm = normalizeName(name)
				const prev = seen.get(norm)
				if (prev) {
					context.report({ node, messageId: "duplicateName", data: { a: name, b: prev } })
				} else {
					seen.set(norm, name)
				}
			}

			// C. max 1 nesting level: folders directly under actions/ must be leaf folders
			for (const d of folders) {
				let subEntries = []
				try {
					subEntries = fs.readdirSync(path.join(actionsDir, d), { withFileTypes: true })
				} catch {
					subEntries = []
				}
				if (subEntries.some((e) => e.isDirectory())) {
					context.report({ node, messageId: "nestedFolder", data: { name: d } })
				}
			}
		}

		// ── D. handler-shaped exports (any file under actions/) ──
		const isHandlerName = (name) => {
			if (name.startsWith("handle")) return true
			if (name.startsWith("on") && name.length > 2 && !ON_EXEMPT.has(name)) {
				const next = name[2]
				return /[A-Za-z]/.test(next)
			}
			return false
		}

		const reportHandler = (id) => {
			if (id && id.name && isHandlerName(id.name)) {
				context.report({ node: id, messageId: "handlerExport", data: { name: id.name } })
			}
		}

		for (const n of node.body) {
			if (n.type === "ExportNamedDeclaration" && !n.declaration && n.source) {
				// export { handleX } from "./y" — re-exported handlers
				for (const spec of n.specifiers) {
					const exported = spec.exported
					const name = exported.type === "Identifier" ? exported.name : exported.value
					if (name && isHandlerName(name)) {
						context.report({ node: spec, messageId: "handlerExport", data: { name } })
					}
				}
				continue
			}
			if (n.type !== "ExportNamedDeclaration" && n.type !== "ExportDefaultDeclaration") continue
			const decl = n.declaration
			if (!decl) continue
			if (decl.type === "FunctionDeclaration") {
				reportHandler(decl.id)
			} else if (decl.type === "VariableDeclaration") {
				for (const d of decl.declarations) {
					if (!d.id || d.id.type !== "Identifier") continue
					const init = d.init
					if (init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
						reportHandler(d.id)
					}
				}
			}
		}

		return {}
	},
}

export default actionsPurityRule
