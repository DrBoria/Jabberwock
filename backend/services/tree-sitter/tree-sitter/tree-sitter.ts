import * as fs from "fs/promises"
import * as path from "path"
import { LanguageParser, loadRequiredLanguageParsers } from "@services/tree-sitter/languageParser"
import { fileExistsAtPath } from "@utils/io/fs"
import { parseMarkdown } from "@services/tree-sitter/markdownParser"
import { validateAccess } from "@utils/ignore"
import { extensions } from "./config"
import { processCaptures } from "./parser"

export async function parseSourceCodeDefinitionsForFile(
	filePath: string,
	ignorePatterns?: string,
	cwd?: string,
): Promise<string | undefined> {
	const fileExists = await fileExistsAtPath(path.resolve(filePath))
	if (!fileExists) {
		return "This file does not exist or you do not have permission to access it."
	}

	const ext = path.extname(filePath).toLowerCase()
	if (!extensions.includes(ext)) {
		return undefined
	}

	if (ext === ".md" || ext === ".markdown") {
		if (cwd && !validateAccess(ignorePatterns, filePath, cwd)) {
			return undefined
		}

		const fileContent = await fs.readFile(filePath, "utf8")
		const lines = fileContent.split("\n")
		const markdownCaptures = parseMarkdown(fileContent)
		const markdownDefinitions = processCaptures(markdownCaptures, lines, "markdown")

		if (markdownDefinitions) {
			return `# ${path.basename(filePath)}\n${markdownDefinitions}`
		}
		return undefined
	}

	const languageParsers = await loadRequiredLanguageParsers([filePath])

	const definitions = await parseFile(filePath, languageParsers, ignorePatterns, cwd)
	if (definitions) {
		return `# ${path.basename(filePath)}\n${definitions}`
	}

	return undefined
}

async function parseFile(
	filePath: string,
	languageParsers: LanguageParser,
	ignorePatterns?: string,
	cwd?: string,
): Promise<string | null> {
	if (cwd && !validateAccess(ignorePatterns, filePath, cwd)) {
		return null
	}

	const fileContent = await fs.readFile(filePath, "utf8")
	const extLang = path.extname(filePath).toLowerCase().slice(1)

	const { parser, query } = languageParsers[extLang] || {}
	if (!parser || !query) {
		return `Unsupported file type: ${filePath}`
	}

	try {
		const tree = parser.parse(fileContent)
		const captures = tree ? query.captures(tree.rootNode) : []
		const lines = fileContent.split("\n")

		return processCaptures(captures, lines, extLang)
	} catch (error) {
		console.log(`Error parsing file: ${error}\n`)
		return null
	}
}
