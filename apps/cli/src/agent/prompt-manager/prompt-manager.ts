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
import { promptWithTimeout, promptForYesNoWithTimeout as timeoutYesNo } from "./timeout-prompt.js"

export class PromptManager {
	private onBeforePrompt?: () => void
	private onAfterPrompt?: () => void
	private stdin: NodeJS.ReadStream
	private stdout: NodeJS.WriteStream

	/**
	 * Track if a prompt is currently active.
	 */
	private isPrompting = false

	constructor(options: PromptManagerOptions = {}) {
		this.onBeforePrompt = options.onBeforePrompt
		this.onAfterPrompt = options.onAfterPrompt
		this.stdin = options.stdin ?? (process.stdin as NodeJS.ReadStream)
		this.stdout = options.stdout ?? process.stdout
	}

	/**
	 * Check if a prompt is currently active.
	 */
	isActive(): boolean {
		return this.isPrompting
	}

	/**
	 * Prompt for text input using readline.
	 *
	 * @param prompt - The prompt text to display
	 * @returns The user's input
	 * @throws If input is cancelled or an error occurs
	 */
	async promptForInput(prompt: string): Promise<string> {
		return new Promise((resolve, reject) => {
			this.beforePrompt()
			this.isPrompting = true

			const rl = readline.createInterface({
				input: this.stdin,
				output: this.stdout,
			})

			rl.question(prompt, (answer) => {
				rl.close()
				this.isPrompting = false
				this.afterPrompt()
				resolve(answer)
			})

			rl.on("close", () => {
				this.isPrompting = false
				this.afterPrompt()
			})

			rl.on("error", (err) => {
				rl.close()
				this.isPrompting = false
				this.afterPrompt()
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
	async promptForYesNo(prompt: string, defaultValue = false): Promise<boolean> {
		const answer = await this.promptForInput(prompt)
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
	async promptWithTimeout(prompt: string, timeoutMs: number, defaultValue: string): Promise<TimedPromptResult> {
		this.isPrompting = true
		const result = await promptWithTimeout(
			this.stdin,
			this.stdout,
			prompt,
			timeoutMs,
			defaultValue,
			() => this.beforePrompt(),
			() => this.afterPrompt(),
		)
		this.isPrompting = false
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
	async promptForYesNoWithTimeout(prompt: string, timeoutMs: number, defaultValue: boolean): Promise<boolean> {
		return timeoutYesNo(
			this.stdin,
			this.stdout,
			prompt,
			timeoutMs,
			defaultValue,
			() => this.beforePrompt(),
			() => this.afterPrompt(),
		)
	}

	/**
	 * Display a message on stdout (utility for prompting context).
	 */
	write(text: string): void {
		this.stdout.write(text)
	}

	/**
	 * Display a message with newline.
	 */
	writeLine(text: string): void {
		this.stdout.write(text + "\n")
	}

	private beforePrompt(): void {
		if (this.onBeforePrompt) {
			this.onBeforePrompt()
		}
	}

	private afterPrompt(): void {
		if (this.onAfterPrompt) {
			this.onAfterPrompt()
		}
	}
}
