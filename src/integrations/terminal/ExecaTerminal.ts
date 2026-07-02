import type { RooTerminalCallbacks, JabberwockTerminalProcess, JabberwockTerminalProcessResultPromise } from "./types"
import { BaseTerminal } from "./terminal-core/BaseTerminal"
import { ExecaTerminalProcess } from "./ExecaTerminalProcess"
import { mergePromise } from "./mergePromise"

export class ExecaTerminal extends BaseTerminal {
	constructor(id: number, cwd: string) {
		super("execa", id, cwd)
	}

	/**
	 * Unlike the VSCode terminal, this is never closed.
	 */
	public override isClosed(): boolean {
		return false
	}

	public override runCommand(
		command: string,
		callbacks: RooTerminalCallbacks,
	): JabberwockTerminalProcessResultPromise {
		this.busy = true

		const process = new ExecaTerminalProcess(this)
		process.command = command
		this.process = process as JabberwockTerminalProcess

		const jProcess = process as JabberwockTerminalProcess
		process.on("line", (line) => callbacks.onLine(line, jProcess))
		process.once("completed", (output) => callbacks.onCompleted(output, jProcess))
		process.once("shell_execution_started", (pid) => callbacks.onShellExecutionStarted(pid, jProcess))
		process.once("shell_execution_complete", (details) => callbacks.onShellExecutionComplete(details, jProcess))

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => resolve())
			process.once("error", (error) => reject(error))
			process.run(command)
		})

		return mergePromise(jProcess, promise)
	}
}
