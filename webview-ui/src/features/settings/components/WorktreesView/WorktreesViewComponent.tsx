import { useAppTranslation } from "@/i18n/TranslationContext"
import { useWorktreesView } from "./useWorktreesView"
import { ErrorState } from "./ErrorState"
import { WorktreesContent } from "./WorktreesContent"

export const WorktreesView = () => {
	const { t } = useAppTranslation()
	const {
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
	} = useWorktreesView()

	if (!isGitRepo) {
		return <ErrorState t={t} title={t("worktrees:description")} message={t("worktrees:notGitRepo")} />
	}
	if (isMultiRoot) {
		return <ErrorState t={t} title={t("worktrees:description")} message={t("worktrees:multiRootNotSupported")} />
	}
	if (isSubfolder) {
		return (
			<ErrorState
				t={t}
				title={t("worktrees:description")}
				message={t("worktrees:subfolderNotSupported")}
				extra={
					<p>
						{t("worktrees:gitRoot")}:{" "}
						<code className="bg-vscode-input-background p-1 rounded-md">{gitRootPath}</code>
					</p>
				}
			/>
		)
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<WorktreesContent
				worktrees={worktrees}
				isLoading={isLoading}
				error={error}
				includeStatus={includeStatus}
				isCreatingInclude={isCreatingInclude}
				showWorktreesInHomeScreen={showWorktreesInHomeScreen}
				showCreateModal={showCreateModal}
				deleteWorktree={deleteWorktree}
				handleToggleShowInHomeScreen={handleToggleShowInHomeScreen}
				setShowCreateModal={setShowCreateModal}
				handleSwitchWorktree={handleSwitchWorktree}
				handleCreateWorktreeInclude={handleCreateWorktreeInclude}
				setDeleteWorktree={setDeleteWorktree}
				fetchWorktrees={fetchWorktrees}
				t={t}
			/>
		</div>
	)
}
