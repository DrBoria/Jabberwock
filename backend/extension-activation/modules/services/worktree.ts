import * as vscode from "vscode"

export async function checkWorktreeAutoOpen(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	try {
		const worktreeAutoOpenPath = context.globalState.get<string>("worktreeAutoOpenPath")
		if (!worktreeAutoOpenPath) {
			return
		}

		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return
		}

		const currentPath = workspaceFolders[0].uri.fsPath

		const normalizePath = (p: string) => p.replace(/\/+$/, "").replace(/\\+/g, "/").toLowerCase()

		if (normalizePath(currentPath) === normalizePath(worktreeAutoOpenPath)) {
			await context.globalState.update("worktreeAutoOpenPath", undefined)

			outputChannel.appendLine(`[Worktree] Auto-opening Jabberwock sidebar for worktree: ${worktreeAutoOpenPath}`)

			setTimeout(async () => {
				try {
					await vscode.commands.executeCommand("jabberwock.plusButtonClicked")
				} catch (error) {
					outputChannel.appendLine(
						`[Worktree] Error auto-opening sidebar: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}, 500)
		}
	} catch (error) {
		outputChannel.appendLine(
			`[Worktree] Error checking worktree auto-open: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
