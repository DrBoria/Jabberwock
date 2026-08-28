import * as vscode from "vscode"
import { extractTextCountFromMessage } from "./vscode-lm-format"

/**
 * Creates or reuses a cancellation token for token counting operations.
 */
export function getTokenCountCancellationToken(currentRequestCancellation: vscode.CancellationTokenSource | null): {
	token: vscode.CancellationToken
	source: vscode.CancellationTokenSource | null
} {
	if (currentRequestCancellation) {
		return { token: currentRequestCancellation.token, source: null }
	}
	const source = new vscode.CancellationTokenSource()
	return { token: source.token, source }
}

/**
 * Validates the result of a token count operation.
 * Returns the validated count or null if invalid.
 */
export function validateTokenCountResult(tokenCount: number): number | null {
	if (typeof tokenCount !== "number") {
		console.warn("[jabberwock] Jabberwock <Language Model API>: Non-numeric token count received:", tokenCount)
		return null
	}

	if (tokenCount < 0) {
		console.warn("[jabberwock] Jabberwock <Language Model API>: Negative token count received:", tokenCount)
		return null
	}

	return tokenCount
}

/**
 * Handles errors during token counting, returning a fallback value.
 */
export function handleTokenCountError(error: unknown): number {
	if (error instanceof vscode.CancellationError) {
		console.debug("Jabberwock <Language Model API>: Token counting cancelled by user")
		return 0
	}

	const errorMessage = error instanceof Error ? error.message : "Unknown error"
	console.warn("[jabberwock] Jabberwock <Language Model API>: Token counting failed:", errorMessage)

	if (error instanceof Error && error.stack) {
		console.debug("Token counting error stack:", error.stack)
	}

	return 0
}

/**
 * Counts tokens for a VSCode LanguageModelChatMessage.
 */
export async function countMessageTokens(
	client: vscode.LanguageModelChat,
	text: vscode.LanguageModelChatMessage,
	cancellationToken: vscode.CancellationToken,
): Promise<number> {
	if (!text.content || (Array.isArray(text.content) && text.content.length === 0)) {
		console.debug("Jabberwock <Language Model API>: Empty chat message content")
		return 0
	}
	const countMessage = extractTextCountFromMessage(text)
	return client.countTokens(countMessage, cancellationToken)
}

/**
 * Internal token counting implementation that handles string and message inputs.
 */
export async function internalCountTokens(
	client: vscode.LanguageModelChat | null,
	text: string | vscode.LanguageModelChatMessage,
	currentRequestCancellation: vscode.CancellationTokenSource | null,
): Promise<number> {
	if (!client) {
		console.warn("[jabberwock] Jabberwock <Language Model API>: No client available for token counting")
		return 0
	}

	if (!text) {
		console.debug("Jabberwock <Language Model API>: Empty text provided for token counting")
		return 0
	}

	const { token: cancellationToken, source: tempCancellation } =
		getTokenCountCancellationToken(currentRequestCancellation)

	try {
		const tokenCount =
			typeof text === "string"
				? await client.countTokens(text, cancellationToken)
				: await countMessageTokens(client, text, cancellationToken)

		const validated = validateTokenCountResult(tokenCount)
		if (validated !== null) {
			return validated
		}

		return 0
	} catch (error) {
		return handleTokenCountError(error)
	} finally {
		if (tempCancellation) {
			tempCancellation.dispose()
		}
	}
}

/**
 * Calculates total input tokens for an array of VSCode LM messages.
 */
export async function calculateTotalInputTokens(
	client: vscode.LanguageModelChat | null,
	vsCodeLmMessages: vscode.LanguageModelChatMessage[],
	currentRequestCancellation: vscode.CancellationTokenSource | null,
): Promise<number> {
	const messageTokens: number[] = await Promise.all(
		vsCodeLmMessages.map((msg) => internalCountTokens(client, msg, currentRequestCancellation)),
	)

	return messageTokens.reduce((sum: number, tokens: number): number => sum + tokens, 0)
}

/**
 * Recursively cleans message content by removing null/undefined values and normalizing data.
 */
export function cleanMessageContent(content: unknown): unknown {
	if (!content) {
		return content
	}

	if (typeof content === "string") {
		return content
	}

	if (Array.isArray(content)) {
		return content.map((item) => cleanMessageContent(item))
	}

	if (typeof content === "object") {
		const cleaned: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(content)) {
			cleaned[key] = cleanMessageContent(value)
		}
		return cleaned
	}

	return content
}
