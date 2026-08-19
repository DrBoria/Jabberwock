import type { Notification, SuggestionItem, SayToolData, ApiReqData } from "@jabberwock/types"
import { COMMAND_OUTPUT_STRING } from "@shared/combineCommandSequences"
import { safeJsonParse } from "@jabberwock/core/browser"
import { UserMessage } from "../message-parts/user-message"
import { AssistantMessage } from "../message-parts/assistant-message"
import { ToolRenderer } from "../responders/tool-renderer"
import { SayRenderer } from "../say/view"
import { AskRenderer } from "../../../notifications/ask/view"
import { rootStore } from "@src/features/store"

export const computeRedundantTodo = (message: Notification, effectiveHistory: Notification[]) => {
	if (message.type !== "ask" || message.ask !== "tool" || !message.text) return false
	try {
		const tool = JSON.parse(message.text)
		if (tool.tool !== "updateTodoList") return false
		const myIndex = effectiveHistory.findIndex((m) => m.ts === message.ts)
		if (myIndex === -1) return false
		return effectiveHistory.slice(myIndex + 1).some(
			(m) =>
				m.type === "ask" &&
				m.ask === "tool" &&
				(() => {
					try {
						return JSON.parse(m.text || "{}").tool === "updateTodoList"
					} catch {
						return false
					}
				})(),
		)
	} catch {
		return false
	}
}

export const extractApiReqInfo = (
	message: Notification,
): [number | undefined, string | undefined, string | undefined] =>
	message.text !== null && message.text !== undefined && message.say === "api_req_started"
		? (() => {
				const info = safeJsonParse<ApiReqData>(message.text)
				return [info?.cost, info?.cancelReason, info?.streamingFailedMessage]
			})()
		: [undefined, undefined, undefined]

export const computeApiRequestFailedMessage = (isLast: boolean, lastModifiedMessage: Notification | undefined) =>
	isLast && lastModifiedMessage?.ask === "api_req_failed" ? lastModifiedMessage?.text : undefined

export const computeIsCommandExecuting = (isLast: boolean, lastModifiedMessage: Notification | undefined) =>
	!!(isLast && lastModifiedMessage?.ask === "command" && lastModifiedMessage?.text?.includes(COMMAND_OUTPUT_STRING))

export const computeIsMcpServerResponding = (isLast: boolean, lastModifiedMessage: Notification | undefined) =>
	!!(isLast && lastModifiedMessage?.say === "mcp_server_request_started")

export const computeType = (message: Notification) =>
	message.type === "ask" ? (message.ask ?? "") : (message.say ?? "")

export interface RenderChatContentProps {
	message: Notification
	t: (key: string, options?: Record<string, unknown>) => string
	tool: SayToolData | null
	isExpanded: boolean
	isNested: boolean | undefined
	isRedundantTodo: boolean
	effectiveHistory: Notification[]
	handleToggleExpand: () => void
	isStreaming: boolean
	isFollowUpAutoApprovalPaused: boolean
	lastModifiedMessage: Notification | undefined
	isLast: boolean
	isRedundantDelegation: boolean
	isAgentSaidSummary: boolean
	modeName: string | undefined
	icon: React.ReactNode
	title: React.ReactNode
	onSuggestionClick: ((suggestion: SuggestionItem, event?: React.MouseEvent) => void) | undefined
	i18n: { language: string; exists: (key: string) => boolean }
	isFollowUpAnswered: boolean
	onBatchFileResponse: (response: { [key: string]: boolean }) => void
}

export const renderChatContent = (p: RenderChatContentProps) => {
	if ((p.message as { role?: string }).role === "user") return <UserMessage message={p.message} t={p.t} />
	if ((p.message as { role?: string }).role === "assistant")
		return (
			<AssistantMessage
				message={p.message}
				modeName={p.modeName}
				isStreaming={p.isStreaming}
				isLast={p.isLast}
				t={p.t}
			/>
		)
	if (p.tool)
		return (
			<ToolRenderer
				message={p.message}
				tool={p.tool}
				isExpanded={p.isExpanded}
				isNested={!!p.isNested}
				isRedundantTodo={p.isRedundantTodo}
				effectiveHistory={p.effectiveHistory}
				onToggleExpand={p.handleToggleExpand}
				onBatchFileResponse={p.onBatchFileResponse}
				t={p.t}
			/>
		)
	switch (p.message.type) {
		case "say":
			return (
				<SayRenderer
					message={p.message}
					lastModifiedMessage={p.lastModifiedMessage}
					isExpanded={p.isExpanded}
					isLast={p.isLast}
					isStreaming={p.isStreaming}
					isNested={!!p.isNested}
					isRedundantDelegation={p.isRedundantDelegation}
					isAgentSaidSummary={p.isAgentSaidSummary}
					modeName={p.modeName}
					icon={p.icon}
					title={p.title}
					onToggleExpand={p.handleToggleExpand}
					onSuggestionClick={p.onSuggestionClick}
					t={p.t}
					i18n={p.i18n}
				/>
			)
		case "ask":
			return (
				<AskRenderer
					message={p.message}
					icon={p.icon}
					title={p.title}
					isLast={p.isLast}
					lastModifiedMessage={p.lastModifiedMessage}
					onSuggestionClick={p.onSuggestionClick}
					onFollowUpUnmount={rootStore.chat.cancelAutoApproval}
					isFollowUpAnswered={p.isFollowUpAnswered}
					isFollowUpAutoApprovalPaused={p.isFollowUpAutoApprovalPaused}
					t={p.t}
				/>
			)
		default:
			return null
	}
}
