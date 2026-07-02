import path from "path"

import { getRooDirectoriesForCwd, getAllRooDirectoriesForCwd } from "@services/jabberwock-config"

import { safeReadFile, directoryExists, readTextFilesFromDirectory, formatDirectoryContent } from "./utils"

export interface ModeRulesResult {
	modeRuleContent: string
	usedRuleFile: string
}

export async function loadModeRules(
	mode: string,
	cwd: string,
	enableSubfolderRules: boolean,
): Promise<ModeRulesResult> {
	if (!mode) {
		return { modeRuleContent: "", usedRuleFile: "" }
	}

	const modeRules: string[] = []
	const rooDirectories = enableSubfolderRules ? await getAllRooDirectoriesForCwd(cwd) : getRooDirectoriesForCwd(cwd)

	for (const rooDir of rooDirectories) {
		const modeRulesDir = path.join(rooDir, `rules-${mode}`)
		if (await directoryExists(modeRulesDir)) {
			const files = await readTextFilesFromDirectory(modeRulesDir)
			if (files.length > 0) {
				modeRules.push(formatDirectoryContent(files, cwd))
			}
		}
	}

	if (modeRules.length > 0) {
		return { modeRuleContent: "\n" + modeRules.join("\n\n"), usedRuleFile: `rules-${mode} directories` }
	}

	const rooModeRuleFile = `.jabberwockrules-${mode}`
	const rooContent = await safeReadFile(path.join(cwd, rooModeRuleFile))
	if (rooContent) {
		return { modeRuleContent: rooContent, usedRuleFile: rooModeRuleFile }
	}

	const clineModeRuleFile = `.clinerules-${mode}`
	const clineContent = await safeReadFile(path.join(cwd, clineModeRuleFile))
	if (clineContent) {
		return { modeRuleContent: clineContent, usedRuleFile: clineModeRuleFile }
	}

	return { modeRuleContent: "", usedRuleFile: "" }
}
