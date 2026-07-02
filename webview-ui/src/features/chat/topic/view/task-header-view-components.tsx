import type { Instance } from "mobx-state-tree"
import type { TaskNode } from "@/features/chat/tree/store"
import { cn } from "@/lib/utils"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { ArrowLeft, Bot } from "lucide-react"
import { useCallback } from "react"
import DismissibleUpsell from "@src/features/foundation/components/ui/display/DismissibleUpsell"
import { Mention } from "@/sections/dndTextArea/mention/mention"
import { TokenPercentage, ContextWindowTooltipContent, CostSection, ExpandButton } from "./components"

export const TaskCardHeader = ({
	isTaskExpanded,
	setIsTaskExpanded,
	taskText,
}: {
	isTaskExpanded: boolean
	setIsTaskExpanded: (v: ((prev: boolean) => boolean) | boolean) => void
	taskText: string
}) => (
	<div className="flex justify-between items-center gap-0">
		<div className="flex items-center select-none grow min-w-0">
			<div className="grow min-w-0">
				{isTaskExpanded && <span className="font-bold">Task</span>}
				{!isTaskExpanded && (
					<div className="flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis">
						<Mention text={taskText} />
					</div>
				)}
			</div>
			<div className="flex items-center shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
				<StandardTooltip content={isTaskExpanded ? "Collapse" : "Expand"}>
					<ExpandButton isExpanded={isTaskExpanded} onToggle={() => setIsTaskExpanded((v) => !v)} />
				</StandardTooltip>
			</div>
		</div>
	</div>
)

export const CollapsedContextBar = ({
	contextWindow,
	contextTokens,
	reservedForOutput,
	totalCost,
	aggregatedCost,
	hasSubtasks,
	costBreakdown,
}: {
	contextWindow: number
	contextTokens: number
	reservedForOutput: number
	totalCost?: number
	aggregatedCost?: number
	hasSubtasks: boolean
	costBreakdown?: string
}) => (
	<div
		className="flex items-center justify-between text-sm text-muted-foreground/70"
		onClick={(e) => e.stopPropagation()}>
		<div className="flex items-center gap-2">
			<StandardTooltip
				content={
					<ContextWindowTooltipContent
						contextWindow={contextWindow}
						contextTokens={contextTokens}
						reservedForOutput={reservedForOutput}
					/>
				}
				side="top"
				sideOffset={8}>
				<span className="flex items-center gap-1.5">
					<TokenPercentage
						contextWindow={contextWindow}
						contextTokens={contextTokens}
						reservedForOutput={reservedForOutput}
					/>
				</span>
			</StandardTooltip>
			<CostSection
				totalCost={totalCost}
				aggregatedCost={aggregatedCost}
				hasSubtasks={hasSubtasks}
				costBreakdown={costBreakdown}
			/>
		</div>
	</div>
)

export const BackToParentButton = ({ isSubtask, onBack }: { isSubtask: boolean; onBack: () => void }) => {
	if (!isSubtask) return null
	return (
		<div className="mb-2" onClick={(e) => e.stopPropagation()}>
			<Button
				variant="link"
				size="sm"
				onClick={onBack}
				className="flex items-center gap-1.5 p-0 h-auto text-xs text-vscode-textLink-foreground hover:brightness-125 transition-all">
				<ArrowLeft className="size-3" />
				Back to Parent Task
			</Button>
		</div>
	)
}

export const LongRunningBanner = ({
	show,
	isComplete,
	onAction,
}: {
	show: boolean
	isComplete: boolean
	onAction: () => void
}) => {
	if (!show || isComplete) return null
	return (
		<DismissibleUpsell
			upsellId="longRunningTask"
			onClick={() => onAction()}
			dismissOnClick={false}
			variant="banner">
			Long-running task detected
		</DismissibleUpsell>
	)
}

export const borderClass = (hasTodos: boolean): string | undefined => (hasTodos ? "border-b-0" : undefined)

type PushWindowFn = (
	type:
		| "chat"
		| "history"
		| "settings"
		| "marketplace"
		| "cloud"
		| "async_task"
		| "interactive_mcp"
		| "task_hierarchy",
	params?: Record<string, unknown>,
) => void

export const ChildAgentRow = ({
	child,
	pushWindow,
}: {
	child: { id: string; title: string; mode: string; status: string }
	pushWindow: PushWindowFn
}) => {
	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			pushWindow("chat", { targetNodeId: child.id })
		},
		[child.id, pushWindow],
	)
	const statusClass = cn(
		"text-[9px] px-1.5 py-0.5 rounded-full border border-current opacity-60",
		child.status === "in_progress" && "text-vscode-charts-yellow",
		child.status === "completed" && "text-vscode-charts-green",
		child.status === "failed" && "text-vscode-charts-red",
	)
	return (
		<div
			onClick={handleClick}
			className="flex items-center justify-between p-2 rounded-lg bg-vscode-sideBarSectionHeader-background hover:bg-vscode-toolbar-hoverBackground cursor-pointer transition-colors group/child">
			<div className="flex items-center gap-2 min-w-0">
				<div className="p-1 bg-vscode-badge-background rounded group-hover/child:bg-vscode-focusBorder group-hover/child:text-white transition-colors">
					<Bot size={12} />
				</div>
				<div className="flex flex-col min-w-0">
					<span className="text-[11px] font-semibold truncate leading-tight italic opacity-90">
						{child.mode || "Agent"}
					</span>
					<span className="text-[10px] truncate opacity-60 leading-tight">{child.title || "Working..."}</span>
				</div>
			</div>
			<div className={statusClass}>{child.status}</div>
		</div>
	)
}

export const ActiveSubAgents = ({
	nodes,
	currentTaskId,
	pushWindow,
}: {
	nodes: Map<string, Instance<typeof TaskNode>>
	currentTaskId?: string
	pushWindow: PushWindowFn
}) => {
	const node = currentTaskId ? nodes.get(currentTaskId) : undefined
	const childTasks = node?.childTasks
	if (!childTasks || childTasks.length === 0) return null
	return (
		<div className="mt-3 pt-2 border-t border-vscode-sideBar-border flex flex-col gap-1.5 overflow-hidden">
			<span className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-1">Active Subagents</span>
			<div className="flex flex-col gap-1 max-h-32 overflow-y-auto scrollable pr-1">
				{childTasks
					.filter((c): c is NonNullable<typeof c> => c != null)
					.map((child) => (
						<ChildAgentRow key={child.id} child={child} pushWindow={pushWindow} />
					))}
			</div>
		</div>
	)
}
