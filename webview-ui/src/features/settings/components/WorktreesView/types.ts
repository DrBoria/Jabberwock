import type { Worktree, WorktreeIncludeStatus } from "@jabberwock/types"

export interface WorktreesContentProps {
	worktrees: Worktree[]
	isLoading: boolean
	error: string | null
	includeStatus: WorktreeIncludeStatus | null
	isCreatingInclude: boolean
	showWorktreesInHomeScreen: boolean
	showCreateModal: boolean
	deleteWorktree: Worktree | null
	handleToggleShowInHomeScreen: () => void
	setShowCreateModal: (v: boolean) => void
	handleSwitchWorktree: (path: string, newWindow: boolean) => void
	handleCreateWorktreeInclude: () => void
	setDeleteWorktree: (w: Worktree | null) => void
	fetchWorktrees: () => void
	t: (key: string) => string
}

export interface ErrorStateProps {
	t: (key: string) => string
	title: string
	message: string
	extra?: React.ReactNode
}
