import { execa, ExecaError } from "execa"

import type { RooTerminal } from "@integrations/terminal/types"
import { BaseTerminal } from "@integrations/terminal/terminal-core/BaseTerminal"
import { BaseTerminalProcess } from "@integrations/terminal/terminal-core/BaseTerminalProcess"
import {
	emitRemainingBufferIfListening,
	hasUnretrievedOutput as checkHasUnretrievedOutput,
	getUnretrievedOutput as retrieveUnretrievedOutput,
} from "./execa-process-output"
import { startPidUpdate, handleAbortCleanup, performAbort } from "./execa-terminal-process.helpers"

export class ExecaTerminalProcess extends BaseTerminalProcess {
	private terminalRef: WeakRef<RooTerminal>
	private aborted = false
	private pid?: number
	private subprocess?: ReturnType<typeof execa>
	private pidUpdatePromise?: Promise<void>

	constructor(terminal: RooTerminal) {
		super()

		this.terminalRef = new WeakRef(terminal)

		this.once("completed", () => {
			this.terminal.busy = false
		})
	}

	public get terminal(): RooTerminal {
		const terminal = this.terminalRef.deref()

		if (!terminal) {
			throw new Error("Unable to dereference terminal")
		}

		return terminal
	}

	private startPidUpdate(): void {
		this.pidUpdatePromise = startPidUpdate(this.pid, (newPid) => {
			this.pid = newPid
		})
	}

	private async handleAbortCleanup(): Promise<void> {
		await handleAbortCleanup(this.aborted, this.pid, this.subprocess, () => {})
	}

	private handleRunError(error: unknown): void {
		if (error instanceof ExecaError) {
			console.error(`[jabberwock] [ExecaTerminalProcess#run] shell execution error: ${error.message}`)
			this.emit("shell_execution_complete", { exitCode: error.exitCode ?? 0, signalName: error.signal })
		} else {
			console.error(
				`[jabberwock] [ExecaTerminalProcess#run] shell execution error: ${error instanceof Error ? error.message : String(error)}`,
			)
			this.emit("shell_execution_complete", { exitCode: 1 })
		}
		this.subprocess = undefined
	}

	public override async run(command: string) {
		this.command = command

		try {
			this.isHot = true

			this.subprocess = execa({
				shell: BaseTerminal.getExecaShellPath() || true,
				cwd: this.terminal.getCurrentWorkingDirectory(),
				all: true,
				stdin: "ignore",
				env: {
					...process.env,
					LANG: "en_US.UTF-8",
					LC_ALL: "en_US.UTF-8",
				},
			})`${command}`

			this.pid = this.subprocess.pid
			this.startPidUpdate()

			const rawStream = this.subprocess.iterable({ from: "all", preserveNewlines: true })
			const stream = (async function* () {
				for await (const chunk of rawStream) {
					yield typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
				}
			})()

			this.terminal.setActiveStream(stream, this.pid)

			for await (const line of stream) {
				if (this.aborted) {
					break
				}
				this.fullOutput += line

				const now = Date.now()
				if (this.isListening && (now - this.lastEmitTime_ms > 500 || this.lastEmitTime_ms === 0)) {
					this.lastRetrievedIndex = emitRemainingBufferIfListening(
						(event: string, data: string) => this.emit(event as "line", data),
						this.isListening,
						this.fullOutput,
						this.lastRetrievedIndex,
					)
					this.lastEmitTime_ms = now
				}
				this.startHotTimer(line)
			}

			await this.handleAbortCleanup()
			this.emit("shell_execution_complete", { exitCode: 0 })
		} catch (error) {
			this.handleRunError(error)
		}

		this.terminal.setActiveStream(undefined)
		this.lastRetrievedIndex = emitRemainingBufferIfListening(
			(event: string, data: string) => this.emit(event as "line", data),
			this.isListening,
			this.fullOutput,
			this.lastRetrievedIndex,
		)
		this.stopHotTimer()
		this.emit("completed", this.fullOutput)
		this.emit("continue")
		this.subprocess = undefined
	}

	public override continue() {
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	public hasUnretrievedOutput(): boolean {
		return checkHasUnretrievedOutput(this.lastRetrievedIndex, this.fullOutput.length)
	}

	public getUnretrievedOutput(): string {
		const { output } = retrieveUnretrievedOutput(this.fullOutput, this.lastRetrievedIndex)
		return output
	}

	public override abort() {
		this.aborted = true
		performAbort(this.aborted, this.pid, this.subprocess, this.pidUpdatePromise)
	}
}
