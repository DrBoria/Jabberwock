import { TerminalConfig } from "./TerminalConfig"

import type {
	RooTerminalProvider,
	RooTerminal,
	RooTerminalCallbacks,
	JabberwockTerminalProcess,
	JabberwockTerminalProcessResultPromise,
	ExitCodeDetails,
} from "@integrations/terminal/types"

export abstract class BaseTerminal implements RooTerminal {
	public readonly provider: RooTerminalProvider
	public readonly id: number
	public readonly initialCwd: string

	public busy: boolean
	public running: boolean
	protected streamClosed: boolean

	public taskId?: string
	public process?: JabberwockTerminalProcess
	public completedProcesses: JabberwockTerminalProcess[] = []

	constructor(provider: RooTerminalProvider, id: number, cwd: string) {
		this.provider = provider
		this.id = id
		this.initialCwd = cwd
		this.busy = false
		this.running = false
		this.streamClosed = false
	}

	public getCurrentWorkingDirectory(): string {
		return this.initialCwd
	}

	abstract isClosed(): boolean

	abstract runCommand(command: string, callbacks: RooTerminalCallbacks): JabberwockTerminalProcessResultPromise

	public setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void {
		if (stream) {
			if (!this.process) {
				this.running = false

				console.warn(
					`[Terminal ${this.provider}/${this.id}] process is undefined, so cannot set terminal stream (probably user-initiated non-Jabberwock command)`,
				)

				return
			}

			this.running = true
			this.streamClosed = false
			this.process.emit("shell_execution_started", pid)
			this.process.emit("stream_available", stream)
		} else {
			this.streamClosed = true
		}
	}

	public shellExecutionComplete(exitDetails: ExitCodeDetails) {
		this.busy = false
		this.running = false

		if (this.process) {
			if (this.process.hasUnretrievedOutput()) {
				this.completedProcesses.unshift(this.process)
			}

			this.process.emit("shell_execution_complete", exitDetails)
			this.process = undefined
		}
	}

	public get isStreamClosed(): boolean {
		return this.streamClosed
	}

	public getLastCommand(): string {
		if (this.process) {
			return this.process.command || ""
		} else if (this.completedProcesses.length > 0) {
			return this.completedProcesses[0].command || ""
		}

		return ""
	}

	public cleanCompletedProcessQueue(): void {
		this.completedProcesses = this.completedProcesses.filter((process) => {
			process.trimRetrievedOutput()
			return process.hasUnretrievedOutput()
		})
	}

	public getProcessesWithOutput(): JabberwockTerminalProcess[] {
		this.cleanCompletedProcessQueue()
		return [...this.completedProcesses]
	}

	public getUnretrievedOutput(): string {
		let output = ""

		for (const process of this.completedProcesses) {
			const processOutput = process.getUnretrievedOutput()

			if (processOutput) {
				output += processOutput
			}
		}

		const activeOutput = this.process?.getUnretrievedOutput()

		if (activeOutput) {
			output += activeOutput
		}

		this.cleanCompletedProcessQueue()
		return output
	}

	// Static config forwarding
	public static defaultShellIntegrationTimeout = TerminalConfig.defaultShellIntegrationTimeout

	public static setShellIntegrationTimeout(timeoutMs: number): void {
		TerminalConfig.setShellIntegrationTimeout(timeoutMs)
	}

	public static getShellIntegrationTimeout(): number {
		return TerminalConfig.getShellIntegrationTimeout()
	}

	public static setShellIntegrationDisabled(disabled: boolean): void {
		TerminalConfig.setShellIntegrationDisabled(disabled)
	}

	public static getShellIntegrationDisabled(): boolean {
		return TerminalConfig.getShellIntegrationDisabled()
	}

	public static setCommandDelay(delayMs: number): void {
		TerminalConfig.setCommandDelay(delayMs)
	}

	public static getCommandDelay(): number {
		return TerminalConfig.getCommandDelay()
	}

	public static setPowershellCounter(enabled: boolean): void {
		TerminalConfig.setPowershellCounter(enabled)
	}

	public static getPowershellCounter(): boolean {
		return TerminalConfig.getPowershellCounter()
	}

	public static setTerminalZshClearEolMark(enabled: boolean): void {
		TerminalConfig.setTerminalZshClearEolMark(enabled)
	}

	public static getTerminalZshClearEolMark(): boolean {
		return TerminalConfig.getTerminalZshClearEolMark()
	}

	public static setTerminalZshOhMy(enabled: boolean): void {
		TerminalConfig.setTerminalZshOhMy(enabled)
	}

	public static getTerminalZshOhMy(): boolean {
		return TerminalConfig.getTerminalZshOhMy()
	}

	public static setTerminalZshP10k(enabled: boolean): void {
		TerminalConfig.setTerminalZshP10k(enabled)
	}

	public static getTerminalZshP10k(): boolean {
		return TerminalConfig.getTerminalZshP10k()
	}

	public static setTerminalZdotdir(enabled: boolean): void {
		TerminalConfig.setTerminalZdotdir(enabled)
	}

	public static getTerminalZdotdir(): boolean {
		return TerminalConfig.getTerminalZdotdir()
	}

	public static setExecaShellPath(shellPath: string | undefined): void {
		TerminalConfig.setExecaShellPath(shellPath)
	}

	public static getExecaShellPath(): string | undefined {
		return TerminalConfig.getExecaShellPath()
	}

	public static compressTerminalOutput(input: string): string {
		return TerminalConfig.compressTerminalOutput(input)
	}
}
