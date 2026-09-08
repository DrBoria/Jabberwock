import type { ExitCodeDetails } from "@jabberwock/types"
import { BaseTerminalProcess } from "@integrations/terminal/terminal-core/BaseTerminalProcess"
import { Terminal } from "./Terminal"
import { executeShellCommandInTerminal } from "../execute-shell-command"
import {
	createStreamPromise,
	awaitStreamOrHandleError,
	processStreamData,
	handleMissingCommandOutput,
	getUnretrievedOutput,
} from "@integrations/terminal/stream-helpers"
import {
	removeVSCodeShellIntegration,
	stripCursorSequences,
	matchVsceMarkers,
} from "@integrations/terminal/vsce-markers"

export class TerminalProcess extends BaseTerminalProcess {
	private terminalRef: WeakRef<Terminal>

	constructor(terminal: Terminal) {
		super()

		this.terminalRef = new WeakRef(terminal)

		this.once("completed", () => {
			this.terminal.busy = false
		})

		this.once("no_shell_integration", () => {
			this.emit("completed", "<no shell integration>")
			this.terminal.busy = false
			this.terminal.setActiveStream(undefined)
			this.continue()
		})
	}

	public get terminal(): Terminal {
		const terminal = this.terminalRef.deref()

		if (!terminal) {
			throw new Error("Unable to dereference terminal")
		}

		return terminal
	}

	public override async run(command: string) {
		this.command = command

		const terminal = this.terminal.terminal

		const isShellIntegrationAvailable = terminal.shellIntegration && terminal.shellIntegration.executeCommand

		if (!isShellIntegrationAvailable) {
			terminal.sendText(command, true)

			console.warn(
				"[TerminalProcess] Shell integration not available. Command sent without knowledge of response.",
			)

			this.emit(
				"no_shell_integration",
				"Command was submitted; output is not available, as shell integration is inactive.",
			)

			this.emit(
				"completed",
				"<shell integration is not available, so terminal output and command execution status is unknown>",
			)

			this.emit("continue")
			return
		}

		const streamAvailable = createStreamPromise(this, () => Terminal.getShellIntegrationTimeout())

		const shellExecutionComplete = new Promise<ExitCodeDetails>((resolve) => {
			this.once("shell_execution_complete", (details: ExitCodeDetails) => resolve(details))
		})

		executeShellCommandInTerminal(
			command,
			terminal,
			this.terminal.cmdCounter++,
			() => Terminal.getPowershellCounter(),
			() => Terminal.getCommandDelay(),
		)

		this.isHot = true

		const stream = await awaitStreamOrHandleError(
			this,
			streamAvailable,
			(output) => {
				this.emit("completed", output)
			},
			() => {
				this.terminal.busy = false
				this.emit("continue")
			},
		)

		if (stream === undefined) {
			return
		}

		const fullOutputRef = { current: this.fullOutput }

		const { commandOutputStarted, preOutput } = await processStreamData(
			this,
			stream,
			fullOutputRef,
			() => this.isListening,
			() => this.lastEmitTime_ms,
			() => {
				this.emitRemainingBufferIfListening()
				this.lastEmitTime_ms = Date.now()
			},
			(data) => this.startHotTimer(data),
		)

		this.fullOutput = fullOutputRef.current

		this.terminal.setActiveStream(undefined)

		await shellExecutionComplete

		this.isHot = false

		if (!commandOutputStarted) {
			handleMissingCommandOutput(
				this,
				preOutput,
				(output) => {
					this.emit("completed", output)
				},
				() => {
					this.continue()
				},
			)
			return
		}

		this.emitRemainingBufferIfListening()

		const match = matchVsceMarkers(this.fullOutput, undefined, ["\x1b]633;D", "\x1b]133;D"])

		if (match !== undefined) {
			this.fullOutput = match
		}

		this.stopHotTimer()
		this.emit("completed", stripCursorSequences(removeVSCodeShellIntegration(this.fullOutput)))
		this.emit("continue")
	}

	public override continue() {
		this.emitRemainingBufferIfListening()
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	public override abort() {
		if (this.isListening) {
			this.terminal.terminal.sendText("\x03")
		}
	}

	public override hasUnretrievedOutput(): boolean {
		return this.lastRetrievedIndex < this.fullOutput.length
	}

	public override getUnretrievedOutput(): string {
		const { output, newLastRetrievedIndex } = getUnretrievedOutput(
			this.fullOutput,
			this.lastRetrievedIndex,
			this.terminal.isStreamClosed,
		)

		this.lastRetrievedIndex = newLastRetrievedIndex

		return output
	}

	private emitRemainingBufferIfListening() {
		if (this.isListening) {
			const remainingBuffer = this.getUnretrievedOutput()

			if (remainingBuffer !== "") {
				this.emit("line", remainingBuffer)
			}
		}
	}
}
