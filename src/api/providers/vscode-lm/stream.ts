import * as vscode from "vscode"

import type { ApiHandlerCreateMessageMetadata } from "@api/index"

/**
 * Processes a text chunk from VSCode Language Model response stream.
 * Yields text chunks as they arrive and accumulates the full text.
 */
export function* processVscodeTextPart(
	chunk: vscode.LanguageModelTextPart,
	accumulatedText: string,
): Generator<{ type: "text"; text: string }, string> {
	if (typeof chunk.value !== "string") {
		console.warn("[jabberwock] Jabberwock <Language Model API>: Invalid text part value received:", chunk.value)
		return accumulatedText
	}

	yield { type: "text", text: chunk.value }
	return accumulatedText + chunk.value
}

/**
 * Processes a tool call chunk from VSCode Language Model response stream.
 * Yields tool call data when metadata includes tools configuration.
 */
export function* processVscodeToolCallPart(
	chunk: vscode.LanguageModelToolCallPart,
	metadata: ApiHandlerCreateMessageMetadata | undefined,
): Generator<{ type: "tool_call"; id: string; name: string; arguments: string }, void> {
	if (!chunk.name || typeof chunk.name !== "string") {
		console.warn("[jabberwock] Jabberwock <Language Model API>: Invalid tool name received:", chunk.name)
		return
	}

	if (!chunk.callId || typeof chunk.callId !== "string") {
		console.warn("[jabberwock] Jabberwock <Language Model API>: Invalid tool callId received:", chunk.callId)
		return
	}

	if (!chunk.input || typeof chunk.input !== "object") {
		console.warn("[jabberwock] Jabberwock <Language Model API>: Invalid tool input received:", chunk.input)
		return
	}

	if (metadata?.tools?.length) {
		const argumentsString = JSON.stringify(chunk.input)
		yield {
			type: "tool_call",
			id: chunk.callId,
			name: chunk.name,
			arguments: argumentsString,
		}
	}
}

/**
 * Processes the VSCode Language Model response stream.
 * Iterates over response chunks, delegating text and tool call parts to specialized handlers.
 */
export async function* processVscodeLmStream(
	response: vscode.LanguageModelChatResponse,
	metadata: ApiHandlerCreateMessageMetadata | undefined,
): AsyncGenerator<
	{ type: "text"; text: string } | { type: "tool_call"; id: string; name: string; arguments: string },
	string
> {
	let accumulatedText = ""

	for await (const chunk of response.stream) {
		if (chunk instanceof vscode.LanguageModelTextPart) {
			const result = yield* processVscodeTextPart(chunk, accumulatedText)
			accumulatedText = result
		} else if (chunk instanceof vscode.LanguageModelToolCallPart) {
			try {
				yield* processVscodeToolCallPart(chunk, metadata)
			} catch (error) {
				console.error("[jabberwock] Jabberwock <Language Model API>: Failed to process tool call:", error)
			}
		} else {
			console.warn("[jabberwock] Jabberwock <Language Model API>: Unknown chunk type received:", chunk)
		}
	}

	return accumulatedText
}

/**
 * Handles errors that occur during VSCode Language Model stream processing.
 * Provides detailed error logging and re-throws with appropriate messages.
 */
export function handleVscodeLmStreamError(error: unknown): never {
	if (error instanceof vscode.CancellationError) {
		throw new Error("Jabberwock <Language Model API>: Request cancelled by user")
	}

	if (error instanceof Error) {
		console.error("[jabberwock] Jabberwock <Language Model API>: Stream error details:", {
			message: error.message,
			stack: error.stack,
			name: error.name,
		})
		throw error
	}

	if (typeof error === "object" && error !== null) {
		const errorDetails = JSON.stringify(error, null, 2)
		console.error("[jabberwock] Jabberwock <Language Model API>: Stream error object:", errorDetails)
		throw new Error(`Jabberwock <Language Model API>: Response stream error: ${errorDetails}`)
	}

	const errorMessage = String(error)
	console.error("[jabberwock] Jabberwock <Language Model API>: Unknown stream error:", errorMessage)
	throw new Error(`Jabberwock <Language Model API>: Response stream error: ${errorMessage}`)
}
