import type { Goal } from "@jabberwock/types"
import { ChevronUp, ChevronDown } from "lucide-react"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface TaskCardHeaderProps {
	isTaskExpanded: boolean
	setIsTaskExpanded: (v: boolean) => void
	goals: Goal[]
	taskText: string
	t: (key: string) => string
}

export const TaskCardHeader = ({ isTaskExpanded, setIsTaskExpanded, goals, taskText, t }: TaskCardHeaderProps) => (
	<div className="flex justify-between items-center gap-0">
		<div className="flex items-center select-none grow min-w-0">
			<div className="grow min-w-0">
				{isTaskExpanded && <span className="font-bold">{t("chat:task.title")}</span>}
				{!isTaskExpanded && (
					<div className="flex items-center gap-1.5 overflow-hidden min-w-0">
						{goals.length > 0 ? (
							goals.map((goal, index) => (
								<span
									key={goal.id}
									className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-full bg-vscode-input-background border border-vscode-sideBar-border shrink-0 max-w-[18ch]">
									<span className="font-medium text-vscode-textLink-foreground shrink-0">
										{index + 1}
									</span>
									<span className="truncate">{goal.text}</span>
								</span>
							))
						) : (
							<span className="truncate text-sm text-vscode-foreground opacity-70">{taskText}</span>
						)}
					</div>
				)}
			</div>
			<div className="flex items-center shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
				<StandardTooltip content={isTaskExpanded ? t("chat:task.collapse") : t("chat:task.expand")}>
					<button
						onClick={() => setIsTaskExpanded(!isTaskExpanded)}
						className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
						{isTaskExpanded ? (
							<ChevronUp size={16} />
						) : (
							<ChevronDown size={16} className="opacity-0 group-hover:opacity-100" />
						)}
					</button>
				</StandardTooltip>
			</div>
		</div>
	</div>
)
