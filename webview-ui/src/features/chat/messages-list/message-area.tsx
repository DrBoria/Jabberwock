import React from "react"
import { Container } from "@src/components/ui/Container"
import { observer } from "mobx-react-lite"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import type { ClineMessage } from "@jabberwock/types"
import { Activity } from "lucide-react"
import ChatRow from "./row/view"
import { AskResponder } from "./ask-responder"
import { NavigationTriggers } from "./keyboard-shortcuts"
import TaskHeader from "../topic/view"
import FileChangesPanel from "./file-changes-panel"
import { CheckpointWarning } from "../notifications/checkpoint/checkpoint-warning"
import { DiagnosticDashboard } from "@jabberwock/devtool/react"
import { useChatUI } from "@src/features/chat/store"
import { useChatTree } from "@src/features/chat/messages-list/store"

interface ChildNode {
	id: string
	mode?: string
	status?: string
	title?: string
	children?: string[]
}

export interface ChatAreaProps {
	task: ClineMessage
	taskTs: number | undefined
	messages: ClineMessage[]
	groupedMessages: ClineMessage[]
	modifiedMessages: ClineMessage[]
	isStreaming: boolean
	isFollowUpAutoApprovalPaused: boolean
	isNested: boolean
	enableButtons: boolean
	primaryButtonText: string | undefined
	secondaryButtonText: string | undefined
	showScrollToBottom: boolean
	diagnostics: any
	apiMetrics: {
		totalTokensIn: number
		totalTokensOut: number
		totalCacheWrites?: number
		totalCacheReads?: number
		totalCost: number
		contextTokens: number
	}
	latestTodos: any[]
	handleCondenseContext: (taskId: string) => void
	onRowHeightChange: (isTaller: boolean) => void
	onSuggestionClick: (suggestion: any, event?: React.MouseEvent) => void
	onBatchFileResponse: (response: { [key: string]: boolean }) => void
	onFollowUpUnmount: () => void
	onPrimaryClick: () => void
	onSecondaryClick: () => void
	onScrollToBottom: () => void
	followOutputCallback: () => "auto" | false
	atBottomStateChangeCallback: (isAtBottom: boolean) => void
	virtuosoRef: React.RefObject<VirtuosoHandle | null>
	scrollContainerRef: React.RefObject<HTMLDivElement | null>
	parentNode: any
}

