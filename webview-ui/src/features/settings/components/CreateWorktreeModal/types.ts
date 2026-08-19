import type { WorktreeDefaultsResponse, BranchInfo, WorktreeIncludeStatus } from "@jabberwock/types"

export interface CreateWorktreeModalProps {
	open: boolean
	onClose: () => void
	openAfterCreate?: boolean
	onSuccess?: () => void
}

export type MessageState = {
	setDefaults: (data: WorktreeDefaultsResponse) => void
	setBranchName: (name: string) => void
	setWorktreePath: (path: string) => void
	setBranches: (data: BranchInfo) => void
	setBaseBranch: (branch: string) => void
	setIncludeStatus: (status: WorktreeIncludeStatus) => void
	setCopyProgress: (progress: { bytesCopied: number; itemName: string } | null) => void
	setIsCreating: (creating: boolean) => void
	setError: (error: string | null) => void
	openAfterCreate: boolean
	worktreePath: string
	onSuccess: (() => void) | undefined
	onClose: () => void
}
