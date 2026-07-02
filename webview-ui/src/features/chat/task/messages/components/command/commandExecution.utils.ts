import { COMMAND_OUTPUT_STRING } from "@shared/combineCommandSequences"

export const parseCommandAndOutput = (text: string | undefined) => {
	if (!text) return { command: "", output: "" }
	const index = text.indexOf(COMMAND_OUTPUT_STRING)
	if (index === -1) return { command: text, output: "" }
	return { command: text.slice(0, index), output: text.slice(index + COMMAND_OUTPUT_STRING.length) }
}

export const handleAllowPatternChange = (
	pattern: string,
	allowedCommands: string[],
	deniedCommands: string[],
	setAllowed: (cmds: string[]) => void,
	setDenied: (cmds: string[]) => void,
	updateSettings: (s: { allowedCommands: string[]; deniedCommands: string[] }) => void,
) => {
	const isAllowed = allowedCommands.includes(pattern)
	const newAllowed = isAllowed ? allowedCommands.filter((p) => p !== pattern) : [...allowedCommands, pattern]
	const newDenied = deniedCommands.filter((p) => p !== pattern)
	setAllowed(newAllowed)
	setDenied(newDenied)
	updateSettings({ allowedCommands: newAllowed, deniedCommands: newDenied })
}

export const handleDenyPatternChange = (
	pattern: string,
	allowedCommands: string[],
	deniedCommands: string[],
	setAllowed: (cmds: string[]) => void,
	setDenied: (cmds: string[]) => void,
	updateSettings: (s: { allowedCommands: string[]; deniedCommands: string[] }) => void,
) => {
	const isDenied = deniedCommands.includes(pattern)
	const newDenied = isDenied ? deniedCommands.filter((p) => p !== pattern) : [...deniedCommands, pattern]
	const newAllowed = allowedCommands.filter((p) => p !== pattern)
	setAllowed(newAllowed)
	setDenied(newDenied)
	updateSettings({ allowedCommands: newAllowed, deniedCommands: newDenied })
}
