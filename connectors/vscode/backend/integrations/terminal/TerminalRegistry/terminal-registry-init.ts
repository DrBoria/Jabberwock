import * as vscode from "vscode"

import { RooTerminal } from "@jabberwock/types"
import { ShellIntegrationManager } from "@integrations/terminal/ShellIntegrationManager"
import { TerminalProcess } from "../terminal-core/TerminalProcess"
import { Terminal } from "../terminal-core/Terminal"

export function initializeTerminalRegistry(
	disposables: vscode.Disposable[],
	getTerminalByVSCETerminal: (vsceTerminal: vscode.Terminal) => RooTerminal | undefined,
): void {
	// Register handler for terminal close events to clean up temporary
	// directories.
	const closeDisposable = vscode.window.onDidCloseTerminal((vsceTerminal) => {
		const terminal = getTerminalByVSCETerminal(vsceTerminal)

		if (terminal) {
			ShellIntegrationManager.zshCleanupTmpDir(terminal.id)
		}
	})

	disposables.push(closeDisposable)

	try {
		const startDisposable = vscode.window.onDidStartTerminalShellExecution?.(
			async (e: vscode.TerminalShellExecutionStartEvent) => {
				// Get a handle to the stream as early as possible:
				const stream = e.execution.read()
				const terminal = getTerminalByVSCETerminal(e.terminal)

				console.info("[onDidStartTerminalShellExecution]", {
					command: e.execution?.commandLine?.value,
					terminalId: terminal?.id,
				})

				if (terminal) {
					terminal.setActiveStream(stream)
					terminal.busy = true // Mark terminal as busy when shell execution starts
				} else {
					console.error(
						"[onDidStartTerminalShellExecution] Shell execution started, but not from a Jabberwock-registered terminal:",
						e,
					)
				}
			},
		)

		if (startDisposable) {
			disposables.push(startDisposable)
		}

		const endDisposable = vscode.window.onDidEndTerminalShellExecution?.(
			async (e: vscode.TerminalShellExecutionEndEvent) => {
				const terminal = getTerminalByVSCETerminal(e.terminal)
				const process = terminal?.process
				const exitDetails = TerminalProcess.interpretExitCode(e.exitCode)

				console.info("[onDidEndTerminalShellExecution]", {
					command: e.execution?.commandLine?.value,
					terminalId: terminal?.id,
					...exitDetails,
				})

				if (!terminal) {
					console.error(
						"[onDidEndTerminalShellExecution] Shell execution ended, but not from a Jabberwock-registered terminal:",
						e,
					)

					return
				}

				if (!terminal.running) {
					console.error(
						"[TerminalRegistry] Shell execution end event received, but process is not running for terminal:",
						{ terminalId: terminal?.id, command: process?.command, exitCode: e.exitCode },
					)

					terminal.busy = false
					return
				}

				if (!process) {
					console.error(
						"[TerminalRegistry] Shell execution end event received on running terminal, process is undefined:",
						{ terminalId: terminal.id, exitCode: e.exitCode },
					)

					return
				}

				// Signal completion to any waiting processes.
				terminal.shellExecutionComplete(exitDetails)
				terminal.busy = false // Mark terminal as not busy when shell execution ends
			},
		)

		if (endDisposable) {
			disposables.push(endDisposable)
		}
	} catch (error) {
		console.error("[jabberwock] [TerminalRegistry] Error setting up shell execution handlers:", error)
	}
}
