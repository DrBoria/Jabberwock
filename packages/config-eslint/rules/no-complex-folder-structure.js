import fs from "node:fs"
import path from "node:path"

/**
 * Role words that legitimately follow a shared domain prefix in SIBLING filenames.
 *
 * v2 handler model: a folder like 'handlers/' contains ONE FILE PER EVENT, named
 * 'on-<domain>-<event>.ts'. There the shared prefix ('on-goal', 'on-task', 'on-tts',
 * 'on-settings', 'on-message', 'on-notification', 'on-textarea') is the domain and
 * the trailing word is the EVENT — that is the correct v2 layout, NOT an un-split
 * domain. In contrast 'on-context-condense-api/types/history/utils' is a domain that
 * was never split: the trailing words are ROLE suffixes of ONE entity.
 *
 * The rule therefore only reports a shared prefix when the suffixes are NOT role
 * words (i.e. they are distinct events). This whitelist is the distinction.
 */
const ROLE_SUFFIXES = new Set([
	// fragment/role suffixes seen in D50/D51 (event + role = un-split entity)
	"api",
	"types",
	"history",
	"utils",
	"errors",
	"io",
	"metadata",
	"helpers",
	"handlers",
	"save-handler",
	"crud",
	"state",
	"execution",
	"validators",
	"validation",
	"constants",
	"interfaces",
	"factory",
	"registry",
	"base",
	"index",
	// compound role words used in D51 fragment families
	"save",
	"config",
	"logic",
	"components",
	"hooks",
	"effects",
	"callbacks",
	"selectors",
	"providers",
	"compute",
	"parsers",
	"builder",
	"builders",
])

/**
 * Tooling/convention file prefixes.
 *
 * In an ecosystem config file the FIRST dot segment is the TOOL name
 * (eslint.config.mjs -> 'eslint', vitest.setup.ts -> 'vitest',
 * tsconfig.base.json -> 'tsconfig'), not a domain entity. The SAME dotted
 * pattern in CODE files (git.helpers.ts, manager.factory.ts,
 * orchestrator.scan.ts) is the D51 "un-split entity" violation. Renaming
 * tooling would break the tool, so the dottedBasename check exempts files
 * whose leading dot segment is a known tool name.
 *
 * Matched against the basename without extension:
 *   eslint.config  -> starts with 'eslint.'        (exempt)
 *   vitest.setup   -> starts with 'vitest.'        (exempt)
 *   git.helpers    -> no tool prefix               (REPORTED)
 *   manager.factory-> no tool prefix               (REPORTED)
 */
const TOOLING_FILE_PREFIXES = new Set([
	"eslint",
	"vitest",
	"vite",
	"turbo",
	"tsconfig",
	"package",
	"knip",
	"tsup",
	"tsdown",
	"biome",
	"oxlint",
	"drizzle",
	"prisma",
	"webpack",
	"rollup",
	"next",
	"tailwind",
	"postcss",
	"jest",
	"babel",
	"prettier",
	"c8",
	"nyc",
	"nodemon",
	"lefthook",
	"husky",
	"commitlint",
	"semantic-release",
	"cspell",
	"stylelint",
	"vitepress",
	"typedoc",
	"verdaccio",
	"astro",
	"tauri",
	"playwright",
	"cypress",
	"esbuild",
])

/**
 * Convert a camelCase/PascalCase name to kebab-case so that folder names and
 * file names can be compared across casing conventions.
 *
 * Folders in this codebase are camelCase (`resumeTask/`, `streamExecutor/`)
 * while files are kebab-case (`resume-task-helpers.ts`). A literal
 * `startsWith(folder + "-")` check therefore MISSES the most common
 * duplication: `resumeTask/` + `resume-task-*.ts`. Normalizing both sides to
 * kebab-case closes that gap.
 * @param {string} s
 * @returns {string}
 */
