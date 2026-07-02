import { GitBranch, Folder, Lock, SquareArrowOutUpRight, Trash } from "lucide-react"
import { Button } from "@src/shared/ui/buttons/button"
import { Badge } from "@src/shared/ui/displays/badge"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import type { Worktree } from "@jabberwock/types"

interface WorktreeListItemProps {
	worktree: Worktree
	handleSwitchWorktree: (path: string, newWindow: boolean) => void
	setDeleteWorktree: (w: Worktree | null) => void
	t: (key: string) => string
}

export const WorktreeListItem = ({ worktree, handleSwitchWorktree, setDeleteWorktree, t }: WorktreeListItemProps) => (
	<div
		className={`p-2.5 px-3.5 rounded-xl hover:bg-vscode-list-hoverBackground border border-transparent ${worktree.isCurrent ? " bg-vscode-list-activeSelectionBackground border-vscode-list-activeSelectionForeground/20" : "cursor-pointer"}`}
		onClick={worktree.isCurrent ? undefined : () => handleSwitchWorktree(worktree.path, false)}>
		<div className="flex items-start min-[400px]:items-center justify-between gap-2 flex-col min-[400px]:flex-row overflow-hidden">
			<div className={`flex-1 min-w-0 ${worktree.isCurrent && "cursor-default"}`}>
				<div className="flex items-center gap-2 overflow-hidden">
					<GitBranch className="size-3 shrink-0" />
					<span className="font-medium truncate">
						{worktree.branch ||
							(worktree.isDetached ? t("worktrees:detachedHead") : t("worktrees:noBranch"))}
					</span>
					{worktree.isBare && (
						<Badge className="text-[0.7em] -mt-0.25 py-0.5">{t("worktrees:primary")}</Badge>
					)}
					{worktree.isLocked && (
						<StandardTooltip content={worktree.lockReason || t("worktrees:locked")}>
							<Lock className="text-vscode-charts-yellow" />
						</StandardTooltip>
					)}
				</div>
				<div className="flex gap-2 text-xs text-vscode-descriptionForeground mt-1">
					<Folder className="size-3 shrink-0 mt-0.5" />
					<span className="truncate">{worktree.path}</span>
				</div>
			</div>
			<div className="flex items-center gap-1 ml-3 min-[400px]:ml-0 flex-shrink-0">
				<StandardTooltip content={t("worktrees:openInNewWindow")}>
					<Button
						variant="ghost"
						size="icon"
						disabled={worktree.isCurrent}
						onClick={(e) => {
							e.stopPropagation()
							handleSwitchWorktree(worktree.path, true)
						}}>
						<SquareArrowOutUpRight />
					</Button>
				</StandardTooltip>
				<StandardTooltip content={t("worktrees:delete")}>
					<Button
						variant="ghost"
						size="icon"
						disabled={worktree.isCurrent || worktree.isBare}
						onClick={(e) => {
							e.stopPropagation()
							setDeleteWorktree(worktree)
						}}>
						<Trash className="text-destructive" />
					</Button>
				</StandardTooltip>
			</div>
		</div>
	</div>
)
