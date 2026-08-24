import type React from "react"
import type { VirtuosoHandle } from "react-virtuoso"
import type { DiagnosticSnapshot, Notification, SuggestionItem } from "@jabberwock/types"
import type { ChatNode, TaskNodeInstance } from "./message-area.utils"

export interface UseChatAreaReturn {
	parentNode: ChatNode | undefined
	diagnostics: DiagnosticSnapshot | undefined
	isStreaming: boolean
	devtoolEnabled: boolean
	checkpointWarning: { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | undefined
	virtuosoRef: React.RefObject<VirtuosoHandle>
	scrollContainerRef: React.RefObject<HTMLDivElement>
	virtuosoKey: string
	groupedMessages: Notification[]
	followOutputCallback: () => "auto" | false
	atBottomStateChangeCallback: (isAtBottom: boolean) => void
	currentNodeId: string | undefined
	nodes: Map<string, TaskNodeInstance>
	isNested: boolean
	handleRowHeightChange: (isTaller: boolean) => void
	handleSuggestionClickInRow: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	modifiedMessages: Notification[]
	messages: Notification[]
	handlePrimaryButtonClick: (text?: string, images?: string[]) => void
	handleSecondaryButtonClick: (text?: string, images?: string[]) => void
	handleScrollToBottomClick: () => void
	latestModifiedMessage: Notification | undefined
}