const ChatAreaComponent: React.FC<ChatAreaProps> = ({
	task,
	taskTs,
	messages,
	groupedMessages,
	modifiedMessages,
	isStreaming,
	isFollowUpAutoApprovalPaused,
	isNested,
	enableButtons,
	primaryButtonText,
	secondaryButtonText,
	showScrollToBottom,
	diagnostics,
	apiMetrics,
	latestTodos,
	handleCondenseContext,
	onRowHeightChange,
	onSuggestionClick,
	onBatchFileResponse,
	onFollowUpUnmount,
	onPrimaryClick,
	onSecondaryClick,
	onScrollToBottom,
	followOutputCallback,
	atBottomStateChangeCallback,
	virtuosoRef,
	scrollContainerRef,
	parentNode,
}) => {
	const ui = useChatUI()
	const tree = useChatTree()
	const currentNodeId = tree.activeNodeId?.id
	const nodes = tree.nodes as unknown as Map<string, ChildNode>

	const itemContent = (index: number, messageOrGroup: ClineMessage) => {
		const hasCheckpoint = modifiedMessages.some((m) => m.say === "checkpoint_saved")
		return (
			<ChatRow
				key={`${messageOrGroup.ts}-${index}`}
				message={messageOrGroup}
				lastModifiedMessage={modifiedMessages.at(-1)}
				isLast={index === groupedMessages.length - 1}
				onHeightChange={onRowHeightChange}
				isStreaming={isStreaming}
				onSuggestionClick={onSuggestionClick}
				onBatchFileResponse={onBatchFileResponse}
				onFollowUpUnmount={onFollowUpUnmount}
				isFollowUpAutoApprovalPaused={isFollowUpAutoApprovalPaused}
				isNested={isNested}
				editable={
					messageOrGroup.type === "ask" &&
					messageOrGroup.ask === "tool" &&
					(() => {
						let tool: any = {}
						try {
							tool = JSON.parse(messageOrGroup.text || "{}")
						} catch {
							if (messageOrGroup.text?.includes("updateTodoList")) tool = { tool: "updateTodoList" }
						}
						return tool.tool === "updateTodoList" && enableButtons && !!primaryButtonText
					})()
				}
				hasCheckpoint={hasCheckpoint}
			/>
		)
	}

	return (
		<>
			<DiagnosticDashboard diagnostics={diagnostics} isStreaming={isStreaming} />
			<TaskHeader
				task={task}
				tokensIn={apiMetrics.totalTokensIn}
				tokensOut={apiMetrics.totalTokensOut}
				cacheWrites={apiMetrics.totalCacheWrites ?? 0}
				cacheReads={apiMetrics.totalCacheReads ?? 0}
				totalCost={apiMetrics.totalCost}
				aggregatedCost={
					currentNodeId && ui.aggregatedCostsMap.has(currentNodeId)
						? ui.aggregatedCostsMap.get(currentNodeId)!.totalCost
						: undefined
				}
				hasSubtasks={
					!!(
						currentNodeId &&
						ui.aggregatedCostsMap.has(currentNodeId) &&
						ui.aggregatedCostsMap.get(currentNodeId)!.childrenCost > 0
					)
				}
				parentTaskId={undefined}
				nodeTitle={undefined}
				costBreakdown={undefined}
				contextTokens={apiMetrics.contextTokens}
				buttonsDisabled={ui.sendingDisabled}
				handleCondenseContext={handleCondenseContext}
				todos={latestTodos}
			/>
			{parentNode && (
				<div
					id="parent-conversation-context"
					className="mt-4 pt-4 border-t border-vscode-sideBar-border opacity-60">
					<Container className="text-[10px] uppercase font-bold tracking-wider mb-2 text-vscode-descriptionForeground flex items-center gap-1">
						<Activity size={10} /> Inherited Parent Context
					</Container>
					<Container className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2">
						{parentNode.messages.map((msg: any, i: number) => (
							<div
								key={`${msg.ts}-${i}`}
								className="text-[11px] font-mono whitespace-pre-wrap break-words p-1 rounded bg-vscode-editor-background">
								<span className="opacity-50 mr-1">[{msg.role}]</span>
								{msg.text || (msg.content && JSON.stringify(msg.content))}
							</div>
						))}
					</Container>
				</div>
			)}
			{ui.checkpointWarning && (
				<div className="px-3">
					<CheckpointWarning
						warning={ui.checkpointWarning as { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number }}
					/>
				</div>
			)}
			<Container className="flex grow overflow-hidden relative">
				<Container className="flex flex-col grow min-w-0 overflow-hidden relative">
					<div className="grow flex" ref={scrollContainerRef as React.RefObject<HTMLDivElement>}>
						<Virtuoso
							ref={virtuosoRef as React.RefObject<VirtuosoHandle>}
							key={taskTs}
							className="scrollable grow overflow-y-scroll mb-1"
							increaseViewportBy={{ top: 3_000, bottom: 1000 }}
							data={groupedMessages}
							itemContent={itemContent}
							followOutput={followOutputCallback}
							atBottomStateChange={atBottomStateChangeCallback}
							atBottomThreshold={10}
						/>
					</div>
					<NavigationTriggers
						currentNodeId={currentNodeId}
						nodes={nodes}
						onNavigateToNode={(nodeId) => tree.navigateToNode(nodeId)}
						onOpenHierarchy={() => {
							window.postMessage({ type: "pushWindow", text: "task_hierarchy" }, "*")
						}}
					/>
					<FileChangesPanel clineMessages={messages} />
					<AskResponder
						primaryButtonText={primaryButtonText}
						secondaryButtonText={secondaryButtonText}
						enableButtons={enableButtons}
						showScrollToBottom={showScrollToBottom}
						onPrimaryClick={onPrimaryClick}
						onSecondaryClick={onSecondaryClick}
						onScrollToBottom={onScrollToBottom}
					/>
				</Container>
			</Container>
		</>
	)
}

export const ChatArea = observer(ChatAreaComponent)
