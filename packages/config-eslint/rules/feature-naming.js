import path from "node:path"

/**
 * Feature naming rule (v2: architectural-restructure-v2.md, v3: architecture-restructure-v3-plan.md).
 *
 * Our architecture:
 *  - handlers/  → one file per Event/Intent constant, named on-<event-name>.ts (kebab-case).
 *                 The 'on-' prefix belongs to HANDLER FILES ONLY — event names live in files.
 *  - actions/   → camelCase imperative-verb files (createTask.ts, sendMessage.ts, …)
 *  - folders    → kebab-case DOMAIN names. A folder is a domain container. NO FOLDER may
 *                 ever start with 'on' in ANY form (on-settings, on_settings, onSettings,
 *                 onDownload, …): a folder never IS an event. The fix is to rename the folder
 *                 to the domain it contains.
 *  - *Handler.ts suffix is forbidden anywhere in features/ — handlers are on-<event>.ts files.
 *
 * Checks:
 *  A. A FILE directly inside a handlers/ directory must be on-<kebab>.ts
 *     (allowed: index.*, register*.ts, tests, use* hooks, *-received.ts frontend receivers).
 *  B. A file named *Handler.ts(x) anywhere in features/ is a violation.
 *  C. A FILE directly inside an actions/ directory must be camelCase starting with an
 *     imperative verb (no kebab like task-command-intents.ts, no nouns like stats.ts).
 *  D. Folders between features/ and the file: kebab-case domains only —
 *     NO 'on' leading segment in any form (kebab 'on-x', camelCase 'onX', snake 'on_x'),
 *     no handler/event/helpers tokens.
 */

// NOTE: ESLint does NOT apply the schema `default` for `imperativeVerbs` —
// the default list MUST live here, otherwise verbs === [] and every
// non-kebab action file (requestApi.ts, sendMessage.ts, …) is a false positive.
const DEFAULT_VERBS = [
	"abort",
	"add",
	"aggregate",
	"apply",
	"arm",
	"build",
	"cancel",
	"check",
	"clear",
	"close",
	"compute",
	"condense",
	"create",
	"delete",
	"delegate",
	"dispatch",
	"ensure",
	"execute",
	"export",
	"finalize",
	"filter",
	"flush",
	"get",
	"handle",
	"import",
	"init",
	"mark",
	"merge",
	"move",
	"notify",
	"open",
	"parse",
	"post",
	"process",
	"publish",
	"queue",
	"ready",
	"register",
	"remove",
	"rename",
	"request",
	"resolve",
	"resume",
	"respond",
	"run",
	"save",
	"sanitize",
	"send",
	"set",
	"skip",
	"start",
	"submit",
	"summarize",
	"sync",
	"update",
	"upload",
	"validate",
	"wait",
]

