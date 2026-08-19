import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

import {
	handleGetAvailableBranchesInternal,
	handleGetWorktreeDefaultsInternal,
	handleGetWorktreeIncludeStatusInternal,
	handleCheckBranchWorktreeIncludeInternal,
	handleCreateWorktreeIncludeInternal,
	handleCheckoutBranchInternal,
} from "./handlers"
import { handleListWorktrees } from "./list-handlers"

export function registerInfoRegistrations(bus: IntentBus): void {
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
}
