import type { WorktreeDefaultsResponse, BranchInfo, WorktreeIncludeStatus } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import type { MessageState } from "./types"

const handleWorktreeDefaults = (message: Record<string, unknown>, st: MessageState): void => {
	const data = message as unknown as WorktreeDefaultsResponse
	st.setDefaults(data)
	st.setBranchName(data.suggestedBranch)
	st.setWorktreePath(data.suggestedPath)
}

const handleBranchList = (message: Record<string, unknown>, st: MessageState): void => {
	const data = message as unknown as BranchInfo
	st.setBranches(data)
	st.setBaseBranch(data.currentBranch || "main")
}

const handleIncludeStatus = (message: Record<string, unknown>, st: MessageState): void => {
	st.setIncludeStatus(message.worktreeIncludeStatus as WorktreeIncludeStatus)
}

const handleFolderSelected = (message: Record<string, unknown>, st: MessageState): void => {
	if (message.path) st.setWorktreePath(message.path as string)
}

const handleCopyProgress = (message: Record<string, unknown>, st: MessageState): void => {
	st.setCopyProgress({
		bytesCopied: (message.copyProgressBytesCopied as number) ?? 0,
		itemName: (message.copyProgressItemName as string) ?? "",
	})
}

const handleWorktreeResult = (message: Record<string, unknown>, st: MessageState): void => {
	st.setIsCreating(false)
	st.setCopyProgress(null)
	if (message.success) {
		if (st.openAfterCreate) rootStore.settings.switchWorktree(st.worktreePath, true)
		st.onSuccess?.()
		st.onClose()
	} else {
		st.setError((message.text as string) || "Unknown error")
	}
}

const MESSAGE_HANDLERS: Record<string, (message: Record<string, unknown>, st: MessageState) => void> = {
	worktreeDefaults: handleWorktreeDefaults,
	branchList: handleBranchList,
	worktreeIncludeStatus: handleIncludeStatus,
	folderSelected: handleFolderSelected,
	worktreeCopyProgress: handleCopyProgress,
	worktreeResult: handleWorktreeResult,
}

export const handleWorktreeMessage = (event: MessageEvent, state: MessageState): void => {
	const handler = MESSAGE_HANDLERS[event.data.type]
	if (handler) handler(event.data as Record<string, unknown>, state)
}
