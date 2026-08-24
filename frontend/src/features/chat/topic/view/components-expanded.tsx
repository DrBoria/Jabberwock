import Thumbnails from "@src/features/foundation/components/ui/display/Thumbnails"
import { TaskActions } from "@/features/chat/task/messages/components/displays/task-actions"
import { Mention } from "@/sections/dndTextArea/mention/mention"
import type { HistoryItem } from "@jabberwock/types"
import { ContextWindowRow, TokensRow, CacheRow, CostRow, SizeRow } from "./components-metrics"

export const MetricsTable = ({
	contextWindow,
	contextTokens,
	maxTokens,
	tokensIn,
	tokensOut,
	cacheReads,
	cacheWrites,
	totalCost,
	aggregatedCost,
	hasSubtasks,
	costBreakdown,
	currentTaskItem,
	condenseButton,
}: {
	contextWindow: number
	contextTokens: number
	maxTokens: number
	tokensIn?: number
	tokensOut?: number
	cacheReads?: number
	cacheWrites?: number
	totalCost?: number
	aggregatedCost?: number
	hasSubtasks: boolean
	costBreakdown?: string
	currentTaskItem?: { size?: number } | null
	condenseButton: React.ReactNode
}) => (
	<div className="pt-3 mt-2 -mx-2.5 px-2.5 border-t border-vscode-sideBar-background">
		<table className="w-full text-sm">
			<tbody>
				{contextWindow > 0 && (
					<ContextWindowRow
						contextWindow={contextWindow}
						contextTokens={contextTokens}
						maxTokens={maxTokens}
						condenseButton={condenseButton}
					/>
				)}
				<TokensRow tokensIn={tokensIn} tokensOut={tokensOut} />
				<CacheRow cacheReads={cacheReads} cacheWrites={cacheWrites} />
				<CostRow
					totalCost={totalCost}
					aggregatedCost={aggregatedCost}
					hasSubtasks={hasSubtasks}
					costBreakdown={costBreakdown}
				/>
				<SizeRow size={currentTaskItem?.size} />
			</tbody>
		</table>
	</div>
)

export const ExpandedContent = ({
	taskText,
	taskImages,
	currentTaskItem,
	buttonsDisabled,
	contextWindow,
	contextTokens,
	maxTokens,
	tokensIn,
	tokensOut,
	cacheReads,
	cacheWrites,
	totalCost,
	aggregatedCost,
	hasSubtasks,
	costBreakdown,
	condenseButton,
}: {
	taskText: string
	taskImages: string[]
	currentTaskItem?: HistoryItem | null
	buttonsDisabled: boolean
	contextWindow: number
	contextTokens: number
	maxTokens: number
	tokensIn?: number
	tokensOut?: number
	cacheReads?: number
	cacheWrites?: number
	totalCost?: number
	aggregatedCost?: number
	hasSubtasks: boolean
	costBreakdown?: string
	condenseButton: React.ReactNode
}) => (
	<>
		<div className="text-vscode-font-size overflow-y-auto break-words break-anywhere relative">
			<div
				className="overflow-auto max-h-80 whitespace-pre-wrap break-words break-anywhere cursor-text py-0.5"
				style={{ display: "-webkit-box", WebkitLineClamp: "unset", WebkitBoxOrient: "vertical" }}>
				<Mention text={taskText} />
			</div>
		</div>
		{taskImages.length > 0 && <Thumbnails images={taskImages} />}
		<div onClick={(e) => e.stopPropagation()}>
			<TaskActions item={currentTaskItem ?? undefined} buttonsDisabled={buttonsDisabled} />
		</div>
		<MetricsTable
			contextWindow={contextWindow}
			contextTokens={contextTokens}
			maxTokens={maxTokens}
			tokensIn={tokensIn}
			tokensOut={tokensOut}
			cacheReads={cacheReads}
			cacheWrites={cacheWrites}
			totalCost={totalCost}
			aggregatedCost={aggregatedCost}
			hasSubtasks={hasSubtasks}
			costBreakdown={costBreakdown}
			currentTaskItem={currentTaskItem}
			condenseButton={condenseButton}
		/>
	</>
)
