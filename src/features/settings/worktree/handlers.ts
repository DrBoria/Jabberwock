import * as vscode from "vscode"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { t } from "../../../i18n"
import {
	handleListWorktrees,
	handleCreateWorktree,
	handleDeleteWorktree,
	handleSwitchWorktree,
	handleGetAvailableBranches,
	handleGetWorktreeDefaults,
	handleGetWorktreeIncludeStatus,
	handleCheckBranchWorktreeInclude,
	handleCreateWorktreeInclude,
	handleCheckoutBranch,
} from "../../../core/webview/worktree"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

// Worktree-specific message payload type for accessing runtime properties
interface WorktreeMessagePayload {
	type: string
	worktreePath?: string
	worktreeBranch?: string
	worktreeBaseBranch?: string
	worktreeCreateNewBranch?: boolean
	worktreeForce?: boolean
	worktreeNewWindow?: boolean
	worktreeIncludeContent?: string
}

export const handlerMap: Record<string, HandlerFn> = {
	listWorktrees: async (provider, message) => {
		try {
			const { worktrees, isGitRepo, isMultiRoot, isSubfolder, gitRootPath, error } =
				await handleListWorktrees(provider)

			await provider.postMessageToWebview({
				type: "worktreeList",
				worktrees,
				isGitRepo,
				isMultiRoot,
				isSubfolder,
				gitRootPath,
				error,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await provider.postMessageToWebview({
				type: "worktreeList",
				worktrees: [],
				isGitRepo: false,
				isMultiRoot: false,
				isSubfolder: false,
				gitRootPath: "",
				error: errorMessage,
			})
		}
	},

	createWorktree: async (provider, message) => {
		try {
			const { success, message: text } = await handleCreateWorktree(
				provider,
				{
					path: (message as WorktreeMessagePayload).worktreePath!,
					branch: (message as WorktreeMessagePayload).worktreeBranch,
					baseBranch: (message as WorktreeMessagePayload).worktreeBaseBranch,
					createNewBranch: (message as WorktreeMessagePayload).worktreeCreateNewBranch,
				},
				(progress) => {
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
	},

	deleteWorktree: async (provider, message) => {
		try {
			const { success, message: text } = await handleDeleteWorktree(
				provider,
				(message as WorktreeMessagePayload).worktreePath!,
				(message as WorktreeMessagePayload).worktreeForce ?? false,
			)

			await provider.postMessageToWebview({ type: "worktreeResult", success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await provider.postMessageToWebview({ type: "worktreeResult", success: false, text: errorMessage })
		}
	},

	switchWorktree: async (provider, message) => {
		try {
			const { success, message: text } = await handleSwitchWorktree(
				provider,
				(message as WorktreeMessagePayload).worktreePath!,
				(message as WorktreeMessagePayload).worktreeNewWindow ?? true,
			)

			await provider.postMessageToWebview({ type: "worktreeResult", success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await provider.postMessageToWebview({ type: "worktreeResult", success: false, text: errorMessage })
		}
	},

	getAvailableBranches: async (provider, message) => {
		try {
			const { localBranches, remoteBranches, currentBranch } = await handleGetAvailableBranches(provider)

			await provider.postMessageToWebview({
				type: "branchList",
				localBranches,
				remoteBranches,
				currentBranch,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await provider.postMessageToWebview({
				type: "branchList",
				localBranches: [],
				remoteBranches: [],
				currentBranch: "",
				error: errorMessage,
			})
		}
	},

	getWorktreeDefaults: async (provider, message) => {
		try {
			const { suggestedBranch, suggestedPath } = await handleGetWorktreeDefaults(provider)
			await provider.postMessageToWebview({ type: "worktreeDefaults", suggestedBranch, suggestedPath })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await provider.postMessageToWebview({
				type: "worktreeDefaults",
				suggestedBranch: "",
				suggestedPath: "",
				error: errorMessage,
			})
		}
	},

	getWorktreeIncludeStatus: async (provider, message) => {
		try {
			const worktreeIncludeStatus = await handleGetWorktreeIncludeStatus(provider)
			await provider.postMessageToWebview({ type: "worktreeIncludeStatus", worktreeIncludeStatus })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await provider.postMessageToWebview({
				type: "worktreeIncludeStatus",
				worktreeIncludeStatus: {
					exists: false,
					hasGitignore: false,
					gitignoreContent: undefined,
				},
				error: errorMessage,
			})
		}
	},

	checkBranchWorktreeInclude: async (provider, message) => {
		try {
			const branch = (message as WorktreeMessagePayload).worktreeBranch
			if (!branch) {
				await provider.postMessageToWebview({
					type: "branchWorktreeIncludeResult",
					hasWorktreeInclude: false,
					error: "No branch specified",
				})
				return
			}
			const hasWorktreeInclude = await handleCheckBranchWorktreeInclude(provider, branch)
			await provider.postMessageToWebview({
				type: "branchWorktreeIncludeResult",
				branch,
				hasWorktreeInclude,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await provider.postMessageToWebview({
				type: "branchWorktreeIncludeResult",
				hasWorktreeInclude: false,
				error: errorMessage,
			})
		}
	},

	createWorktreeInclude: async (provider, message) => {
		try {
			const { success, message: text } = await handleCreateWorktreeInclude(
				provider,
				(message as WorktreeMessagePayload).worktreeIncludeContent ?? "",
			)

			await provider.postMessageToWebview({ type: "worktreeResult", success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Error creating worktree include: ${errorMessage}`)
			await provider.postMessageToWebview({ type: "worktreeResult", success: false, text: errorMessage })
		}
	},

	checkoutBranch: async (provider, message) => {
		try {
			const { success, message: text } = await handleCheckoutBranch(
				provider,
				(message as WorktreeMessagePayload).worktreeBranch!,
			)
			await provider.postMessageToWebview({ type: "worktreeResult", success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await provider.postMessageToWebview({ type: "worktreeResult", success: false, text: errorMessage })
		}
	},

	browseForWorktreePath: async (provider, message) => {
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
			provider.log(`Error opening folder picker: ${errorMessage}`)
		}
	},
}
