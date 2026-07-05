import { mentionRegexGlobal, commandRegexGlobal } from "@shared/context/mentions"

import { getCommand, type Command } from "@services/command/commands"
import { buildSkillResult, resolveSkillContentForMode, type SkillLookup } from "@services/skills/skillInvocation"
import type { SkillContent } from "@shared/skills"

type CommandExistenceResult = {
	commandName: string
	command: Command | undefined
	skillContent: SkillContent | null
}[]

export async function checkCommandExistence(
	text: string,
	cwd: string,
	skillsManager: SkillLookup | undefined,
	currentMode: string,
): Promise<{
	commandMatches: RegExpExecArray[]
	validCommands: Map<string, Command>
	validSkills: Map<string, SkillContent>
	commandMode: string | undefined
}> {
	const commandMatches = Array.from(text.matchAll(commandRegexGlobal))
	const uniqueCommandNames = [...new Set(commandMatches.map(([, commandName]) => commandName))]

	const existenceResults: CommandExistenceResult = await Promise.all(
		uniqueCommandNames.map(async (commandName) => {
			try {
				const command = await getCommand(cwd, commandName)
				if (command) {
					return { commandName, command, skillContent: null }
				}

				const skillContent = await resolveSkillContentForMode(skillsManager, commandName, currentMode)
				return { commandName, command: undefined, skillContent }
			} catch (_error) {
				return { commandName, command: undefined, skillContent: null }
			}
		}),
	)

	const validCommands = new Map<string, Command>()
	const validSkills = new Map<string, SkillContent>()
	let commandMode: string | undefined

	for (const { commandName, command, skillContent } of existenceResults) {
		if (command) {
			validCommands.set(commandName, command)
			if (!commandMode && command.mode) {
				commandMode = command.mode
			}
			continue
		}

		if (skillContent) {
			validSkills.set(commandName, skillContent)
		}
	}

	return { commandMatches, validCommands, validSkills, commandMode }
}

export function replaceCommandMentions(
	text: string,
	commandMatches: RegExpExecArray[],
	validCommands: Map<string, Command>,
	validSkills: Map<string, SkillContent>,
): string {
	let result = text
	for (const [match, commandName] of commandMatches) {
		if (validCommands.has(commandName) || validSkills.has(commandName)) {
			result = result.replace(match, `Command '${commandName}' (see below for command content)`)
		}
	}
	return result
}

export function replaceMentionReferences(text: string, mentions: Set<string>): string {
	return text.replace(mentionRegexGlobal, (_match, mention) => {
		mentions.add(mention)
		if (mention.startsWith("http")) {
			return `'${mention}'`
		}
		if (mention.startsWith("/")) {
			const mentionPath = mention.slice(1)
			return mentionPath.endsWith("/") ? `'${mentionPath}'` : `'${mentionPath}'`
		}
		if (mention === "problems") {
			return `Workspace Problems (see below for diagnostics)`
		}
		if (mention === "git-changes") {
			return `Working directory changes (see below for details)`
		}
		if (/^[a-f0-9]{7,40}$/.test(mention)) {
			return `Git commit '${mention}' (see below for commit info)`
		}
		if (mention === "terminal") {
			return `Terminal Output (see below for output)`
		}
		return _match
	})
}

export function buildSlashCommandHelp(
	validCommands: Map<string, Command>,
	validSkills: Map<string, SkillContent>,
): string {
	let help = ""
	for (const [commandName, command] of validCommands) {
		try {
			let commandOutput = ""
			if (command.description) {
				commandOutput += `Description: ${command.description}\n\n`
			}
			commandOutput += command.content
			help += `\n\n<command name="${commandName}">\n${commandOutput}\n</command>`
		} catch (_error) {
			const errMsg = _error instanceof Error ? _error.message : String(_error)
			help += `\n\n<command name="${commandName}">\nError loading command '${commandName}': ${errMsg}\n</command>`
		}
	}

	for (const [skillName, skillContent] of validSkills) {
		help += `\n\n${buildSkillResult(skillName, undefined, skillContent)}`
	}

	return help.trim()
}
