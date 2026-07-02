import fs from "node:fs"
import path from "node:path"

/** @type {import("eslint").Rule.RuleModule} */
const noComplexFolderStructureRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce folder structure constraints: max files per folder, no folder name in filename, no duplicate basename prefix.",
		},
		schema: [
			{
				type: "object",
				properties: {
					maxFilesPerFolder: { type: "number", default: 7 },
					noFolderNameInFilename: { type: "boolean", default: true },
					noDuplicateBasenamePrefix: { type: "boolean", default: true },
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
				"Folder '{{folder}}' has {{count}} files (max {{max}}). Consider reorganizing into subdirectories.",
			noFolderNameInFilename:
				"Filename '{{filename}}' contains parent folder name '{{folder}}'. Rename to remove the redundant prefix.",
			noDuplicateBasenamePrefix:
				"File '{{duplicate}}' duplicates basename prefix of '{{base}}'. Move to subfolder '{{base}}/' or rename.",
		},
	},
	create(context) {
		const options = context.options[0] || {}
		const maxFilesPerFolder = options.maxFilesPerFolder ?? 7
		const noFolderNameInFilename = options.noFolderNameInFilename ?? true
		const noDuplicateBasenamePrefix = options.noDuplicateBasenamePrefix ?? true
		const ignoredFolders = options.ignoredFolders ?? ["node_modules", ".turbo", "dist", ".git"]
		const ignoredFiles = options.ignoredFiles ?? ["index.ts", "index.tsx", "index.js", "README.md"]
		const includes = options.includes ?? []

		/**
		 * Check if a filename matches any ignored file pattern (simple name match).
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

				// Check A: maxFilesPerFolder — only report at the file's directory
				if (maxFilesPerFolder > 0) {
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

				// Check B: noFolderNameInFilename
				if (noFolderNameInFilename) {
					const basename = path.basename(filename)
					const basenameNoExt = getBasenameWithoutExt(basename)
					const parentFolderName = path.basename(dirname)

					// Skip test files, store.ts, store.tsx, index.ts, index.tsx
					if (
						!isTestFile(basename) &&
						basename !== "store.ts" &&
						basename !== "store.tsx" &&
						basename !== "index.ts" &&
						basename !== "index.tsx" &&
						basenameNoExt.startsWith(parentFolderName + "-")
					) {
						context.report({
							node: context.sourceCode.ast,
							messageId: "noFolderNameInFilename",
							data: {
								filename: basename,
								folder: parentFolderName,
							},
						})
					}
				}

				// Check C: noDuplicateBasenamePrefix
				if (noDuplicateBasenamePrefix) {
					const filesInDir = collectFiles(dirname, ignoredFolders)
					/** @type {Map<string, string[]>} */
					const basenameMap = new Map()

					for (const file of filesInDir) {
						if (isTestFile(file)) continue
						if (file === "index.ts" || file === "index.tsx" || file === "store.ts" || file === "store.tsx")
							continue
						if (!isIncluded(file)) continue

						const baseNoExt = getBasenameWithoutExt(file)
						let reported = false

						// Check if this file's basename starts with another file's basename + "-"
						for (const [existingBase, existingFiles] of basenameMap) {
							if (
								baseNoExt.startsWith(existingBase + "-") &&
								!existingFiles.some((ef) => ef.startsWith(baseNoExt + "-"))
							) {
								// Only report on the FIRST level of duplication
								context.report({
									node: context.sourceCode.ast,
									messageId: "noDuplicateBasenamePrefix",
									data: {
										duplicate: file,
										base: existingFiles[0],
									},
								})
								reported = true
								break
							}
						}

						if (!reported) {
							if (!basenameMap.has(baseNoExt)) {
								basenameMap.set(baseNoExt, [])
							}
							basenameMap.get(baseNoExt).push(file)
						}
					}
				}
			},
		}
	},
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

export default noComplexFolderStructureRule
