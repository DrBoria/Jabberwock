import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import {
	handleGetAvailableBranchesInternal,
	handleGetWorktreeDefaultsInternal,
	handleGetWorktreeIncludeStatusInternal,
	handleCheckBranchWorktreeIncludeInternal,
	handleCreateWorktreeIncludeInternal,
	handleCheckoutBranchInternal,
} from "./handlers"
import { handleListWorktrees } from "./list"
import {
	sendBranchList,
	sendBranchWorktreeIncludeResult,
	sendWorktreeDefaults,
	sendWorktreeIncludeStatus,
	sendWorktreeList,
	sendWorktreeResult,
} from "@features/settings"

function registerInfoRegistrationsSettingsWorktreeList(bus: IntentBus): void {
	bus.register(IntentType.SettingsWorktreeList, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const { worktrees, isGitRepo, isMultiRoot, isSubfolder, gitRootPath, error } = await handleListWorktrees()

			await sendWorktreeList(provider, { worktrees, isGitRepo, isMultiRoot, isSubfolder, gitRootPath, error })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await sendWorktreeList(provider, {
				worktrees: [],
				isGitRepo: false,
				isMultiRoot: false,
				isSubfolder: false,
				gitRootPath: "",
				error: errorMessage,
			})
		}
	})
}

function registerInfoRegistrationsSettingsWorktreeBranchesAvailable(bus: IntentBus): void {
	bus.register(IntentType.SettingsWorktreeBranchesAvailable, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const { localBranches, remoteBranches, currentBranch } = await handleGetAvailableBranchesInternal()

			await sendBranchList(provider, { localBranches, remoteBranches, currentBranch })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await sendBranchList(provider, {
				localBranches: [],
				remoteBranches: [],
				currentBranch: "",
				error: errorMessage,
			})
		}
	})
}

function registerInfoRegistrationsSettingsWorktreeDefaults(bus: IntentBus): void {
	bus.register(IntentType.SettingsWorktreeDefaults, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const { suggestedBranch, suggestedPath } = await handleGetWorktreeDefaultsInternal()
			await sendWorktreeDefaults(provider, { suggestedBranch, suggestedPath })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await sendWorktreeDefaults(provider, { suggestedBranch: "", suggestedPath: "", error: errorMessage })
		}
	})
}

function registerInfoRegistrationsSettingsWorktreeIncludeStatus(bus: IntentBus): void {
	bus.register(IntentType.SettingsWorktreeIncludeStatus, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const worktreeIncludeStatus = await handleGetWorktreeIncludeStatusInternal()
			await sendWorktreeIncludeStatus(provider, { worktreeIncludeStatus })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await sendWorktreeIncludeStatus(provider, {
				worktreeIncludeStatus: {
					exists: false,
					hasGitignore: false,
					gitignoreContent: undefined,
				},
				error: errorMessage,
			})
		}
	})
}

function registerInfoRegistrationsSettingsWorktreeBranchIncludeCheck(bus: IntentBus): void {
	bus.register(IntentType.SettingsWorktreeBranchIncludeCheck, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { worktreeBranch: string }

		try {
			const branch = payload.worktreeBranch
			if (!branch) {
				await sendBranchWorktreeIncludeResult(provider, {
					hasWorktreeInclude: false,
					error: "No branch specified",
				})
				return
			}
			const hasWorktreeInclude = await handleCheckBranchWorktreeIncludeInternal(branch)
			await sendBranchWorktreeIncludeResult(provider, { branch, hasWorktreeInclude })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await sendBranchWorktreeIncludeResult(provider, { hasWorktreeInclude: false, error: errorMessage })
		}
	})
}

function registerInfoRegistrationsSettingsWorktreeIncludeCreate(bus: IntentBus): void {
	bus.register(IntentType.SettingsWorktreeIncludeCreate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { worktreeIncludeContent: string }

		try {
			const { success, message: text } = await handleCreateWorktreeIncludeInternal(
				payload.worktreeIncludeContent ?? "",
			)

			await sendWorktreeResult(provider, { success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.warn("Error creating worktree include:", errorMessage)
			await sendWorktreeResult(provider, { success: false, text: errorMessage })
		}
	})
}

function registerInfoRegistrationsSettingsWorktreeBranchCheckout(bus: IntentBus): void {
	bus.register(IntentType.SettingsWorktreeBranchCheckout, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { worktreeBranch: string }

		try {
			const { success, message: text } = await handleCheckoutBranchInternal(payload.worktreeBranch)
			await sendWorktreeResult(provider, { success, text })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await sendWorktreeResult(provider, { success: false, text: errorMessage })
		}
	})
}

export function registerInfoRegistrations(_bus: IntentBus): void {
	registerInfoRegistrationsSettingsWorktreeList(_bus)
	registerInfoRegistrationsSettingsWorktreeBranchesAvailable(_bus)
	registerInfoRegistrationsSettingsWorktreeDefaults(_bus)
	registerInfoRegistrationsSettingsWorktreeIncludeStatus(_bus)
	registerInfoRegistrationsSettingsWorktreeBranchIncludeCheck(_bus)
	registerInfoRegistrationsSettingsWorktreeIncludeCreate(_bus)
	registerInfoRegistrationsSettingsWorktreeBranchCheckout(_bus)
}
