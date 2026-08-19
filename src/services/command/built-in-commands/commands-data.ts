import { INIT_COMMAND_PART1 } from "./init-command-p1"
import { INIT_COMMAND_PART2 } from "./init-command-p2"

export interface BuiltInCommandDefinition {
	name: string
	description: string
	argumentHint?: string
	content: string
}

const INIT_COMMAND_CONTENT = `${INIT_COMMAND_PART1}${INIT_COMMAND_PART2}`

export const BUILT_IN_COMMANDS: Record<string, BuiltInCommandDefinition> = {
	init: {
		name: "init",
		description: "Analyze codebase and create concise AGENTS.md files for AI assistants",
		content: INIT_COMMAND_CONTENT,
	},
}
