import { useTranslation } from "react-i18next"
import { Bot } from "lucide-react"
import { cn } from "@src/lib/utils"
import type { IChatStore } from "@src/features/chat/tree/store"

interface ActiveSubagentsListProps {
	nodes: IChatStore["nodes"]
	currentTaskItemId: string | undefined
	onNavigate: (id: string) => void
}

export const ActiveSubagentsList = ({ nodes, currentTaskItemId, onNavigate }: ActiveSubagentsListProps) => {
	const { t } = useTranslation()
	const childTasks = nodes.get(currentTaskItemId || "")?.childTasks
	if (!childTasks || childTasks.length === 0) return null
	return (
		<div className="mt-3 pt-2 border-t border-vscode-sideBar-border flex flex-col gap-1.5 overflow-hidden">
			<span className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-1">
				{t("chat:task.activeSubagents")}
			</span>
			<div className="flex flex-col gap-1 max-h-32 overflow-y-auto scrollable pr-1">
				{childTasks
					.filter((c): c is NonNullable<typeof c> => c != null)
					.map((child) => (
						<div
							key={child.id}
							onClick={(e) => {
								e.stopPropagation()
								onNavigate(child.id)
							}}
							className="flex items-center justify-between p-2 rounded-lg bg-vscode-sideBarSectionHeader-background hover:bg-vscode-toolbar-hoverBackground cursor-pointer transition-colors group/child">
							<div className="flex items-center gap-2 min-w-0">
								<div className="p-1 bg-vscode-badge-background rounded group-hover/child:bg-vscode-focusBorder group-hover/child:text-white transition-colors">
									<Bot size={12} />
								</div>
								<div className="flex flex-col min-w-0">
									<span className="text-[11px] font-semibold truncate leading-tight italic opacity-90">
										{child.mode || "Agent"}
									</span>
									<span className="text-[10px] truncate opacity-60 leading-tight">
										{child.title || "Working..."}
									</span>
								</div>
							</div>
							<div
								className={cn(
									"text-[9px] px-1.5 py-0.5 rounded-full border border-current opacity-60",
									child.status === "in_progress" && "text-vscode-charts-yellow",
									child.status === "completed" && "text-vscode-charts-green",
									child.status === "failed" && "text-vscode-charts-red",
								)}>
								{child.status}
							</div>
						</div>
					))}
			</div>
		</div>
	)
}
