import { Button } from "@src/shared/ui/buttons/button"
import { ToggleSwitch } from "@src/shared/ui/buttons/toggle-switch"
import { SectionHeader } from "@src/features/settings/components/shared/SectionHeader"
import { CreateWorktreeModal } from "../CreateWorktreeModal/CreateWorktreeModalComponent"
import { DeleteWorktreeModal } from "../WorktreesView/DeleteWorktreeModal"
import { Plus } from "lucide-react"
import type { WorktreesContentProps } from "./types"
import { WorktreeListItem } from "./WorktreeListItem"

export const WorktreesContent = ({
	worktrees,
	isLoading,
	error,
	includeStatus,
	isCreatingInclude,
	showWorktreesInHomeScreen,
	showCreateModal,
	deleteWorktree,
	handleToggleShowInHomeScreen,
	setShowCreateModal,
	handleSwitchWorktree,
	handleCreateWorktreeInclude,
	setDeleteWorktree,
	fetchWorktrees,
	t,
}: WorktreesContentProps) => (
	<>
		<div className="flex-shrink-0">
			<SectionHeader>{t("worktrees:title")}</SectionHeader>
			<div className="flex flex-col gap-2 px-5 py-2">
				<p className="text-vscode-descriptionForeground text-sm m-0">{t("worktrees:description")}</p>
				<label
					className="flex cursor-pointer items-center gap-2 text-sm text-vscode-descriptionForeground"
					onClick={handleToggleShowInHomeScreen}>
					<ToggleSwitch checked={showWorktreesInHomeScreen} onChange={handleToggleShowInHomeScreen} />
					<span>{t("worktrees:showInHomeScreen")}</span>
				</label>
				<Button variant="secondary" className="py-1" onClick={() => setShowCreateModal(true)}>
					<Plus />
					{t("worktrees:newWorktree")}
				</Button>
			</div>
		</div>
		<div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
			{isLoading ? (
				<div className="flex items-center justify-center h-48">
					<span className="codicon codicon-loading codicon-modifier-spin text-2xl" />
				</div>
			) : error ? (
				<div className="flex flex-col items-center justify-center h-48 text-vscode-errorForeground">
					<span className="codicon codicon-error text-4xl mb-4" />
					<p className="text-center">{error}</p>
				</div>
			) : (
				<div className="flex flex-col gap-1">
					{worktrees.map((worktree) => (
						<WorktreeListItem
							key={worktree.path}
							worktree={worktree}
							handleSwitchWorktree={handleSwitchWorktree}
							setDeleteWorktree={setDeleteWorktree}
							t={t}
						/>
					))}
				</div>
			)}
		</div>
		<div className="flex-shrink-0 flex flex-col border-t border-vscode-sideBar-background">
			{includeStatus && (
				<div className="flex items-center gap-2 text-sm px-5 py-3 justify-between text-vscode-descriptionForeground border-t border-vscode-sideBar-background">
					{includeStatus.exists ? (
						<span>{t("worktrees:includeFileExists")}</span>
					) : (
						<>
							<span>{t("worktrees:noIncludeFile")}</span>
							{includeStatus.hasGitignore && (
								<Button
									variant="secondary"
									size="sm"
									onClick={handleCreateWorktreeInclude}
									disabled={isCreatingInclude}>
									{t("worktrees:createFromGitignore")}
								</Button>
							)}
						</>
					)}
				</div>
			)}
		</div>
		{showCreateModal && (
			<CreateWorktreeModal
				open={showCreateModal}
				onClose={() => setShowCreateModal(false)}
				onSuccess={() => {
					setShowCreateModal(false)
					fetchWorktrees()
				}}
			/>
		)}
		{deleteWorktree && (
			<DeleteWorktreeModal
				open={!!deleteWorktree}
				onClose={() => setDeleteWorktree(null)}
				worktree={deleteWorktree}
				onSuccess={() => {
					setDeleteWorktree(null)
					fetchWorktrees()
				}}
			/>
		)}
	</>
)
