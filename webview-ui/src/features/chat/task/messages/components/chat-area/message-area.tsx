import React from "react"
import { Container } from "@src/shared/ui/layouts/Container"
import { observer } from "mobx-react-lite"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import type { Notification, SuggestionItem } from "@jabberwock/types"
import { ParentContextPanel } from "@src/features/chat/task/messages/components/displays/parent-context-panel"
import ChatRow from "@src/features/chat/task/messages/components/row/view"
import { AskResponder } from "@src/features/chat/task/messages/components/responders/ask-responder"
import { NavigationTriggers } from "@src/features/chat/task/messages/components/displays/keyboard-shortcuts"
import TaskHeader from "@src/features/chat/task/components/task-header/header"
import FileChangesPanel from "@src/features/chat/task/messages/components/displays/file-changes-panel"
import { DiagnosticDashboard } from "@jabberwock/devtool/webview"
import { rootStore } from "@src/features/store"
import { CheckpointWarningBanner, StreamingFooter } from "./message-area.components"
import { useChatArea } from "./message-area.hooks"

export interface ChatAreaProps {
	isHidden: boolean
}

const ChatRowItem = React.memo<{
	index: number
	messageOrGroup: Notification
	isLast: boolean
	lastModifiedMessage: Notification | undefined
	onHeightChange: (isTaller: boolean) => void
	onSuggestionClick: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	isNested: boolean
}>(({ index, messageOrGroup, isLast, lastModifiedMessage, onHeightChange, onSuggestionClick, isNested }) => (
	<ChatRow
		key={`${messageOrGroup.ts}-${index}`}
		message={messageOrGroup}
		lastModifiedMessage={lastModifiedMessage}
		isLast={isLast}
		onHeightChange={onHeightChange}
		onSuggestionClick={onSuggestionClick}
		isNested={isNested}
	/>
))

const ChatAreaComponent: React.FC<ChatAreaProps> = ({ isHidden }) => {
	const hook = useChatArea(isHidden)
	const itemContent = (index: number, messageOrGroup: Notification) => (
		<ChatRowItem
			index={index}
			messageOrGroup={messageOrGroup}
			lastModifiedMessage={hook.latestModifiedMessage}
			isLast={index === hook.groupedMessages.length - 1}
			onHeightChange={hook.handleRowHeightChange}
			onSuggestionClick={hook.handleSuggestionClickInRow}
			isNested={hook.isNested}
		/>
	)
	return (
		<>
			<DiagnosticDashboard
				diagnostics={hook.diagnostics}
				isStreaming={hook.isStreaming}
				devtoolEnabled={hook.devtoolEnabled}
			/>
			<TaskHeader />
			<ParentContextPanel parentNode={hook.parentNode} />
			<CheckpointWarningBanner warning={hook.checkpointWarning} />
			<Container className="flex grow overflow-hidden relative">
				<Container className="flex flex-col grow min-w-0 overflow-hidden relative">
					<div className="grow flex" ref={hook.scrollContainerRef as React.RefObject<HTMLDivElement>}>
						<Virtuoso
							ref={hook.virtuosoRef as React.RefObject<VirtuosoHandle>}
							key={hook.virtuosoKey}
							className="scrollable grow overflow-y-scroll mb-1"
							increaseViewportBy={{ top: 3_000, bottom: 1000 }}
							data={hook.groupedMessages}
							itemContent={itemContent}
							followOutput={hook.followOutputCallback}
							atBottomStateChange={hook.atBottomStateChangeCallback}
							atBottomThreshold={10}
							components={{ Footer: StreamingFooter }}
						/>
					</div>
					<NavigationTriggers
						currentNodeId={hook.currentNodeId}
						nodes={
							hook.nodes as Map<
								string,
								{ id: string; mode?: string; status?: string; title?: string; children?: string[] }
							>
						}
						onNavigateToNode={(nodeId) => rootStore.chat.tree.navigateToNode(nodeId)}
						onOpenHierarchy={() => window.postMessage({ type: "pushWindow", text: "task_hierarchy" }, "*")}
					/>
					<FileChangesPanel messages={hook.messages} />
					<AskResponder
						onPrimaryClick={hook.handlePrimaryButtonClick}
						onSecondaryClick={hook.handleSecondaryButtonClick}
						onScrollToBottom={hook.handleScrollToBottomClick}
					/>
				</Container>
			</Container>
		</>
	)
}

export const ChatArea = observer(ChatAreaComponent)