/** @type {import("eslint").Rule.RuleModule} */
const featureNamingRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce v2/v3 feature naming: handlers are on-<kebab>.ts, actions are camelCase " +
				"imperative verbs, folders are kebab-case domains (no on-/handler/event/helpers).",
		},
		schema: [
			{
				type: "object",
				properties: {
					allowReceivedSuffix: {
						type: "boolean",
						default: true,
						description: "Allow '<domain>-received.ts' frontend event receivers in handlers/.",
					},
					imperativeVerbs: {
						type: "array",
						items: { type: "string" },
						default: [
							"abort",
							"add",
							"aggregate",
							"apply",
							"arm",
							"build",
							"cancel",
							"check",
							"clear",
							"close",
							"compute",
							"condense",
							"create",
							"delete",
							"delegate",
							"dispatch",
							"ensure",
							"execute",
							"export",
							"finalize",
							"filter",
							"flush",
							"get",
							"handle",
							"import",
							"init",
							"mark",
							"merge",
							"move",
							"notify",
							"open",
							"parse",
							"post",
							"process",
							"publish",
							"queue",
							"ready",
							"register",
							"remove",
							"rename",
							"request",
							"resolve",
							"resume",
							"respond",
							"run",
							"save",
							"sanitize",
							"send",
							"set",
							"skip",
							"start",
							"submit",
							"summarize",
							"sync",
							"update",
							"upload",
							"validate",
							"wait",
						],
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			handlerFileNaming:
				"File '{{filename}}' in a 'handlers/' directory must be named on-<event-name>.ts " +
				"(v2 plan, architectural-restructure-v2.md: 'every event has exactly one handler file " +
				"named on-<event-name>.ts', kebab-case). Example: 'messageEnhancer.ts' → the event it " +
				"handles gets 'on-<that-event>.ts'; shared fragments move to the feature domain, not " +
				"into ad-hoc helper files.",
			handlerSuffixFile:
				"File '{{filename}}' uses the 'Handler.ts' suffix. v2/v3 plan: handlers are on-<event>.ts " +
				"files inside 'handlers/' — never 'XxxHandler.ts'. Example: 'checkpointRestoreHandler.ts' " +
				"→ 'handlers/checkpoint/on-checkpoint-restore.ts' (one file per Event/Intent constant).",
			actionFileKebab:
				"File '{{filename}}' in an 'actions/' directory is kebab-case. v2/v3 plan: actions are " +
				"camelCase IMPERATIVE-VERB files (createTask.ts, sendMessage.ts). Example: " +
				"'task-command-intents.ts' is a noun phrase AND kebab — either rename to the verb it " +
				"performs ('createTaskCommands.ts') or move it to the domain folder it documents.",
			actionFileNoVerb:
				"File '{{filename}}' in an 'actions/' directory does not start with an imperative verb. " +
				"v2/v3 plan: one action file = one verb ('createTask.ts', 'sendCondenseEvent.ts'). " +
				"'{{filename}}' is a noun — name it after what it DOES, e.g. 'stats.ts' → " +
				"'collectTimeMachineStats.ts'.",
			folderOnPrefix:
				"Folder '{{folder}}' starts with 'on'. NO folder may ever start with 'on' — in ANY form " +
				"(on-settings, on_settings, onSettings, onDownload): the 'on-' prefix belongs to " +
				"handler FILES (one file per Event/Intent constant, v2 plan: 'on-<event-name>.ts'), and a " +
				"folder is a domain container — a folder never IS an event. Fix: rename the folder to the " +
				"domain it contains ('handlers/on-settings-api-config/' → the folder becomes the domain " +
				"it holds, e.g. 'api-config/'; the event itself is the FILE 'on-settings-api-config.ts' " +
				"inside 'handlers/').",
			folderForbiddenToken:
				"Folder '{{folder}}' contains the forbidden token '{{token}}'. v3 plan (rule 1): folders " +
				"are kebab-case DOMAINS, not mechanisms. 'handler'/'event'/'helpers' name HOW things work, " +
				"not WHAT the domain is. Example: 'autoapprovalhandler/' → 'auto-approval/'; " +
				"'handlers/helpers/' → split its files into the domains they serve.",
		},
	},
	create(context) {
		const options = context.options[0] || {}
		const allowReceivedSuffix = options.allowReceivedSuffix ?? true
		const verbs = options.imperativeVerbs ?? DEFAULT_VERBS

		const filename = context.filename ?? context.getFilename()
		const parts = filename.split(path.sep)
		const fileIndex = parts.length - 1
		const featuresIndex = parts.lastIndexOf("features")

		// Applies only inside .../features/<feature>/...
		if (featuresIndex === -1 || featuresIndex >= fileIndex) return {}

		const basename = parts[fileIndex]
		const parentFolder = parts[fileIndex - 1]
		const dirParts = parts.slice(featuresIndex + 1, fileIndex)
		const node = context.sourceCode.ast

		const isTest = /\.(test|spec)\./.test(basename)
		const isIndex = /^index\.(ts|tsx|js)$/.test(basename)
		const isHook = /^use[A-Z]/.test(basename)

		// ── Check A: files directly inside handlers/ must be on-<kebab>.ts ──
		if (parentFolder === "handlers" && !isTest && !isIndex) {
			const kebab = /^[a-z0-9]+(-[a-z0-9]+)*\.tsx?$/.test(basename)
			const isOnEvent = kebab && /^on-/.test(basename)
			const isRegister = /^register/.test(basename)
			const isReceived = allowReceivedSuffix && /^([a-z0-9]+(-[a-z0-9]+)*-)?received\.tsx?$/.test(basename)
			if (!isHook && !isOnEvent && !isRegister && !isReceived) {
				context.report({ node, messageId: "handlerFileNaming", data: { filename: basename } })
			}
		}

		// ── Check B: *Handler.ts(x) suffix is forbidden in features/ ──
		if (/Handler\.tsx?$/.test(basename) && !isHook && !isTest && !isIndex) {
			context.report({ node, messageId: "handlerSuffixFile", data: { filename: basename } })
		}

		// ── Check C: files directly inside actions/ must be camelCase imperative verbs ──
		if (parentFolder === "actions" && !isTest && !isIndex && !isHook) {
			const basenameNoExt = basename.replace(/\.(tsx?|jsx?)$/, "")
			if (basenameNoExt.includes("-")) {
				context.report({ node, messageId: "actionFileKebab", data: { filename: basename } })
			} else if (!basenameNoExt.includes(".")) {
				// dotted fragments (checkpoints.helpers.ts) — reported by the domain-cluster rule
				const leading = /^[a-z]+/.exec(basenameNoExt.slice(1))
				const firstWord = basenameNoExt[0].toLowerCase() + (leading ? leading[0] : "")
				if (!verbs.includes(firstWord)) {
					context.report({ node, messageId: "actionFileNoVerb", data: { filename: basename } })
				}
			}
		}

		// ── Check D: folders between features/ and the file are kebab-case domains ──
		const structural = new Set(["handlers", "events", "actions", "store", "models", "types", "index", "ui"])
		for (const folder of dirParts) {
			if (structural.has(folder)) continue
			// NO folder may start with 'on' in ANY form: kebab 'on-settings' (the first
			// dash segment is exactly 'on'), camelCase 'onSettings'/'onDownload', snake
			// 'on_settings'. 'onboarding' is a real domain — only 'on' as a standalone
			// segment, or 'on' glued directly to an uppercase/underscore, counts.
			const folderParts = folder.split("-")
			const startsWithOn =
				folder === "on" || folderParts[0] === "on" || /^on[A-Z]/.test(folder) || /^on_/.test(folder)
			if (startsWithOn) {
				context.report({ node, messageId: "folderOnPrefix", data: { folder } })
				continue
			}
			for (const token of ["handler", "event", "helpers"]) {
				// Exact dash-part or suffix match only — a bare substring match
				// false-positives on concatenated domain words ('eventlog' ≠ 'event').
				const hit = folderParts.some(
					(part) => part === token || (part.length > token.length && part.endsWith(token)),
				)
				if (hit) {
					context.report({ node, messageId: "folderForbiddenToken", data: { folder, token } })
					break
				}
			}
		}

		return {}
	},
}

export default featureNamingRule
