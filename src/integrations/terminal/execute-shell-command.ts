import * as vscode from "vscode"

/**
 * Execute a shell command in the terminal using VSCode shell integration.
 *
 * Handles PowerShell-specific workarounds on Windows and optional
 * command delays to ensure output is properly captured.
 */
export function executeShellCommandInTerminal(
	command: string,
	terminal: vscode.Terminal,
	cmdCounter: number,
	getPowershellCounter: () => boolean,
	getCommandDelay: () => number,
): void {
	const defaultWindowsShellProfile = vscode.workspace
		.getConfiguration("terminal.integrated.defaultProfile")
		.get("windows")

	const isPowerShell =
		process.platform === "win32" &&
		(defaultWindowsShellProfile === null ||
			(defaultWindowsShellProfile as string)?.toLowerCase().includes("powershell"))

	if (isPowerShell) {
		let commandToExecute = command

		if (getPowershellCounter()) {
			commandToExecute += ` ; "(Jabberwock/PS Workaround: ${cmdCounter})" > $null`
		}

		if (getCommandDelay() > 0) {
			commandToExecute += ` ; start-sleep -milliseconds ${getCommandDelay()}`
		}

		terminal.shellIntegration?.executeCommand(commandToExecute)
	} else {
		terminal.shellIntegration?.executeCommand(command)
	}
}
