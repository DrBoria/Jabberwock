import React from "react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import type { ClineMessage } from "@jabberwock/types"
import ChatRow from "../ChatRow"
import { Container } from "@src/components/ui/Container"
export interface ChatMessageListProps {
	virtuosoRef: React.RefObject<VirtuosoHandle | null>
	taskTs: number | undefined
	groupedMessages: ClineMessage[]
	modifiedMessages: ClineMessage[]
	isStreaming: boolean
	isFollowUpAutoApprovalPaused: boolean
	isNested: boolean
	enableButtons: boolean
	primaryButtonText: string | undefined
	onRowHeightChange: (isTaller: boolean) => void
	onSuggestionClick: (suggestion: any, event?: React.MouseEvent) => void
	onBatchFileResponse: (response: { [key: string]: boolean }) => void
	onFollowUpUnmount: () => void
	followOutputCallback: (isAtBottom: boolean) => "auto" | false
	atBottomStateChangeCallback: (isAtBottom: boolean) => void
}

/**
 * Renders the virtualized message list using Virtuoso.
 * Each message is rendered as a ChatRow component.
 */
export const ChatMessageList: React.FC<ChatMessageListProps> = ({
	virtuosoRef,
	taskTs,
	groupedMessages,
	modifiedMessages,
	isStreaming,
	isFollowUpAutoApprovalPaused,
	isNested,
	enableButtons,
	primaryButtonText,
	onRowHeightChange,
	onSuggestionClick,
	onBatchFileResponse,
	onFollowUpUnmount,
	followOutputCallback,
	atBottomStateChangeCallback,
}) => {
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
							if (messageOrGroup.text?.includes("updateTodoList")) {
								tool = { tool: "updateTodoList" }
							}
						}
						return tool.tool === "updateTodoList" && enableButtons && !!primaryButtonText
					})()
				}
				hasCheckpoint={hasCheckpoint}
			/>
		)
	}

	return (
		<Container className="grow flex">
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
		</Container>
	)
}
