import { createInterface } from "readline"

import { isRecord } from "@/lib/utils/validation/guards.js"
import { isValidSessionId } from "@/lib/utils/validation/session-id.js"

import type { RooCliStartCommand } from "@jabberwock/types"
import type { StdinStreamCommand, StdinStreamCommandName } from "./types.js"
import { VALID_STDIN_COMMANDS } from "./types.js"

function validateCommonFields(
	parsed: Record<string, unknown>,
	lineNumber: number,
): { command: StdinStreamCommandName; requestId: string } {
	const commandRaw = parsed.command
	const requestIdRaw = parsed.requestId
	if (typeof commandRaw !== "string") throw new Error(`stdin command line ${lineNumber}: missing string "command"`)
	if (!VALID_STDIN_COMMANDS.has(commandRaw as StdinStreamCommandName))
		throw new Error(
			`stdin command line ${lineNumber}: unsupported command "${commandRaw}" (expected start|message|cancel|ping|shutdown)`,
		)
	if (typeof requestIdRaw !== "string" || requestIdRaw.trim().length === 0)
		throw new Error(`stdin command line ${lineNumber}: missing non-empty string "requestId"`)
	return { command: commandRaw as StdinStreamCommandName, requestId: requestIdRaw.trim() }
}

function parsePromptInput(
	parsed: Record<string, unknown>,
	command: string,
	lineNumber: number,
): { prompt: string; images: string[] | undefined } {
	const promptRaw = parsed.prompt
	if (typeof promptRaw !== "string" || promptRaw.trim().length === 0)
		throw new Error(`stdin command line ${lineNumber}: "${command}" requires non-empty string "prompt"`)
	const imagesRaw = parsed.images
	if (imagesRaw === undefined) return { prompt: promptRaw, images: undefined }
	if (!Array.isArray(imagesRaw) || !imagesRaw.every((image) => typeof image === "string"))
		throw new Error(`stdin command line ${lineNumber}: "${command}" images must be an array of strings`)
	return { prompt: promptRaw, images: imagesRaw }
}

function parseStartPayload(parsed: Record<string, unknown>, requestId: string, lineNumber: number): StdinStreamCommand {
	const { prompt, images } = parsePromptInput(parsed, "start", lineNumber)
	const taskIdRaw = parsed.taskId
	let taskId: string | undefined
	if (taskIdRaw !== undefined) {
		if (typeof taskIdRaw !== "string" || taskIdRaw.trim().length === 0)
			throw new Error(`stdin command line ${lineNumber}: "start" taskId must be a non-empty string`)
		taskId = taskIdRaw.trim()
		if (!isValidSessionId(taskId))
			throw new Error(`stdin command line ${lineNumber}: "start" taskId must be a valid UUID`)
	}
	if (isRecord(parsed.configuration))
		return {
			command: "start",
			requestId,
			prompt,
			...(taskId !== undefined ? { taskId } : {}),
			...(images !== undefined ? { images } : {}),
			configuration: parsed.configuration as RooCliStartCommand["configuration"],
		}
	return {
		command: "start",
		requestId,
		prompt,
		...(taskId !== undefined ? { taskId } : {}),
		...(images !== undefined ? { images } : {}),
	}
}

function parseMessagePayload(
	parsed: Record<string, unknown>,
	requestId: string,
	lineNumber: number,
): StdinStreamCommand {
	const { prompt, images } = parsePromptInput(parsed, "message", lineNumber)
	return { command: "message", requestId, prompt, ...(images !== undefined ? { images } : {}) }
}

export function parseStdinStreamCommand(line: string, lineNumber: number): StdinStreamCommand {
	let parsed: unknown
	try {
		parsed = JSON.parse(line)
	} catch {
		throw new Error(`stdin command line ${lineNumber}: invalid JSON`)
	}
	if (!isRecord(parsed)) throw new Error(`stdin command line ${lineNumber}: expected JSON object`)
	const { command, requestId } = validateCommonFields(parsed, lineNumber)
	if (command === "start") return parseStartPayload(parsed, requestId, lineNumber)
	if (command === "message") return parseMessagePayload(parsed, requestId, lineNumber)
	return { command, requestId }
}

export async function* readCommandsFromStdinNdjson(): AsyncGenerator<StdinStreamCommand> {
	const lineReader = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false })
	let lineNumber = 0
	try {
		for await (const line of lineReader) {
			lineNumber += 1
			const trimmed = line.trim()
			if (!trimmed) continue
			yield parseStdinStreamCommand(trimmed, lineNumber)
		}
	} finally {
		lineReader.close()
	}
}
