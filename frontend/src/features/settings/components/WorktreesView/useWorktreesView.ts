import { useState, useEffect, useCallback } from "react"
import type { Worktree, WorktreeListResponse, WorktreeIncludeStatus } from "@jabberwock/types"
import { rootStore } from "@src/features/store"

export const useWorktreesView = () => {
	const showWorktreesInHomeScreen = rootStore.extensionState.showWorktreesInHomeScreen ?? true
	const setShowWorktreesInHomeScreen = useCallback(
		(value: boolean) => rootStore.setShowWorktreesInHomeScreen(value),
		[],
	)
	const [worktrees, setWorktrees] = useState<Worktree[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [isGitRepo, setIsGitRepo] = useState(true)
	const [isMultiRoot, setIsMultiRoot] = useState(false)
	const [isSubfolder, setIsSubfolder] = useState(false)
	const [gitRootPath, setGitRootPath] = useState("")
	const [includeStatus, setIncludeStatus] = useState<WorktreeIncludeStatus | null>(null)
	const [isCreatingInclude, setIsCreatingInclude] = useState(false)
	const [showCreateModal, setShowCreateModal] = useState(false)
	const [deleteWorktree, setDeleteWorktree] = useState<Worktree | null>(null)
	const fetchWorktrees = useCallback(() => rootStore.settings.listWorktrees(), [])
	const fetchIncludeStatus = useCallback(() => rootStore.settings.getWorktreeIncludeStatus(), [])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			switch (message.type) {
				case "worktreeList": {
					const response: WorktreeListResponse = message
					setWorktrees(response.worktrees || [])
					setIsGitRepo(response.isGitRepo)
					setIsMultiRoot(response.isMultiRoot)
					setIsSubfolder(response.isSubfolder)
					setGitRootPath(response.gitRootPath)
					setError(response.error || null)
					setIsLoading(false)
					break
				}
				case "worktreeIncludeStatus": {
					setIncludeStatus(message.worktreeIncludeStatus)
					break
				}
				case "worktreeResult": {
					fetchWorktrees()
					fetchIncludeStatus()
					setIsCreatingInclude(false)
					break
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [fetchWorktrees, fetchIncludeStatus])

	useEffect(() => {
		fetchWorktrees()
		fetchIncludeStatus()
		const interval = setInterval(fetchWorktrees, 3000)
		return () => clearInterval(interval)
	}, [fetchWorktrees, fetchIncludeStatus])

	const handleCreateWorktreeInclude = useCallback(() => {
		if (!includeStatus?.gitignoreContent) return
		setIsCreatingInclude(true)
		rootStore.settings.createWorktreeInclude(includeStatus.gitignoreContent)
		setTimeout(() => {
			fetchIncludeStatus()
			setIsCreatingInclude(false)
		}, 500)
	}, [includeStatus, fetchIncludeStatus])

	const handleSwitchWorktree = useCallback(
		(worktreePath: string, newWindow: boolean) => rootStore.settings.switchWorktree(worktreePath, newWindow),
		[],
	)
	const handleToggleShowInHomeScreen = useCallback(() => {
		const newValue = !showWorktreesInHomeScreen
		setShowWorktreesInHomeScreen(newValue)
		rootStore.settings.updateSettings({ showWorktreesInHomeScreen: newValue })
	}, [showWorktreesInHomeScreen, setShowWorktreesInHomeScreen])

	return {
		worktrees,
		isLoading,
		error,
		isGitRepo,
		isMultiRoot,
		isSubfolder,
		gitRootPath,
		includeStatus,
		isCreatingInclude,
		showCreateModal,
		showWorktreesInHomeScreen,
		deleteWorktree,
		setShowCreateModal,
		setDeleteWorktree,
		handleToggleShowInHomeScreen,
		handleSwitchWorktree,
		handleCreateWorktreeInclude,
		fetchWorktrees,
	}
}
