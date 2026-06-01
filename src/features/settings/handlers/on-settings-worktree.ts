import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../intents/bus"
import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import { t } from "../../../i18n"

import type {
	WorktreeResult,
	BranchInfo,
	WorktreeIncludeStatus,
	WorktreeListResponse,
	WorktreeDefaultsResponse,
} from "@jabberwock/types"
import { worktreeService, worktreeIncludeService, type CopyProgressCallback } from "@jabberwock/core"

import { getWorkspacePath } from "@utils/path"
import { getSettingsAccess } from "@utils/settings-access"

/**
 * Generate a random alphanumeric suffix for branch/folder names.
 */
function generateRandomSuffix(length = 5): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	let result = ""

	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length))
	}

	return result
}

async function isWorkspaceSubfolder(cwd: string): Promise<boolean> {
	const gitRoot = await worktreeService.getGitRootPath(cwd)

	if (!gitRoot) {
		return false
	}

	// Normalize paths for comparison.
	const normalizedCwd = path.normalize(cwd)
	const normalizedGitRoot = path.normalize(gitRoot)

	// If cwd is deeper than git root, it's a subfolder.
	return normalizedCwd !== normalizedGitRoot && normalizedCwd.startsWith(normalizedGitRoot)
}

function getCwd(): string {
	return getWorkspacePath()
}

async function handleListWorktrees(): Promise<WorktreeListResponse> {
	const workspaceFolders = vscode.workspace.workspaceFolders
	const isMultiRoot = workspaceFolders ? workspaceFolders.length > 1 : false

	if (!workspaceFolders || workspaceFolders.length === 0) {
		return {
			worktrees: [],
			isGitRepo: false,
			isMultiRoot: false,
			isSubfolder: false,
			gitRootPath: "",
			error: "No workspace folder open",
		}
	}

	// Multi-root workspaces not supported for worktrees.
	if (isMultiRoot) {
		return {
			worktrees: [],
			isGitRepo: false,
			isMultiRoot: true,
			isSubfolder: false,
			gitRootPath: "",
			error: "Worktrees are not supported in multi-root workspaces",
		}
	}

	const cwd = getCwd()
	const isGitRepo = await worktreeService.checkGitRepo(cwd)

	if (!isGitRepo) {
		return {
			worktrees: [],
			isGitRepo: false,
			isMultiRoot: false,
			isSubfolder: false,
			gitRootPath: "",
			error: "Not a git repository",
		}
	}

	const isSubfolder = await isWorkspaceSubfolder(cwd)
	const gitRootPath = (await worktreeService.getGitRootPath(cwd)) || ""

	if (isSubfolder) {
		return {
			worktrees: [],
			isGitRepo: true,
			isMultiRoot: false,
			isSubfolder: true,
			gitRootPath,
			error: "Worktrees are not supported when workspace is a subfolder of a git repository",
		}
	}

	try {
		const worktrees = await worktreeService.listWorktrees(cwd)

		return {
			worktrees,
			isGitRepo: true,
			isMultiRoot: false,
			isSubfolder: false,
			gitRootPath,
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)

		return {
			worktrees: [],
			isGitRepo: true,
			isMultiRoot: false,
			isSubfolder: false,
			gitRootPath,
			error: `Failed to list worktrees: ${errorMessage}`,
		}
	}
}

async function handleCreateWorktreeInternal(
	options: {
		path: string
		branch?: string
		baseBranch?: string
		createNewBranch?: boolean
	},
	onCopyProgress?: CopyProgressCallback,
): Promise<WorktreeResult> {
	const cwd = getCwd()

	const isGitRepo = await worktreeService.checkGitRepo(cwd)

	if (!isGitRepo) {
		return {
			success: false,
			message: "Not a git repository",
		}
	}

	const result = await worktreeService.createWorktree(cwd, options)

	// If successful and .worktreeinclude exists, copy the files.
	if (result.success && result.worktree) {
		try {
			const copiedItems = await worktreeIncludeService.copyWorktreeIncludeFiles(
				cwd,
				result.worktree.path,
				onCopyProgress,
			)
			if (copiedItems.length > 0) {
				result.message += ` (copied ${copiedItems.length} item(s) from .worktreeinclude)`
			}
		} catch (error) {
			// Log but don't fail the worktree creation.
			console.warn("Warning: Failed to copy .worktreeinclude files:", error)
		}
	}

	return result
}

async function handleDeleteWorktreeInternal(worktreePath: string, force = false): Promise<WorktreeResult> {
	const cwd = getCwd()
	return worktreeService.deleteWorktree(cwd, worktreePath, force)
}

