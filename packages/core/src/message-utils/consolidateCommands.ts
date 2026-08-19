import type { Notification } from "@jabberwock/types"

import { safeJsonParse } from "./safeJsonParse.ts"

export const COMMAND_OUTPUT_STRING = "Output:"

/**
 * Consolidates sequences of command and command_output messages in an array of ClineMessages.
 * Also consolidates sequences of use_mcp_server and mcp_server_response messages.
 *
 * This function processes an array of ClineMessages objects, looking for sequences
 * where a 'command' message is followed by one or more 'command_output' messages,
 * or where a 'use_mcp_server' message is followed by one or more 'mcp_server_response' messages.
 * When such a sequence is found, it consolidates them into a single message, merging
 * their text contents.
 *
 * @param messages - An array of Notification objects to process.
 * @returns A new array of Notification objects with command and MCP sequences consolidated.
 *
 * @example
 * const messages: Notification[] = [
 *   { type: 'ask', ask: 'command', text: 'ls', ts: 1625097600000 },
 *   { type: 'ask', ask: 'command_output', text: 'file1.txt', ts: 1625097601000 },
 *   { type: 'ask', ask: 'command_output', text: 'file2.txt', ts: 1625097602000 }
 * ];
 * const result = consolidateCommands(messages);
 * // Result: [{ type: 'ask', ask: 'command', text: 'ls\nfile1.txt\nfile2.txt', ts: 1625097600000 }]
 */
export function consolidateCommands(messages: Notification[]): Notification[] {
	const consolidatedMessages = new Map<number, Notification>()
	const processedIndices = new Set<number>()

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		if (!msg) continue

		if (msg.type === "ask" && msg.ask === "use_mcp_server") {
			i = handleMcpServerRequest(messages, i, msg, consolidatedMessages, processedIndices)
		} else if (msg.type === "ask" && msg.ask === "command") {
			i = handleCommandSequence(messages, i, msg, consolidatedMessages, processedIndices)
		}
	}

	return buildConsolidatedResult(messages, processedIndices, consolidatedMessages)
}

function handleMcpServerRequest(
	messages: Notification[],
	startIndex: number,
	msg: Notification,
	consolidatedMessages: Map<number, Notification>,
	processedIndices: Set<number>,
): number {
	const responses: string[] = []
	let j = startIndex + 1

	while (j < messages.length) {
		const nextMsg = messages[j]
		if (!nextMsg) {
			j++
			continue
		}
		if (nextMsg.say === "mcp_server_response") {
			responses.push(nextMsg.text || "")
			processedIndices.add(j)
			j++
		} else if (nextMsg.type === "ask" && nextMsg.ask === "use_mcp_server") {
			break
		} else {
			j++
		}
	}

	if (responses.length > 0) {
		const jsonObj = safeJsonParse<Record<string, unknown>>(msg.text || "{}", {})
		if (jsonObj) {
			jsonObj.response = responses.join("\n")
			consolidatedMessages.set(msg.ts, { ...msg, text: JSON.stringify(jsonObj) })
		}
	} else {
		consolidatedMessages.set(msg.ts, { ...msg })
	}

	return startIndex
}

function handleCommandSequence(
	messages: Notification[],
	startIndex: number,
	msg: Notification,
	consolidatedMessages: Map<number, Notification>,
	processedIndices: Set<number>,
): number {
	let consolidatedText = msg.text || ""
	let j = startIndex + 1
	let previous: { type: "ask" | "say"; text: string } | undefined
	let lastProcessedIndex = startIndex

	while (j < messages.length) {
		const currentMsg = messages[j]
		if (!currentMsg) {
			j++
			continue
		}
		const { type, ask, say, text = "" } = currentMsg

		if (type === "ask" && ask === "command") {
			break
		}

		if (ask === "command_output" || say === "command_output") {
			const output = processCommandOutput(text, type, previous, consolidatedText)
			consolidatedText += output.delta
			previous = output.previous
			processedIndices.add(j)
			lastProcessedIndex = j
		}

		j++
	}

	consolidatedMessages.set(msg.ts, { ...msg, text: consolidatedText })

	return lastProcessedIndex > startIndex ? lastProcessedIndex : startIndex
}

function processCommandOutput(
	text: string,
	type: "ask" | "say",
	previous: { type: "ask" | "say"; text: string } | undefined,
	accumulatedText: string,
): { delta: string; previous: { type: "ask" | "say"; text: string } } {
	let delta = ""
	if (!previous) {
		delta += `\n${COMMAND_OUTPUT_STRING}`
	}

	const isDuplicate = previous && previous.type !== type && previous.text === text

	if (text.length > 0 && !isDuplicate) {
		if (
			previous &&
			accumulatedText.length > accumulatedText.indexOf(COMMAND_OUTPUT_STRING) + COMMAND_OUTPUT_STRING.length
		) {
			delta += "\n"
		}
		delta += text
	}

	return { delta, previous: { type, text } }
}

function buildConsolidatedResult(
	messages: Notification[],
	processedIndices: Set<number>,
	consolidatedMessages: Map<number, Notification>,
): Notification[] {
	const result: Notification[] = []
	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		if (!msg) continue

		if (processedIndices.has(i)) continue

		if (msg.ask === "command_output" || msg.say === "command_output" || msg.say === "mcp_server_response") {
			continue
		}

		const consolidatedMsg = consolidatedMessages.get(msg.ts)
		result.push(consolidatedMsg ?? msg)
	}
	return result
}
