/**
 * Configuration options for PromptManager.
 */
export interface PromptManagerOptions {
	/**
	 * Called before prompting to restore console output.
	 * Used to exit quiet mode temporarily.
	 */
	onBeforePrompt?: () => void

	/**
	 * Called after prompting to re-enable quiet mode.
	 */
	onAfterPrompt?: () => void

	/**
	 * Stream for input (default: process.stdin).
	 */
	stdin?: NodeJS.ReadStream

	/**
	 * Stream for prompt output (default: process.stdout).
	 */
	stdout?: NodeJS.WriteStream
}

/**
 * Result of a timed prompt.
 */
export interface TimedPromptResult {
	/** The user's input, or default if timed out */
	value: string
	/** Whether the result came from timeout */
	timedOut: boolean
	/** Whether the user cancelled (Ctrl+C) */
	cancelled: boolean
}
