import React from "react"
import { ListTree } from "lucide-react"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui/standard-tooltip"
import { LucideIconButton } from "../LucideIconButton"

interface ChildNode {
	id: string
	mode?: string
	status?: string
	title?: string
	children?: string[]
}

export interface NavigationTriggersProps {
	currentNodeId: string | undefined
	nodes: Map<string, ChildNode>
	onNavigateToNode: (nodeId: string) => void
	onOpenHierarchy: () => void
}

/**
 * Renders floating navigation buttons for child task nodes.
 * Shows agent initials as circular buttons with status indicators.
 */
import { Container } from "@src/components/ui"
export const NavigationTriggers: React.FC<NavigationTriggersProps> = ({
	currentNodeId,
	nodes,
	onNavigateToNode,
	onOpenHierarchy,
}) => {
	if (!currentNodeId) return null

	const node = nodes.get(currentNodeId)
	if (!node || !node.children || node.children.length === 0) return null

	const hasDeepNesting = node.children.some((childId) => {
		const child = nodes.get(childId)
		return child && child.children && child.children.length > 0
	})

	return (
		<Container
			preset="col"
			p="0"
			gap="8px"
			style={{
				position: "absolute",
				right: "8px",
				top: "50%",
				transform: "translateY(-50%)",
				zIndex: 40,
				scale: "0.9",
				transformOrigin: "right center",
			}}>
			{hasDeepNesting && (
				<LucideIconButton
					title="Show Task Hierarchy"
					icon={ListTree}
					onClick={onOpenHierarchy}
					className="bg-vscode-button-background text-vscode-button-foreground shadow-lg hover:bg-vscode-button-hoverBackground transition-all transform hover:scale-110 mb-2"
				/>
			)}

			{node.children.map((childId) => {
				const child = nodes.get(childId)
				if (!child) return null
				const agentInitial = (child.mode || "A").charAt(0).toUpperCase()

				return (
					<StandardTooltip
						key={childId}
						content={
							<Container preset="col" p="0" gap="4px" style={{ maxWidth: "200px" }}>
								<Container
									preset="row"
									p="0"
									gap="8px"
									style={{
										fontWeight: "bold",
										alignItems: "center",
										justifyContent: "space-between",
									}}>
									<span className="truncate">{child.mode || "Agent"}</span>
									<span
										className={cn(
											"text-[9px] px-1.5 py-0.5 rounded-full border border-current",
											child.status === "in_progress" &&
												"text-vscode-charts-yellow border-vscode-charts-yellow",
											child.status === "completed" &&
												"text-vscode-charts-green border-vscode-charts-green",
											child.status === "failed" &&
												"text-vscode-charts-red border-vscode-charts-red",
										)}>
										{child.status}
									</span>
								</Container>
								<div className="text-[11px] opacity-80 leading-normal line-clamp-2">{child.title}</div>
								<div className="text-[9px] opacity-50 italic mt-1 font-mono">Click to jump to chat</div>
							</Container>
						}>
						<div
							onClick={(e) => {
								e.stopPropagation()
								onNavigateToNode(childId)
							}}
							className={cn(
								"w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all shadow-md border-2 border-transparent hover:scale-110 active:scale-95 z-50",
								child.status === "in_progress"
									? "bg-vscode-button-background text-vscode-button-foreground animate-pulse border-vscode-charts-yellow/50"
									: "bg-vscode-sideBar-background text-vscode-foreground opacity-90",
								child.status === "completed" && "bg-vscode-charts-green text-white",
								child.status === "failed" && "bg-vscode-charts-red text-white",
							)}>
							{agentInitial}
						</div>
					</StandardTooltip>
				)
			})}
		</Container>
	)
}
