import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import vscode from "vscode"
import { t } from "@i18n"

import { handleCreateWorktreeInternal, handleDeleteWorktreeInternal, handleSwitchWorktreeInternal } from "./handlers"

export function registerCrudRegistrations(bus: IntentBus): void {
	// ── createWorktree ────────────────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeCreate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			worktreePath: string
			worktreeBranch?: string
			worktreeBaseBranch?: string
			worktreeCreateNewBranch?: boolean
		}

		try {
			const { success, message: text } = await handleCreateWorktreeInternal(
				{
					path: payload.worktreePath,
					branch: payload.worktreeBranch,
					baseBranch: payload.worktreeBaseBranch,
					createNewBranch: payload.worktreeCreateNewBranch,
				},
				(progress: { bytesCopied: number; itemName: string }) => {
					provider.postMessageToWebview({
						type: "worktreeCopyProgress",
						copyProgressBytesCopied: progress.bytesCopied,
						copyProgressItemName: progress.itemName,
					})
				},
			)

			await provider.postMessageToWebview({ type: "worktreeResult", success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await provider.postMessageToWebview({ type: "worktreeResult", success: false, text: errorMessage })
		}
	})

	// ── deleteWorktree ────────────────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeDelete, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			worktreePath: string
			worktreeForce?: boolean
		}

		try {
			const { success, message: text } = await handleDeleteWorktreeInternal(
				payload.worktreePath,
				payload.worktreeForce ?? false,
			)

			await provider.postMessageToWebview({ type: "worktreeResult", success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await provider.postMessageToWebview({ type: "worktreeResult", success: false, text: errorMessage })
		}
	})

	// ── switchWorktree ────────────────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeSwitch, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			worktreePath: string
			worktreeNewWindow?: boolean
		}

		try {
			const { success, message: text } = await handleSwitchWorktreeInternal(
				payload.worktreePath,
				payload.worktreeNewWindow ?? true,
			)

			await provider.postMessageToWebview({ type: "worktreeResult", success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await provider.postMessageToWebview({ type: "worktreeResult", success: false, text: errorMessage })
		}
	})

	// ── browseForWorktreePath ─────────────────────────────────────────
	bus.register(IntentType.SettingsWorktreePathBrowse, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const options: vscode.OpenDialogOptions = {
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: t("worktrees:selectWorktreeLocation"),
				title: t("worktrees:selectFolderForWorktree"),
				defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
					? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, "..")
					: undefined,
			}

			const result = await vscode.window.showOpenDialog(options)
			if (result && result[0]) {
				await provider.postMessageToWebview({
					type: "folderSelected",
					path: result[0].fsPath,
				})
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.warn("Error opening folder picker:", errorMessage)
		}
	})
}
