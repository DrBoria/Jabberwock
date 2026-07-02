import type { TimedPromptResult } from "./types.js"

/**
 * Prompt for input with a timeout using raw mode.
 *
 * @param stdin - The input stream
 * @param stdout - The output stream
 * @param prompt - The prompt text to display
 * @param timeoutMs - Timeout in milliseconds
 * @param defaultValue - Value to use if timed out
 * @param onBeforePrompt - Called before prompting
 * @param onAfterPrompt - Called after prompting
 * @returns TimedPromptResult with value, timedOut flag, and cancelled flag
 */
export function promptWithTimeout(
	stdin: NodeJS.ReadStream,
	stdout: NodeJS.WriteStream,
	prompt: string,
	timeoutMs: number,
	defaultValue: string,
	onBeforePrompt: () => void,
	onAfterPrompt: () => void,
): Promise<TimedPromptResult> {
	return new Promise((resolve) => {
		onBeforePrompt()

		// Track the original raw mode state to restore it later
		const wasRaw = stdin.isRaw

		// Enable raw mode for character-by-character input if TTY
		if (stdin.isTTY) {
			stdin.setRawMode(true)
		}

		stdin.resume()

		let inputBuffer = ""
		let timeoutCancelled = false
		let resolved = false

		// Set up timeout
		const timeout = setTimeout(() => {
			if (!resolved) {
				resolved = true
				cleanup()
				stdout.write(`\n[Timeout - using default: ${defaultValue || "(empty)"}]\n`)
				resolve({ value: defaultValue, timedOut: true, cancelled: false })
			}
		}, timeoutMs)

		// Display prompt
		stdout.write(prompt)

		// Cleanup function to restore state
		const cleanup = () => {
			clearTimeout(timeout)
			stdin.removeListener("data", onData)

			if (stdin.isTTY && wasRaw !== undefined) {
				stdin.setRawMode(wasRaw)
			}

			stdin.pause()
			onAfterPrompt()
		}

		// Handle incoming data
		const onData = (data: Buffer) => {
			const char = data.toString()

			// Handle Ctrl+C
			if (char === "\x03") {
				cleanup()
				resolved = true
				stdout.write("\n[cancelled]\n")
				resolve({ value: defaultValue, timedOut: false, cancelled: true })
				return
			}

			// Cancel timeout on first input
			if (!timeoutCancelled) {
				timeoutCancelled = true
				clearTimeout(timeout)
			}

			// Handle Enter
			if (char === "\r" || char === "\n") {
				if (!resolved) {
					resolved = true
					cleanup()
					stdout.write("\n")
					resolve({ value: inputBuffer, timedOut: false, cancelled: false })
				}
				return
			}

			// Handle Backspace
			if (char === "\x7f" || char === "\b") {
				if (inputBuffer.length > 0) {
					inputBuffer = inputBuffer.slice(0, -1)
					stdout.write("\b \b")
				}
				return
			}

			// Normal character - add to buffer and echo
			inputBuffer += char
			stdout.write(char)
		}

		stdin.on("data", onData)
	})
}

/**
 * Prompt for yes/no with timeout.
 *
 * @param stdin - The input stream
 * @param stdout - The output stream
 * @param prompt - The prompt text to display
 * @param timeoutMs - Timeout in milliseconds
 * @param defaultValue - Default boolean value if timed out
 * @param onBeforePrompt - Called before prompting
 * @param onAfterPrompt - Called after prompting
 * @returns true for yes, false for no
 */
export async function promptForYesNoWithTimeout(
	stdin: NodeJS.ReadStream,
	stdout: NodeJS.WriteStream,
	prompt: string,
	timeoutMs: number,
	defaultValue: boolean,
	onBeforePrompt: () => void,
	onAfterPrompt: () => void,
): Promise<boolean> {
	const result = await promptWithTimeout(
		stdin,
		stdout,
		prompt,
		timeoutMs,
		defaultValue ? "y" : "n",
		onBeforePrompt,
		onAfterPrompt,
	)
	const normalized = result.value.trim().toLowerCase()
	if (result.timedOut || result.cancelled || normalized === "") {
		return defaultValue
	}
	return normalized === "y" || normalized === "yes"
}