async function handleSwitchWorktreeInternal(worktreePath: string, newWindow: boolean): Promise<WorktreeResult> {
	try {
		const worktreeUri = vscode.Uri.file(worktreePath)

		if (newWindow) {
			// Set the auto-open path so the new window opens Jabberwock sidebar.
			await getSettingsAccess().setValue("worktreeAutoOpenPath", worktreePath)

			// Open in new window.
			await vscode.commands.executeCommand("vscode.openFolder", worktreeUri, { forceNewWindow: true })
		} else {
			// For current window, we need to flush pending state first since window will reload.
			await getSettingsAccess().setValue("worktreeAutoOpenPath", worktreePath)

			// Open in current window (this will reload the window).
			await vscode.commands.executeCommand("vscode.openFolder", worktreeUri, { forceNewWindow: false })
		}

		return {
			success: true,
			message: `Opened worktree at ${worktreePath}`,
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		return {
			success: false,
			message: `Failed to switch worktree: ${errorMessage}`,
		}
	}
}

async function handleGetAvailableBranchesInternal(): Promise<BranchInfo> {
	const cwd = getCwd()
	// Include branches already in worktrees since we use this for base branch selection
	return worktreeService.getAvailableBranches(cwd, true)
}

async function handleGetWorktreeDefaultsInternal(): Promise<WorktreeDefaultsResponse> {
	const suffix = generateRandomSuffix()
	const workspaceFolders = vscode.workspace.workspaceFolders
	const projectName = workspaceFolders?.[0]?.name || "project"

	const dotRooPath = path.join(os.homedir(), ".jabberwock")
	const suggestedPath = path.join(dotRooPath, "worktrees", `${projectName}-${suffix}`)

	return {
		suggestedBranch: `worktree/jabberwock-${suffix}`,
		suggestedPath,
	}
}

async function handleGetWorktreeIncludeStatusInternal(): Promise<WorktreeIncludeStatus> {
	const cwd = getCwd()
	return worktreeIncludeService.getStatus(cwd)
}

async function handleCheckBranchWorktreeIncludeInternal(branch: string): Promise<boolean> {
	const cwd = getCwd()
	return worktreeIncludeService.branchHasWorktreeInclude(cwd, branch)
}

async function handleCreateWorktreeIncludeInternal(content: string): Promise<WorktreeResult> {
	const cwd = getCwd()

	try {
		await worktreeIncludeService.createWorktreeInclude(cwd, content)

		// Open the file in the editor for easy editing
		try {
			const filePath = path.join(cwd, ".worktreeinclude")
			const document = await vscode.workspace.openTextDocument(filePath)
			await vscode.window.showTextDocument(document)
		} catch {
			// Opening the file in editor is a convenience feature - don't fail the operation
		}

		return {
			success: true,
			message: ".worktreeinclude file created",
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		return {
			success: false,
			message: `Failed to create .worktreeinclude: ${errorMessage}`,
		}
	}
}

async function handleCheckoutBranchInternal(branch: string): Promise<WorktreeResult> {
	const cwd = getCwd()
	return worktreeService.checkoutBranch(cwd, branch)
}

/**
 * Register all worktree settings intent handlers.
 */
export function registerOnSettingsWorktree(bus: IntentBus): void {
	// ── listWorktrees ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeList, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const { worktrees, isGitRepo, isMultiRoot, isSubfolder, gitRootPath, error } = await handleListWorktrees()

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
	})

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

	// ── getAvailableBranches ──────────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeBranchesAvailable, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const { localBranches, remoteBranches, currentBranch } = await handleGetAvailableBranchesInternal()

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
	})

	// ── getWorktreeDefaults ───────────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeDefaults, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const { suggestedBranch, suggestedPath } = await handleGetWorktreeDefaultsInternal()
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
	})

	// ── getWorktreeIncludeStatus ──────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeIncludeStatus, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const worktreeIncludeStatus = await handleGetWorktreeIncludeStatusInternal()
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
	})

	// ── checkBranchWorktreeInclude ────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeBranchIncludeCheck, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { worktreeBranch: string }

		try {
			const branch = payload.worktreeBranch
			if (!branch) {
				await provider.postMessageToWebview({
					type: "branchWorktreeIncludeResult",
					hasWorktreeInclude: false,
					error: "No branch specified",
				})
				return
			}
			const hasWorktreeInclude = await handleCheckBranchWorktreeIncludeInternal(branch)
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
	})

	// ── createWorktreeInclude ─────────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeIncludeCreate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { worktreeIncludeContent: string }

		try {
			const { success, message: text } = await handleCreateWorktreeIncludeInternal(
				payload.worktreeIncludeContent ?? "",
			)

			await provider.postMessageToWebview({ type: "worktreeResult", success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.warn("Error creating worktree include:", errorMessage)
			await provider.postMessageToWebview({ type: "worktreeResult", success: false, text: errorMessage })
		}
	})

	// ── checkoutBranch ────────────────────────────────────────────────
	bus.register(IntentType.SettingsWorktreeBranchCheckout, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { worktreeBranch: string }

		try {
			const { success, message: text } = await handleCheckoutBranchInternal(payload.worktreeBranch)
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