function camelToKebab(s) {
	return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

/**
 * Whether the given basename (without extension) is a tooling/config file,
 * i.e. its leading dot segment is a known tool name.
 * @param {string} baseNoExt
 * @returns {boolean}
 */
function isToolingConfigFile(baseNoExt) {
	for (const tool of TOOLING_FILE_PREFIXES) {
		if (baseNoExt.startsWith(tool + ".")) return true
	}
	return false
}

/**
 * Next.js App Router route files have FIXED names mandated by the framework
 * (page.tsx, layout.tsx, ...). They live in `app/` directories and a route
 * segment folder may legitimately share a route file name (e.g. the /blog
 * route file 'page.tsx' next to the /blog/page/[page] segment folder 'page/').
 * These names cannot be renamed without breaking routing, so they are exempt
 * from the folder≠file checks (same category as the index.ts exemption).
 */
const NEXT_JS_ROUTE_FILES = new Set([
	"page.tsx",
	"page.ts",
	"layout.tsx",
	"layout.ts",
	"loading.tsx",
	"error.tsx",
	"template.tsx",
	"route.ts",
	"global-error.tsx",
	"not-found.tsx",
])

/**
 * Whether the file is a Next.js App Router route file (fixed framework name
 * inside an app/ directory).
 * @param {string} filename
 * @param {string} dirname
 * @returns {boolean}
 */
function isNextJsRouteFile(filename, dirname) {
	return NEXT_JS_ROUTE_FILES.has(path.basename(filename)) && dirname.includes(`${path.sep}app${path.sep}`)
}

/**
 * Folder-structure rule (v3: architecture-restructure-v3-plan.md, rule 1; v2:
 * architectural-restructure-v2.md, naming table).
 *
 * Core principle: A FILE NAMES THE CATEGORY OF WHAT IT CONTAINS. 'types/api.ts' holds
 * the API types, 'types/messages.ts' holds the message types, 'types/data-types.ts' holds
 * the data types — and everything is exported through the folder's 'index.ts'. A FOLDER
 * is a domain container and exists only when the domain carries too much logic to fit in
 * one file (~200 lines). Consequences enforced here:
 *  - a file must never be named after its own folder or a sibling subfolder — if the
 *    file is the ONLY one in the folder (index.ts aside), the folder is deleted and the
 *    single file is kept; otherwise the file is renamed to what it actually does
 *    (the essence of that one file, not the folder's domain);
 *  - a name fragment repeated across sibling files ('git-utils.ts' + 'utils.ts',
 *    'gitUtils.ts' + 'utils.ts') is an un-split domain: the fragment must become a
 *    subfolder, not a file name prefix/suffix (Check G);
 *  - max files per folder, no 4+ segment folder names, no dotted role suffixes. *  - NO 'store/' FOLDERS (D53): a feature's state is ONE file — store.ts (a
 *    single MST root store). A 'store/' folder is the store split back into
 *    fragments (store/models/, store/slices/…): fold everything into store.ts.
 *    A top-level feature named 'store' (directly under a 'features/' root) is
 *    a feature, not a store folder, and is exempt. */
/** @type {import("eslint").Rule.RuleModule} */
const noComplexFolderStructureRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce folder structure constraints: a file names the CATEGORY of what it contains " +
				"(never its folder name or a sibling subfolder's name), a name fragment shared between " +
				"siblings is an un-split domain (must become a subfolder), max files per folder, no " +
				"compound folder names, no dotted role suffixes.",
		},
		schema: [
			{
				type: "object",
				properties: {
					maxFilesPerFolder: { type: "number", default: 7 },
					noFolderNameInFilename: { type: "boolean", default: true },
					noDuplicateBasenamePrefix: { type: "boolean", default: true },
					noCompoundFolderName: { type: "boolean", default: true },
					minCompoundFolderSegments: { type: "number", default: 4 },
					noDottedBasename: { type: "boolean", default: true },
					noStoreFolder: { type: "boolean", default: true },
					noDuplicateName: { type: "boolean", default: true },
					indexRequired: { type: "boolean", default: true },
					noLayerMixing: { type: "boolean", default: true },
					roleSuffixes: {
						type: "array",
						items: { type: "string" },
						default: [],
					},
					ignoredFolders: {
						type: "array",
						items: { type: "string" },
						default: ["node_modules", ".turbo", "dist", ".git"],
					},
					ignoredFiles: {
						type: "array",
						items: { type: "string" },
						default: ["index.ts", "index.tsx", "index.js", "README.md"],
					},
					includes: {
						type: "array",
						items: { type: "string" },
						default: [],
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			maxFilesPerFolder:
				"Folder '{{folder}}' has {{count}} files (max {{max}}). " +
				"v3 plan (architecture-restructure-v3-plan.md, rule 1): a folder describes ONE domain — " +
				"split it into subfolders per domain (e.g. 'handlers/' → one subfolder per event group).",
			folderEqualsFilename:
				"File '{{filename}}' has EXACTLY the same name as its parent folder '{{folder}}'. " +
				"A file must name ONLY the category of what it contains (types/api.ts holds the API types, " +
				"types/messages.ts holds the message types, types/data-types.ts holds the data types), exported " +
				"through the folder's index.ts — never the folder's own name. Fix: if '{{filename}}' is the " +
				"ONLY file in '{{folder}}/' (index.ts aside), DELETE the folder and keep the single file — " +
				"a folder + index.ts exists only when the domain carries too much logic to fit in one file " +
				"(~200 lines). If the folder holds several files, rename '{{filename}}' to what it actually " +
				"does — the essence of that one file (the folder already IS the domain: the entry file of " +
				"'cli/' is about RUNNING the cli, not about 'cli' in general).",
			folderNameInFilename:
				"Filename '{{filename}}' repeats the parent folder name '{{folder}}' as a prefix. " +
				"v3 plan (rule 1, noFolderNameInFilename): the folder already carries the domain name — " +
				"the file prefix is pure noise. Rename the file without the duplicated fragment, e.g. " +
				"'on-settings-api-config/handlers.ts' instead of 'on-settings-api-config/on-settings-api-config-helpers.ts'.",
			fileSameAsSubfolder:
				"File '{{filename}}' is named the same as the subfolder '{{subfolder}}/' in the same directory. " +
				"A file must name ONLY the category of what it contains — a name collision with a sibling " +
				"folder makes it unreadable which one is the container and which one is the unit. Fix: rename " +
				"the file to what it actually does (the essence of that file), or, if the folder is just a " +
				"wrapper around this one file (index.ts aside), DELETE the folder and keep the single file. " +
				"A folder + index.ts is justified only when the domain carries too much logic to fit in one " +
				"file (~200 lines).",
			domainCluster:
				"{{count}} files in '{{folder}}' share the leading segment '{{segment}}' ({{files}}). " +
				"v2 plan (architectural-restructure-v2.md, handler model: one file per Event/Intent constant): " +
				"a fragment repeated across sibling filenames is a DOMAIN, not a file prefix. " +
				"Split it into a subfolder '{{segment}}/' and name each file after the concrete event inside " +
				"it, e.g. 'condense/' + 'on-context-compress-requested.ts', 'on-context-compress-completed.ts'. " +
				"Common fragments duplicated across filenames = the domain split was never done.",
			compoundFolderName:
				"Folder name '{{folder}}' has {{segments}} kebab segments (max {{max}}). " +
				"v3 plan (rule 1): a folder name is a DOMAIN, not a path description — " +
				"'a-b-c-d' encodes 4 domains and should be one folder per domain " +
				"(nest the sub-domains) or shortened to the primary domain name.",
			dottedBasename:
				"Filename '{{filename}}' uses a dotted role suffix ('.{{suffix}}'). " +
				"v2 plan (naming table): a file is named after ONE concrete thing in kebab-case; " +
				"dotted role fragments ('store.snapshot.ts', 'checkpoints.git.ts', 'CodeBlock.hooks.tsx') " +
				"are un-split entities. A store.* fragment folds into the feature's single store.ts " +
				"(D53: one store.ts per feature — no store/ folders); any other role fragment folds " +
				"into the file's owner (rename to kebab, or merge into the entity it belongs to).",
			unsplitDomainSplit:
				"File '{{filename}}' and its sibling '{{sibling}}' repeat the domain word '{{domain}}' " +
				"in their names — the domain was never split into a subfolder, so the name fragment does " +
				"the splitting work (wrong split by name). A file must name ONLY the category of what it " +
				"contains; a fragment repeated across sibling files is a DOMAIN and must become a " +
				"subfolder. Fix: 'git-utils.ts' + 'utils.ts' → 'utils/' folder with 'git.ts' (what it " +
				"does) and the shared part exported through 'utils/index.ts' or a file named after its " +
				"content.",
			storeFolder:
				"Store folder '{{folder}}': a feature's state is ONE file — store.ts (a single MST root " +
				"store). D53 / v2 rule #4: a store/ (or stores/) folder is the store split into " +
				"fragments, which is also where shadow stores hide. Merge this folder's state into the " +
				"feature's single store.ts as MST models on the root store and delete the folder. " +
				"(A top-level feature named 'store' is exempt — it is a feature, not a store folder.)",
			duplicateName:
				"'{{filename}}' and sibling '{{sibling}}' are the same concept named at two granularities " +
				"(one name is the generic base form of the other, or both are 'concept + role words' of " +
				"one shared concept). A fragment shared with a sibling is never a file prefix — it is a " +
				"DOMAIN (same rule as Checks D/G). Either rename the vaguer file after the CONCRETE case " +
				"it holds, or — if the domain is ONE file — merge the two into a single file (~200 lines) " +
				"exporting all of the domain's parts. Two files for one concept is neither all-private " +
				"nor one shared file, and no reader can tell what belongs where.",
			indexMissing:
				"Folder '{{folder}}' holds {{count}} files ({{files}}) but has NO index.ts. v3 rule 1: a " +
				"folder is a domain container with a PUBLIC API — it exists only when the domain carries " +
				"too much logic for one file, and then that domain gets an entry point. Without an " +
				"index.ts the folder is a bag of files no one can import as a domain: add " +
				"'{{folder}}/index.ts' re-exporting its parts.",
			indexOnlyOneFile:
				"Folder '{{folder}}' is an index.ts plus a SINGLE file. A folder + index.ts is " +
				"justified only when the domain carries too much logic for one file (~200 lines) — with " +
				"a single file there is nothing to re-export, so delete the folder and hoist that file " +
				"to the parent level (v3 rule 1).",
			layerMixing:
				"File '{{filename}}' lives in the '{{layer}}s' layer but is named after the '{{mixed}}' " +
				"layer. v2: actions, handlers and events are three SEPARATE layers of one flow (one " +
				"action-creator per event, one handler per action, stateless handlers) — a file mixing " +
				"them makes the flow untraceable from the folder tree. Move it into the " +
				"'{{mixed}}s/' layer, or rename it after the CATEGORY of what it actually contains.",
			redundantPrefix:
				"{{count}} files in '{{folder}}' (actions layer) share the leading segment '{{segment}}' " +
				"({{files}}). The actions layer holds one action-creator per distinct concern — a verb " +
				"repeated across sibling names ('process-context', 'process-file', 'process-tool') does " +
				"not split the domain, it restates it. The folder already IS the domain: rename each " +
				"file after the CONCRETE concern it holds (drop the shared verb), e.g. 'text-block', " +
				"'text-parts', 'tool-result', 'user-content'. (Handler 'on-<event>' files are the " +
				"correct one-file-per-event layout and are never flagged.)",
		},
	},
	create(context) {
		const options = context.options[0] || {}
		const maxFilesPerFolder = options.maxFilesPerFolder ?? 7
		const noFolderNameInFilename = options.noFolderNameInFilename ?? true
		const noDuplicateBasenamePrefix = options.noDuplicateBasenamePrefix ?? true
		// NOTE: ESLint does NOT apply schema `default` values — always fall back here.
		const noCompoundFolderName = options.noCompoundFolderName ?? true
		const minCompoundFolderSegments = options.minCompoundFolderSegments ?? 4
		const noDottedBasename = options.noDottedBasename ?? true
		const noStoreFolder = options.noStoreFolder ?? true
		const noDuplicateName = options.noDuplicateName ?? true
		const indexRequired = options.indexRequired ?? true
		const noLayerMixing = options.noLayerMixing ?? true
		const roleSuffixes = new Set([
			...ROLE_SUFFIXES,
			...(Array.isArray(options.roleSuffixes) ? options.roleSuffixes : []),
		])
		// Role words for the duplicateName concept check (normalized, so
		// 'handlers'/'handler' and 'events'/'event' both fold in).
		const duplicateRoleWords = new Set([
			...[...ROLE_SUFFIXES, ...(Array.isArray(options.roleSuffixes) ? options.roleSuffixes : [])].map(
				normalizeWord,
			),
			...[...LAYER_WORDS].map(normalizeWord),
			"main",
			"singleton",
			"service",
			"manager",
			"view",
			"model",
			"component",
			"hook",
			"use",
			"impl",
			"legacy",
			"test",
			"mock",
			"stub",
		])
		const ignoredFolders = options.ignoredFolders ?? ["node_modules", ".turbo", "dist", ".git"]
		const ignoredFiles = options.ignoredFiles ?? ["index.ts", "index.tsx", "index.js", "README.md"]
		const includes = options.includes ?? []

		/**
		 * Check if a file is in the ignored list.
		 * @param {string} filename
		 * @returns {boolean}
		 */
		function isIgnoredFile(filename) {
			for (const pattern of ignoredFiles) {
				// Support wildcard patterns like *.test.*, *.spec.*
				if (pattern === filename) return true
				if (pattern.startsWith("*") && filename.endsWith(pattern.slice(1))) return true
				if (pattern.endsWith("*") && filename.startsWith(pattern.slice(0, -1))) return true
			}
			return false
		}

		/**
		 * Check if a directory name is in the ignored list.
		 * @param {string} dirName
		 * @returns {boolean}
		 */
		function isIgnoredFolder(dirName) {
			return ignoredFolders.includes(dirName)
		}

		/**
		 * Check if a file matches the includes glob pattern.
		 * Empty includes means all files are included.
		 * Supports glob patterns like *.ts, *.tsx, *.js, etc.
		 * @param {string} filename
		 * @returns {boolean}
		 */
		function isIncluded(filename) {
			if (includes.length === 0) return true
			return includes.some((pattern) => {
				// Simple glob: *.ext matches files ending with .ext
				if (pattern.startsWith("*.")) {
					return filename.endsWith(pattern.slice(1))
				}
				return filename === pattern
			})
		}

		/**
		 * Get the basename without extension(s).
		 * Handles .ts, .tsx, .js, .jsx, .test.ts, .spec.tsx, etc.
		 * @param {string} filename
		 * @returns {string}
		 */
		function getBasenameWithoutExt(filename) {
			let name = filename
			// Strip known extensions repeatedly
			while (true) {
				const ext = path.extname(name)
				if (!ext || ext === name) break
				name = name.slice(0, -ext.length)
			}
			return name
		}

		/**
		 * Check if a file is a test file.
		 * @param {string} filename
		 * @returns {boolean}
		 */
		function isTestFile(filename) {
			return /\.(spec|test)\./.test(filename)
		}

		return {
			Program() {
				const filename = context.filename ?? context.getFilename()
				const dirname = path.dirname(filename)
				const projectRoot = getProjectRoot(dirname)

				if (!projectRoot) return

				// A package root is not a domain folder — skip its domain checks.
				const isPkgRoot = isPackageRoot(dirname)

				// Check A: maxFilesPerFolder — only report at the file's directory
				if (maxFilesPerFolder > 0 && !isPkgRoot) {
					const filesInDir = collectFiles(dirname, ignoredFolders)
					const nonIgnoredFiles = filesInDir.filter((f) => !isIgnoredFile(f) && isIncluded(f))
					if (nonIgnoredFiles.length > maxFilesPerFolder) {
						context.report({
							node: context.sourceCode.ast,
							messageId: "maxFilesPerFolder",
							data: {
								folder: path.basename(dirname),
								count: String(nonIgnoredFiles.length),
								max: String(maxFilesPerFolder),
							},
						})
					}
				}

				// Check B: folder ≠ file — a file must never be named the same as its
				// parent folder (exact match) or repeat the folder name as a prefix.
				if (noFolderNameInFilename) {
					const basename = path.basename(filename)
					const basenameNoExt = getBasenameWithoutExt(basename)
					const parentFolderName = path.basename(dirname)

					// Skip test files, store.ts, store.tsx, index.ts, index.tsx, Next.js route files
					if (
						!isTestFile(basename) &&
						basename !== "store.ts" &&
						basename !== "store.tsx" &&
						basename !== "index.ts" &&
						basename !== "index.tsx" &&
						!isNextJsRouteFile(filename, dirname)
					) {
						// Normalize both sides to kebab-case: folders are camelCase
						// ('resumeTask/') while files are kebab-case ('resume-task-*'),
						// so a literal prefix check misses the most common duplication.
						const folderKebab = camelToKebab(parentFolderName)
						if (basenameNoExt === parentFolderName) {
							context.report({
								node: context.sourceCode.ast,
								messageId: "folderEqualsFilename",
								data: { filename: basename, folder: parentFolderName },
							})
						} else if (
							basenameNoExt.startsWith(folderKebab + "-") ||
							basenameNoExt.startsWith(parentFolderName + "-")
						) {
							context.report({
								node: context.sourceCode.ast,
								messageId: "folderNameInFilename",
								data: { filename: basename, folder: parentFolderName },
							})
						}
					}
				}

				// Check C: file ≠ subfolder — a file must never be named the same as
				// a subdirectory in the same directory (folder/file name collision,
				// second direction of the folder≠file rule).
				if (noFolderNameInFilename) {
					const basename = path.basename(filename)
					const basenameNoExt = getBasenameWithoutExt(basename)
					if (
						!isTestFile(basename) &&
						!["store.ts", "store.tsx", "index.ts", "index.tsx"].includes(basename) &&
						!isIgnoredFile(basename) &&
						!isNextJsRouteFile(filename, dirname)
					) {
						const subfolders = collectDirs(dirname)
						const clashing = subfolders.find(
							(d) => d === basenameNoExt || d === basename || d.startsWith(basenameNoExt + "-"),
						)
						if (clashing) {
							context.report({
								node: context.sourceCode.ast,
								messageId: "fileSameAsSubfolder",
								data: { filename: basename, subfolder: clashing },
							})
						}
					}
				}

				// Check D: domainCluster — N+ sibling files sharing a common kebab prefix
				// mean the prefix is an un-split domain and must become a subfolder.
				if (noDuplicateBasenamePrefix) {
					const filesInDir = collectFiles(dirname, ignoredFolders).filter(
						(f) =>
							!isTestFile(f) &&
							f !== "index.ts" &&
							f !== "index.tsx" &&
							f !== "store.ts" &&
							f !== "store.tsx" &&
							isIncluded(f),
					)
					const cluster = roleCluster(
						filesInDir.map((f) => getBasenameWithoutExt(f)),
						roleSuffixes,
					)
					if (cluster) {
						// Report ONLY for files that ARE cluster members. Non-members
						// (index.ts, store.ts, unrelated siblings) are exempt — they do
						// not share the prefix and are not part of the un-split domain.
						const currentBaseName = getBasenameWithoutExt(path.basename(filename))
						if (cluster.group.includes(currentBaseName)) {
							context.report({
								node: context.sourceCode.ast,
								messageId: "domainCluster",
								data: {
									folder: path.basename(dirname),
									segment: cluster.segment,
									count: String(cluster.group.length),
									files:
										cluster.group.slice(0, 3).join(", ") + (cluster.group.length > 3 ? ", …" : ""),
								},
							})
						}
					}
				}

				// Check E: compoundFolderName — a folder name with 4+ kebab segments is a
				// path description, not a domain. v3 rule 1: one folder = one domain.
				if (noCompoundFolderName && minCompoundFolderSegments > 0) {
					const folderName = path.basename(dirname)
					const dashCount = (folderName.match(/-/g) ?? []).length
					const segments = dashCount + 1
					if (segments >= minCompoundFolderSegments) {
						context.report({
							node: context.sourceCode.ast,
							messageId: "compoundFolderName",
							data: {
								folder: folderName,
								segments: String(segments),
								max: String(minCompoundFolderSegments - 1),
							},
						})
					}
				}

				// Check F: dottedBasename — a filename like 'store.snapshot.ts' or
				// 'checkpoints.git.ts' uses a dotted role suffix = an un-split entity.
				// v2 naming table: one file = one concrete thing, kebab-case.
				// Dotfiles ('.eslintrc.js'), test files, declaration files ('foo.d.ts')
				// and tooling configs ('eslint.config.mjs', 'vitest.setup.ts',
				// 'tsconfig.base.json' — the leading dot segment is the TOOL name, not
				// a domain) are exempt: none of those dots is a role fragment.
				if (noDottedBasename) {
					const basename = path.basename(filename)
					if (!basename.startsWith(".") && !isTestFile(basename) && !isIgnoredFile(basename)) {
						// Strip ONLY the single file extension (getBasenameWithoutExt strips
						// every dot segment, which would hide the dotted role suffix).
						const ext = path.extname(basename)
						const baseNoExt = basename.slice(0, basename.length - ext.length)
						if (!baseNoExt.endsWith(".d")) {
							const dotIndex = baseNoExt.lastIndexOf(".")
							if (dotIndex > 0 && !isToolingConfigFile(baseNoExt)) {
								const suffix = baseNoExt.slice(dotIndex + 1)
								context.report({
									node: context.sourceCode.ast,
									messageId: "dottedBasename",
									data: {
										filename: basename,
										suffix,
									},
								})
							}
						}
					}
				}

				// Check G: unsplitDomainSplit — the current file and a SIBLING in the same folder
				// repeat the same domain word in their names: 'utils.ts' + 'git-utils.ts' (kebab)
				// or 'utils.ts' + 'gitUtils.ts' (camelCase). The domain word never became a
				// subfolder — the name fragment does the splitting work. The domain word becomes
				// a subfolder; each file keeps only what it does ('utils/' + 'git.ts').
				if (noDuplicateBasenamePrefix) {
					const dirBases = collectFiles(dirname, ignoredFolders)
						.filter(
							(f) =>
								!isTestFile(f) &&
								f !== "index.ts" &&
								f !== "index.tsx" &&
								f !== "store.ts" &&
								f !== "store.tsx" &&
								isIncluded(f),
						)
						.map((f) => getBasenameWithoutExt(f))
					const currentBase = getBasenameWithoutExt(path.basename(filename))
					if (currentBase.includes("-")) {
						const parts = currentBase.split("-")
						for (let i = 1; i < parts.length; i++) {
							const frag = parts.slice(i).join("-")
							if (dirBases.includes(frag)) {
								context.report({
									node: context.sourceCode.ast,
									messageId: "unsplitDomainSplit",
									data: {
										filename: path.basename(filename),
										sibling: frag + path.extname(filename),
										domain: frag,
									},
								})
								break
							}
						}
					} else if (/[a-z][A-Z]/.test(currentBase)) {
						const tail = decamelizeTail(currentBase)
						if (tail && dirBases.includes(tail)) {
							context.report({
								node: context.sourceCode.ast,
								messageId: "unsplitDomainSplit",
								data: {
									filename: path.basename(filename),
									sibling: tail + path.extname(filename),
									domain: tail,
								},
							})
						}
					}
				}

				// Check H: storeFolder — NO 'store/' / 'stores/' folders (D53): a
				// feature's state is ONE file — store.ts (a single MST root store).
				// A store/ folder is the store split into fragments (and the usual
				// hiding place for shadow stores): merge into the feature's store.ts.
				// A top-level feature NAMED 'store' (parent dir is a 'features' root)
				// is a feature, not a store folder — exempt.
				if (noStoreFolder) {
					const folderName = path.basename(dirname)
					if (folderName === "store" || folderName === "stores") {
						const parentName = path.basename(path.dirname(dirname))
						if (parentName !== "features") {
							context.report({
								node: context.sourceCode.ast,
								messageId: "storeFolder",
								data: { folder: folderName },
							})
						}
					}
				}
				// Check I: duplicateName — two sibling files whose names are the same thing at
				// two levels of granularity ('handlers.ts' next to 'approval-handler.ts',
				// 'dispatcher.ts' next to 'dispatcher-types.ts'). The generic base file has no
				// own identity: either every file is a CONCRETE case, or the domain has ONE
				// shared file (~200 lines) exporting all of them. Comparison folds case,
				// kebab/dot/camel boundaries and the trailing plural 's' ('handlers' ≡ 'handler').
				if (noDuplicateName && !isPkgRoot) {
					const basename = path.basename(filename)
					const currentBase = getBasenameWithoutExt(basename)
					if (!isTestFile(basename) && !isIgnoredFile(basename) && !isNextJsRouteFile(filename, dirname)) {
						const dirFiles = collectFiles(dirname, ignoredFolders)
						// NOTE: store.ts is deliberately NOT exempted here — the
						// 'store-snapshot.ts' / 'storeSingleton.ts' siblings are exactly
						// the same-concept-at-two-granularity debt this check exists for.
						const siblings = dirFiles.filter(
							(f) => f !== basename && !isTestFile(f) && !isIgnoredFile(f) && isIncluded(f),
						)
						// Check D already reports an un-split domain cluster (3+ siblings sharing a
						// role-word prefix): its fix — the shared prefix becomes a subfolder —
						// resolves the granularity overlap too, so Check I defers to it.
						const cluster = roleCluster(
							dirFiles
								.filter((f) => !isTestFile(f) && !isIgnoredFile(f) && isIncluded(f))
								.map((f) => getBasenameWithoutExt(f)),
							roleSuffixes,
						)
						const currentWords = nameWords(currentBase)
						// The folder name IS the domain: a fragment that equals it has already
						// been extracted into the folder, so it is the container, not "one thing
						// named twice". Exclude it from the shared-concept set. (Without this,
						// 'mcp/UseMcpToolTool.ts' + 'mcp/accessMcpResourceTool.ts' is a false
						// positive: both are concrete tools of the mcp domain, and 'mcp' is just
						// the domain they already live in.)
						const domainWords = new Set(nameWords(path.basename(dirname)))
						for (const sibling of siblings) {
							const siblingBase = getBasenameWithoutExt(sibling)
							// An exact kebab tail ('utils.ts' + 'git-utils.ts') is Check G's finding.
							if (currentBase.endsWith("-" + siblingBase) || siblingBase.endsWith("-" + currentBase))
								continue
							const siblingWords = nameWords(siblingBase)
							let sameConcept = false
							if (isWordSubset(currentWords, siblingWords)) {
								// Report on the GENERIC side only — the concrete file is
								// correct as it is, and the generic one is the file whose
								// responsibility is undefined.
								sameConcept = true
							} else {
								// Same concept at two granularities WITHOUT a subset relation
								// ('transport-handlers.ts' + 'transports-main.ts',
								// 'storeSingleton.ts' + 'store-snapshot.ts'): the shared non-role
								// word is the concept, and one side is named ENTIRELY after that
								// concept plus role words — one thing named twice. Role words
								// (handlers/main/types/…) legitimately repeat across siblings,
								// so they never count as the shared concept.
								const shared = new Set()
								for (const word of currentWords) {
									// A word that equals the folder name is the already-extracted
									// domain, not a "concept named twice" — skip it.
									if (
										siblingWords.includes(word) &&
										!duplicateRoleWords.has(word) &&
										!domainWords.has(word)
									)
										shared.add(word)
								}
								if (
									shared.size > 0 &&
									(nonRoleWordsCovered(currentWords, duplicateRoleWords, shared) ||
										nonRoleWordsCovered(siblingWords, duplicateRoleWords, shared))
								) {
									sameConcept = true
								}
							}
							if (!sameConcept) continue
							if (cluster && cluster.group.includes(currentBase) && cluster.group.includes(siblingBase))
								continue
							context.report({
								node: context.sourceCode.ast,
								messageId: "duplicateName",
								data: { filename: basename, sibling },
							})
							break
						}
					}
				}

				// Check J: indexRequired / indexOnlyOneFile — the folder ↔ index.ts contract
				// (v3 rule 1). A folder holding MORE THAN ONE file is a domain whose parts must
				// be re-exported through the folder's index.ts ('prompt-manager/' with
				// manager.ts + timeout-prompt.ts + types.ts and no index.ts is a folder without
				// a public API). The inverse holds as well: an index.ts plus a SINGLE file is a
				// folder that must not exist — keep ONE file of that domain at the parent level.
				// Next.js route folders are exempt (their files are named by the framework).
				if (indexRequired && !isPkgRoot && !isNextJsRouteFile(filename, dirname)) {
					const basename = path.basename(filename)
					if (
						!isIndexBasename(basename) &&
						!isTestFile(basename) &&
						!isIgnoredFile(basename) &&
						isIncluded(basename)
					) {
						const dirFiles = collectFiles(dirname, ignoredFolders)
						const realFiles = dirFiles.filter((f) => !isTestFile(f) && !isIgnoredFile(f) && isIncluded(f))
						const hasIndex = dirFiles.some((f) => isIndexBasename(f))
						if (realFiles.length > 1 && !hasIndex) {
							context.report({
								node: context.sourceCode.ast,
								messageId: "indexMissing",
								data: {
									folder: path.basename(dirname),
									count: String(realFiles.length),
									files: realFiles.slice(0, 3).join(", ") + (realFiles.length > 3 ? ", …" : ""),
								},
							})
						} else if (realFiles.length === 1 && hasIndex && collectDirs(dirname).length === 0) {
							context.report({
								node: context.sourceCode.ast,
								messageId: "indexOnlyOneFile",
								data: { folder: path.basename(dirname) },
							})
						}
					}
				}

				// Check K: layerMixing — actions / handlers / events are three SEPARATE v2
				// layers. A file living in one layer's folder must not be named after another
				// ('actions/resumeTask/handlers.ts' is a handler inside the actions layer, so
				// the folder tree no longer tells the flow's layers apart). The file's own name
				// is compared with the NEAREST layer folder above it (nesting is fine:
				// actions/<domain>/… is still the actions layer). v2 handlers named after the
				// event they handle ('handlers/on-code-action.ts') are the correct layout — exempt.
				if (noLayerMixing) {
					const basename = path.basename(filename)
					const baseNoExt = getBasenameWithoutExt(basename)
					if (!isTestFile(basename) && !isIgnoredFile(basename) && !baseNoExt.startsWith("on-")) {
						const segments = dirname.split(path.sep)
						let layer = null
						for (let i = segments.length - 1; i >= 0; i--) {
							const candidate = normalizeWord(segments[i])
							if (LAYER_WORDS.has(candidate)) {
								layer = candidate
								break
							}
						}
						if (layer) {
							const mixed = baseNoExt
								.split("-")
								.map((word) => normalizeWord(word))
								.find((word) => LAYER_WORDS.has(word) && word !== layer)
							if (mixed) {
								context.report({
									node: context.sourceCode.ast,
									messageId: "layerMixing",
									data: { filename: basename, layer, mixed },
								})
							}
						}
					}
				}

				// Check L: redundantPrefix — in the ACTIONS layer, 3+ siblings sharing a
				// leading single-segment prefix ('process-context', 'process-file',
				// 'process-tool') restate the folder's domain with a shared verb instead of
				// naming distinct concerns. The folder already IS the domain, so the shared
				// verb is noise: each file must name the CONCRETE concern it holds. Handlers
				// are exempt — 'on-<event>' is the correct one-file-per-event layout (and the
				// nearest-layer test below keeps this scoped to the actions layer only).
				// Reported once per folder, on the alphabetically-first member.
				if (noDuplicateBasenamePrefix) {
					const basename = path.basename(filename)
					const baseNoExt = getBasenameWithoutExt(basename)
					if (!isTestFile(basename) && !isIgnoredFile(basename) && !baseNoExt.startsWith("on-")) {
						const segments = dirname.split(path.sep)
						let layer = null
						for (let i = segments.length - 1; i >= 0; i--) {
							const candidate = normalizeWord(segments[i])
							if (LAYER_WORDS.has(candidate)) {
								layer = candidate
								break
							}
						}
						if (layer === "action") {
							const filesInDir = collectFiles(dirname, ignoredFolders).filter(
								(f) =>
									!isTestFile(f) &&
									!isIgnoredFile(f) &&
									f !== "store.ts" &&
									f !== "store.tsx" &&
									isIncluded(f),
							)
							const bases = filesInDir.map((f) => getBasenameWithoutExt(f))
							const prefixGroups = new Map()
							for (const b of bases) {
								const seg = b.split("-")[0]
								if (!seg) continue
								const group = bases.filter((n) => n === seg || n.startsWith(seg + "-"))
								if (group.length >= 3) prefixGroups.set(seg, group)
							}
							const currentBase = baseNoExt
							for (const [seg, group] of [...prefixGroups.entries()].sort(
								(a, b) => b[0].length - a[0].length,
							)) {
								if (!group.includes(currentBase)) continue
								if ([...group].sort()[0] !== currentBase) continue
								context.report({
									node: context.sourceCode.ast,
									messageId: "redundantPrefix",
									data: {
										folder: path.basename(dirname),
										segment: seg,
										count: String(group.length),
										files: group.join(", "),
									},
								})
								break
							}
						}
					}
				}
			},
		}
	},
}

/** The three separate v2 layers. A file belongs to exactly ONE of them (Check K). */
const LAYER_WORDS = new Set(["action", "handler", "event"])

/**
 * Does this basename name the feature's single MST store file (store.ts / store.tsx)?
 * Such a file legitimately composes child models at definition time.
 * @param {string} basename
 * @returns {boolean}
 */
function isStoreBasename(basename) {
	return basename === "store.ts" || basename === "store.tsx"
}

/**
 * Does this basename name a folder entry point (index.ts / .tsx / .js)?
 * @param {string} basename
 * @returns {boolean}
 */
function isIndexBasename(basename) {
	return basename === "index.ts" || basename === "index.tsx" || basename === "index.js"
}

/**
 * Fold a single word for name comparison: lowercase, and the trailing plural 's'
 * dropped for words longer than 3 chars ('handlers' → 'handler', 'events' → 'event',
 * while 'bus' stays 'bus'). Plural and singular spellings of one concept must
 * collide, otherwise 'handlers.ts' + 'approval-handler.ts' slips through.
 * @param {string} word
 * @returns {string}
 */
function normalizeWord(word) {
	const lower = word.toLowerCase()
	return lower.length > 3 && lower.endsWith("s") ? lower.slice(0, -1) : lower
}

/**
 * Normalize a basename into its word list: camelCase humps split, then
 * kebab/dot/underscore boundaries, each word folded by normalizeWord.
 * 'approval-handler' → ['approval', 'handler'], 'startNewTask' → ['start', 'new', 'task'].
 * @param {string} base
 * @returns {string[]}
 */
function nameWords(base) {
	return base
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map(normalizeWord)
}

/**
 * Is every word of `a` present in `b`? Together with the reverse test this
 * detects two names that are one thing at two granularities
 * (['handler'] ⊆ ['approval', 'handler']).
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
function isWordSubset(a, b) {
	const setB = new Set(b)
	return a.length > 0 && a.every((word) => setB.has(word))
}

/**
 * Are all NON-ROLE words of `words` explained by `shared`? I.e. the name is
 * 'concept + role words only', so the whole name is one shared concept
 * ('storeSingleton' = store + singleton, 'transport-handlers' = transport + handlers).
 * @param {string[]} words
 * @param {Set<string>} roleWords
 * @param {Set<string>} shared
 * @returns {boolean}
 */
function nonRoleWordsCovered(words, roleWords, shared) {
	for (const word of words) {
		if (!roleWords.has(word) && !shared.has(word)) return false
	}
	return true
}

/**
 * The longest dash-boundary prefix shared by 3+ sibling names whose trailing
 * suffixes are majority ROLE words — the un-split domain Check D reports (a
 * domain that never became a subfolder, its role fragments doing the splitting
 * inside filenames). Returns the reported segment and its member names, or null
 * when no such cluster exists.
 *
 * Single-segment prefixes are never a signal ('on-' is structural in the v2
 * handler layout), and a cluster of distinct EVENT suffixes (add/remove/…) is the
 * correct v2 one-file-per-event layout — not a violation.
 *
 * @param {string[]} names sibling basenames without extension
 * @param {Set<string>} roleSuffixes
 * @returns {{ segment: string, group: string[] } | null}
 */
function roleCluster(names, roleSuffixes) {
	if (names.length < 3) return null
	/** @type {Map<string, string[]>} prefix -> member names */
	const clusters = new Map()
	for (const name of names) {
		const parts = name.split("-")
		for (let i = 2; i < parts.length; i++) {
			const prefix = parts.slice(0, i).join("-")
			const group = names.filter((n) => n.startsWith(prefix + "-") || n === prefix)
			if (group.length >= 3 && (clusters.get(prefix)?.length ?? 0) < group.length) clusters.set(prefix, group)
		}
	}
	// Report only the longest shared prefix (the true domain).
	const best = [...clusters.entries()].sort((a, b) => b[0].length - a[0].length)[0]
	if (!best) return null
	const [segment, group] = best
	const suffixes = new Set(group.map((n) => (n.startsWith(segment + "-") ? n.slice(segment.length + 1) : "")))
	// A cluster is an un-split entity when the majority of its suffixes are role
	// words (api/types/history/utils/…); distinct events are the correct layout.
	const roleCount = [...suffixes].filter((s) => s !== "" && roleSuffixes.has(s)).length
	if (roleCount < Math.ceil(suffixes.size / 2)) return null
	return { segment, group }
}
/**
 * Strip a leading camelCase modifier, leaving the trailing domain word:
 * 'gitUtils' → 'utils', 'gitUtilities' → 'utilities', 'runEvals' → 'evals'.
 * @param {string} base
 * @returns {string | null}
 */
function decamelizeTail(base) {
	const m = base.match(/[A-Z]([a-z]+(?:[A-Z][a-z]+)*)$/)
	return m ? m[1] : null
}

/**
 * A directory that contains its own package.json is a PACKAGE ROOT, not a
 * domain folder: build configs, entry points and tooling legitimately live
 * side by side there without an index.ts barrel. Domain checks (max files,
 * index.ts contract, duplicate sibling names) do not apply to it.
 * @param {string} dirPath
 * @returns {boolean}
 */
function isPackageRoot(dirPath) {
	return fs.existsSync(path.join(dirPath, "package.json"))
}

/**
 * Walk up from a directory to find the project root (where package.json is).
 * @param {string} startDir
 * @returns {string | null}
 */
function getProjectRoot(startDir) {
	let current = startDir
	while (current !== path.dirname(current)) {
		if (fs.existsSync(path.join(current, "package.json"))) {
			return current
		}
		current = path.dirname(current)
	}
	return null
}

/**
 * Collect all non-ignored files in a directory (non-recursive).
 * @param {string} dirPath
 * @param {string[]} ignoredFolders
 * @returns {string[]}
 */
function collectFiles(dirPath, ignoredFolders) {
	try {
		const entries = fs.readdirSync(dirPath, { withFileTypes: true })
		return entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
	} catch {
		return []
	}
}

/**
 * Collect all non-ignored directories in a directory (non-recursive).
 * @param {string} dirPath
 * @returns {string[]}
 */
function collectDirs(dirPath) {
	try {
		const entries = fs.readdirSync(dirPath, { withFileTypes: true })
		return entries
			.filter((entry) => entry.isDirectory() && !["node_modules", ".git", ".turbo", "dist"].includes(entry.name))
			.map((entry) => entry.name)
	} catch {
		return []
	}
}

export default noComplexFolderStructureRule
