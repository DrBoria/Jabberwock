import { truncateOutput, applyRunLengthEncoding } from "@integrations/misc/extract-text/helpers"

export class TerminalConfig {
	public static defaultShellIntegrationTimeout = 5_000
	private static shellIntegrationTimeout: number = TerminalConfig.defaultShellIntegrationTimeout
	private static shellIntegrationDisabled: boolean = false
	private static commandDelay: number = 0
	private static powershellCounter: boolean = false
	private static terminalZshClearEolMark: boolean = true
	private static terminalZshOhMy: boolean = false
	private static terminalZshP10k: boolean = false
	private static terminalZdotdir: boolean = false
	private static execaShellPath: string | undefined

	public static setShellIntegrationTimeout(timeoutMs: number): void {
		TerminalConfig.shellIntegrationTimeout = timeoutMs
	}

	public static getShellIntegrationTimeout(): number {
		return TerminalConfig.shellIntegrationTimeout
	}

	public static setShellIntegrationDisabled(disabled: boolean): void {
		TerminalConfig.shellIntegrationDisabled = disabled
	}

	public static getShellIntegrationDisabled(): boolean {
		return TerminalConfig.shellIntegrationDisabled
	}

	public static setCommandDelay(delayMs: number): void {
		TerminalConfig.commandDelay = delayMs
	}

	public static getCommandDelay(): number {
		return TerminalConfig.commandDelay
	}

	public static setPowershellCounter(enabled: boolean): void {
		TerminalConfig.powershellCounter = enabled
	}

	public static getPowershellCounter(): boolean {
		return TerminalConfig.powershellCounter
	}

	public static setTerminalZshClearEolMark(enabled: boolean): void {
		TerminalConfig.terminalZshClearEolMark = enabled
	}

	public static getTerminalZshClearEolMark(): boolean {
		return TerminalConfig.terminalZshClearEolMark
	}

	public static setTerminalZshOhMy(enabled: boolean): void {
		TerminalConfig.terminalZshOhMy = enabled
	}

	public static getTerminalZshOhMy(): boolean {
		return TerminalConfig.terminalZshOhMy
	}

	public static setTerminalZshP10k(enabled: boolean): void {
		TerminalConfig.terminalZshP10k = enabled
	}

	public static getTerminalZshP10k(): boolean {
		return TerminalConfig.terminalZshP10k
	}

	public static setTerminalZdotdir(enabled: boolean): void {
		TerminalConfig.terminalZdotdir = enabled
	}

	public static getTerminalZdotdir(): boolean {
		return TerminalConfig.terminalZdotdir
	}

	public static setExecaShellPath(shellPath: string | undefined): void {
		TerminalConfig.execaShellPath = shellPath
	}

	public static getExecaShellPath(): string | undefined {
		return TerminalConfig.execaShellPath
	}

	/**
	 * Compresses terminal output by applying run-length encoding and truncating to reasonable limits.
	 * Uses hardcoded defaults: 500 lines, 50K characters - these are UI display limits to prevent
	 * memory issues, not LLM context limits (which are controlled by terminalOutputPreviewSize).
	 * @param input The terminal output to compress
	 * @returns The compressed terminal output
	 */
	public static compressTerminalOutput(input: string): string {
		const LINE_LIMIT = 500
		const CHARACTER_LIMIT = 50_000

		return truncateOutput(applyRunLengthEncoding(input), LINE_LIMIT, CHARACTER_LIMIT)
	}
}
