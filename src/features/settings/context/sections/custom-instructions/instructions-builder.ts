import path from "path"

import { isLanguage } from "@jabberwock/types"

import type { SystemPromptSettings } from "@features/settings/context/types"

import { LANGUAGES } from "@shared/language"
import { getRooDirectoriesForCwd, getAllRooDirectoriesForCwd } from "@services/jabberwock-config"

import { loadModeRules } from "./rules-loader"
import { loadAllAgentRulesFiles } from "./agent-rules"
import { safeReadFile, directoryExists, readTextFilesFromDirectory, formatDirectoryContent } from "./utils"

function addLanguageSection(sections: string[], language?: string): void {
	if (!language) {
		return
	}

	const languageName = isLanguage(language) ? LANGUAGES[language] : language
	sections.push(
		`Language Preference:\nYou should always speak and think in the "${languageName}" (${language}) language unless the user gives you instructions below to do otherwise.`,
	)
}

function addGlobalInstructionsSection(sections: string[], globalCustomInstructions: string): void {
	if (typeof globalCustomInstructions === "string" && globalCustomInstructions.trim()) {
		sections.push(`Global Instructions:\n${globalCustomInstructions.trim()}`)
	}
}

function addModeInstructionsSection(sections: string[], modeCustomInstructions: string): void {
	if (typeof modeCustomInstructions === "string" && modeCustomInstructions.trim()) {
		sections.push(`Mode-specific Instructions:\n${modeCustomInstructions.trim()}`)
	}
}

function addModeRuleToRules(rules: string[], modeRuleContent: string, usedRuleFile: string, mode: string): void {
	const trimmedContent = modeRuleContent?.trim()
	if (!trimmedContent) return

	if (usedRuleFile.includes(path.join(".jabberwock", `rules-${mode}`))) {
		rules.push(trimmedContent)
	} else {
		rules.push(`# Rules from ${usedRuleFile}:\n${modeRuleContent}`)
	}
}

async function buildRulesList(
	modeRuleContent: string,
	usedRuleFile: string,
	mode: string,
	options: {
		jabberwockIgnoreInstructions?: string
		language?: string
		settings?: SystemPromptSettings
	},
	cwd: string,
	enableSubfolderRules: boolean,
): Promise<string[]> {
	const rules: string[] = []

	addModeRuleToRules(rules, modeRuleContent, usedRuleFile, mode)

	if (options.jabberwockIgnoreInstructions) {
		rules.push(options.jabberwockIgnoreInstructions)
	}

	if (options.settings?.useAgentRules !== false) {
		const agentRulesContent = await loadAllAgentRulesFiles(cwd, enableSubfolderRules)
		if (agentRulesContent && agentRulesContent.trim()) {
			rules.push(agentRulesContent.trim())
		}
	}

	const genericRuleContent = await loadRuleFiles(cwd, enableSubfolderRules)
	if (genericRuleContent && genericRuleContent.trim()) {
		rules.push(genericRuleContent.trim())
	}

	return rules
}

/**
 * Load rule files from global, project-local, and optionally subfolder directories.
 * Rules are loaded in order: global first, then project-local, then subfolders (alphabetically)
 */
export async function loadRuleFiles(cwd: string, enableSubfolderRules: boolean = false): Promise<string> {
	const rules: string[] = []
	const rooDirectories = enableSubfolderRules ? await getAllRooDirectoriesForCwd(cwd) : getRooDirectoriesForCwd(cwd)

	for (const rooDir of rooDirectories) {
		const rulesDir = path.join(rooDir, "rules")
		if (await directoryExists(rulesDir)) {
			const files = await readTextFilesFromDirectory(rulesDir)
			if (files.length > 0) {
				const content = formatDirectoryContent(files, cwd)
				rules.push(content)
			}
		}
	}

	if (rules.length > 0) {
		return "\n# Rules from .jabberwock directories:\n\n" + rules.join("\n\n")
	}

	const ruleFiles = [".jabberwockrules", ".clinerules"]

	for (const file of ruleFiles) {
		const content = await safeReadFile(path.join(cwd, file))
		if (content) {
			return `\n# Rules from ${file}:\n${content}\n`
		}
	}

	return ""
}

export async function addCustomInstructions(
	modeCustomInstructions: string,
	globalCustomInstructions: string,
	cwd: string,
	mode: string,
	options: {
		language?: string
		jabberwockIgnoreInstructions?: string
		settings?: SystemPromptSettings
	} = {},
): Promise<string> {
	const sections: string[] = []
	const enableSubfolderRules = options.settings?.enableSubfolderRules ?? false

	const { modeRuleContent, usedRuleFile } = await loadModeRules(mode, cwd, enableSubfolderRules)

	addLanguageSection(sections, options.language)
	addGlobalInstructionsSection(sections, globalCustomInstructions)
	addModeInstructionsSection(sections, modeCustomInstructions)

	const rules = await buildRulesList(modeRuleContent, usedRuleFile, mode, options, cwd, enableSubfolderRules)
	if (rules.length > 0) {
		sections.push(`Rules:\n\n${rules.join("\n\n")}`)
	}

	const joinedSections = sections.join("\n\n")

	return joinedSections
		? `\n====\n\nUSER'S CUSTOM INSTRUCTIONS\n\nThe following additional instructions are provided by the user, and should be followed to the best of your ability.\n\n${joinedSections}\n`
		: ""
}
