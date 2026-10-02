/**
 * PromptManager - Handles all user input collection
 *
 * This manager is responsible for:
 * - Collecting user input via readline
 * - Yes/No prompts with proper defaults
 * - Delegates timed prompts to the timeout-prompt module
 *
 * Design notes:
 * - Single responsibility: User input only (no output formatting)
 * - Returns Promises for all input operations
 * - Handles console mode switching (quiet mode restore)
 * - Can be disabled for programmatic (non-interactive) use
 */

import readline from "readline"

import type { PromptManagerOptions, TimedPromptResult } from "./types.js"
import {
	promptWithTimeout as timedPromptWithTimeout,
	promptForYesNoWithTimeout as timeoutYesNo,
} from "./timeout-prompt.js"

export function createPromptManager(options: PromptManagerOptions = {}) {
	const onBeforePrompt = options.onBeforePrompt
	const onAfterPrompt = options.onAfterPrompt
	const stdin = options.stdin ?? (process.stdin as NodeJS.ReadStream)
	const stdout = options.stdout ?? process.stdout

	/**
	 * Track if a prompt is currently active.
	 */
	let isPrompting = false

	/**
	 * Check if a prompt is currently active.
	 */
	function isActive(): boolean {
		return isPrompting
	}

	/**
	 * Prompt for text input using readline.
	 *
	 * @param prompt - The prompt text to display
	 * @returns The user's input
	 * @throws If input is cancelled or an error occurs
	 */
	async function promptForInput(prompt: string): Promise<string> {
		return new Promise((resolve, reject) => {
			beforePrompt()
			isPrompting = true

			const rl = readline.createInterface({
				input: stdin,
				output: stdout,
			})

			rl.question(prompt, (answer) => {
				rl.close()
				isPrompting = false
				afterPrompt()
				resolve(answer)
			})

			rl.on("close", () => {
				isPrompting = false
				afterPrompt()
			})

			rl.on("error", (err) => {
				rl.close()
				isPrompting = false
				afterPrompt()
				reject(err)
			})
		})
	}

	/**
	 * Prompt for yes/no input.
	 *
	 * @param prompt - The prompt text to display
	 * @param defaultValue - Default value if empty input (default: false)
	 * @returns true for yes, false for no
	 */
	async function promptForYesNo(prompt: string, defaultValue = false): Promise<boolean> {
		const answer = await promptForInput(prompt)
		const normalized = answer.trim().toLowerCase()
		if (normalized === "" && defaultValue !== undefined) {
			return defaultValue
		}
		return normalized === "y" || normalized === "yes"
	}

	/**
	 * Prompt for input with a timeout.
	 * Uses raw mode for character-by-character input handling.
	 *
	 * @param prompt - The prompt text to display
	 * @param timeoutMs - Timeout in milliseconds
	 * @param defaultValue - Value to use if timed out
	 * @returns TimedPromptResult with value, timedOut flag, and cancelled flag
	 */
	async function promptWithTimeout(
		prompt: string,
		timeoutMs: number,
		defaultValue: string,
	): Promise<TimedPromptResult> {
		isPrompting = true
		const result = await timedPromptWithTimeout(
			stdin,
			stdout,
			prompt,
			timeoutMs,
			defaultValue,
			() => beforePrompt(),
			() => afterPrompt(),
		)
		isPrompting = false
		return result
	}

	/**
	 * Prompt for yes/no with timeout.
	 *
	 * @param prompt - The prompt text to display
	 * @param timeoutMs - Timeout in milliseconds
	 * @param defaultValue - Default boolean value if timed out
	 * @returns true for yes, false for no
	 */
	async function promptForYesNoWithTimeout(
		prompt: string,
		timeoutMs: number,
		defaultValue: boolean,
	): Promise<boolean> {
		return timeoutYesNo(
			stdin,
			stdout,
			prompt,
			timeoutMs,
			defaultValue,
			() => beforePrompt(),
			() => afterPrompt(),
		)
	}

	/**
	 * Display a message on stdout (utility for prompting context).
	 */
	function write(text: string): void {
		stdout.write(text)
	}

	/**
	 * Display a message with newline.
	 */
	function writeLine(text: string): void {
		stdout.write(text + "\n")
	}

	function beforePrompt(): void {
		if (onBeforePrompt) {
			onBeforePrompt()
		}
	}

	function afterPrompt(): void {
		if (onAfterPrompt) {
			onAfterPrompt()
		}
	}

	return { isActive, promptForInput, promptForYesNo, promptWithTimeout, promptForYesNoWithTimeout, write, writeLine }
}

/** PromptManager instance type */
export type PromptManager = ReturnType<typeof createPromptManager>
