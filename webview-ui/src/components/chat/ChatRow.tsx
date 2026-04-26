import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSize } from "react-use"
import { useTranslation } from "react-i18next"
import deepEqual from "fast-deep-equal"

import type {
	ClineMessage,
	FollowUpData,
	SuggestionItem,
	ClineApiReqInfo,
	ClineAskUseMcpServer,
	ClineSayTool,
} from "@jabberwock/types"

import { Mode } from "@shared/modes"

import { COMMAND_OUTPUT_STRING } from "@shared/combineCommandSequences"
import { safeJsonParse } from "@shared/core"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useChatUI } from "@src/context/ChatUIContext"
import { getAllModes } from "@shared/modes"
import { vscode } from "@src/utils/vscode"

import { UserMessage, AssistantMessage, ToolRenderer, SayRenderer, AskRenderer } from "./ChatRow/index"

import { MessageCircleQuestionMark } from "lucide-react"
// import { cn } from "@/lib/utils"
import { ProgressIndicator } from "./ProgressIndicator"
import { TerminalSquare } from "lucide-react"
// import { Markdown } from "./Markdown"
// import { OpenMarkdownPreviewButton } from "./OpenMarkdownPreviewButton"
import { useSelectedModel } from "../ui/hooks/useSelectedModel"
import { appendImages } from "@src/utils/imageUtils"
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"

interface ChatRowProps {
	message: ClineMessage
	lastModifiedMessage?: ClineMessage
	isLast: boolean
	isStreaming: boolean
	onHeightChange: (isTaller: boolean) => void
	onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
	onFollowUpUnmount?: () => void
	isFollowUpAutoApprovalPaused?: boolean
	editable?: boolean
	hasCheckpoint?: boolean
	isNested?: boolean
	history?: ClineMessage[]
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ChatRowContentProps extends Omit<ChatRowProps, "onHeightChange"> {}

const ChatRow = memo(
	(props: ChatRowProps) => {
		const { isLast, onHeightChange, message } = props
		// Store the previous height to compare with the current height
		// This allows us to detect changes without causing re-renders
		const prevHeightRef = useRef(0)

		const [chatrow, { height }] = useSize(
			<div className="px-[15px] py-[10px] pr-[6px]">
				<ChatRowContent {...props} />
			</div>,
		)

		useEffect(() => {
			const isHeightValid = height !== 0 && height !== Infinity
			// used for partials, command output, etc.
			// NOTE: it's important we don't distinguish between partial or complete here since our scroll effects in chatview need to handle height change during partial -> complete
			const isInitialRender = prevHeightRef.current === 0 // prevents scrolling when new element is added since we already scroll for that
			// height starts off at Infinity
			if (isLast && isHeightValid && height !== prevHeightRef.current) {
				if (!isInitialRender) {
					onHeightChange(height > prevHeightRef.current)
				}
				prevHeightRef.current = height
			}
		}, [height, isLast, onHeightChange, message])

		// we cannot return null as virtuoso does not support it, so we use a separate visibleMessages array to filter out messages that should not be rendered
		return chatrow
	},
	// memo does shallow comparison of props, so we need to do deep comparison of arrays/objects whose properties might change
	deepEqual,
)

export default ChatRow

export const ChatRowContent = ({
	message,
	lastModifiedMessage,
	isLast,
	isStreaming,
	onSuggestionClick,
	onFollowUpUnmount,
	onBatchFileResponse,
	isFollowUpAutoApprovalPaused,
	isNested,
	history,
}: ChatRowContentProps) => {
	// ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURN (Rules of Hooks)
	const { t: originalT, i18n } = useTranslation()
	const ui = useChatUI()

	const { customModes, mode, apiConfiguration, clineMessages } = useExtensionState()

	const isExpanded = ui.expandedRows[message.ts] || false
	const isFollowUpAnswered = message.isAnswered === true || message.ts === ui.currentFollowUpTs

	const effectiveHistory = useMemo(() => history || clineMessages, [history, clineMessages])

	const isRedundantDelegation = useMemo(() => {
		if (!isNested || !message.text) return false
		return message.text.includes("Delegated TODO item") && message.say === "tool"
	}, [isNested, message.text, message.say])

	const isAgentSaidSummary = useMemo(() => {
		if (!isNested || !message.text || message.partial) return false
		const agentSaidPattern = /^\w+(\s+\w+)?\s+said:?/i
		return agentSaidPattern.test(message.text) && message.text.length < 100
	}, [isNested, message.text, message.partial])

	const isRedundantTodo = useMemo(() => {
		if (message.type !== "ask" || message.ask !== "tool" || !message.text) return false
		try {
			const tool = JSON.parse(message.text)
			if (tool.tool !== "updateTodoList") return false

			const myIndex = effectiveHistory.findIndex((m) => m.ts === message.ts)
			if (myIndex === -1) return false

			const hasNewer = effectiveHistory.slice(myIndex + 1).some((m) => {
				if (m.type === "ask" && m.ask === "tool") {
					try {
						const t = JSON.parse(m.text || "{}")
						return t.tool === "updateTodoList"
					} catch {
						return false
					}
				}
				return false
			})

			if (hasNewer) return true
			return false
		} catch {
			return false
		}
	}, [message, effectiveHistory])

	const modeName = useMemo(() => {
		if (!message.mode) return undefined
		const allModes = getAllModes(customModes)
		const mode = allModes.find((m) => m.slug === message.mode)
		return mode?.name
	}, [message.mode, customModes])
	const { info: _model } = useSelectedModel(apiConfiguration)
	const [isEditing, setIsEditing] = useState(false)
	const [editedContent, setEditedContent] = useState("")
	const [_editMode, setEditMode] = useState<Mode>(mode || "code")
	const [editImages, setEditImages] = useState<string[]>([])

	const t = useCallback(
		(key: string, options?: any) => {
			let result: any = originalT(key as any, options)
			if (typeof result === "string" && modeName && result.includes("Jabberwock")) {
				result = result.replace(/Jabberwock/g, modeName)
			}
			return result
		},
		[originalT, modeName],
	) as any

	// Handle message events for image selection during edit mode
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = event.data
			if (msg.type === "selectedImages" && msg.context === "edit" && msg.messageTs === message.ts && isEditing) {
				setEditImages((prevImages) => appendImages(prevImages, msg.images, MAX_IMAGES_PER_MESSAGE))
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [isEditing, message.ts])

	// Memoized callback to prevent re-renders caused by inline arrow functions.
	const handleToggleExpand = useCallback(() => {
		ui.toggleRowExpansion(message.ts)
	}, [ui, message.ts])

	// Handle edit button click
	const _handleEditClick = useCallback(() => {
		setIsEditing(true)
		setEditedContent(message.text || "")
		setEditImages(message.images || [])
		setEditMode(mode || "code")
	}, [message.text, message.images, mode])

	// Handle cancel edit
	const _handleCancelEdit = useCallback(() => {
		setIsEditing(false)
		setEditedContent(message.text || "")
		setEditImages(message.images || [])
		setEditMode(mode || "code")
	}, [message.text, message.images, mode])

	// Handle save edit
	const _handleSaveEdit = useCallback(() => {
		setIsEditing(false)
		vscode.postMessage({
			type: "submitEditedMessage",
			value: message.ts,
			editedMessageContent: editedContent,
			images: editImages,
		})
	}, [message.ts, editedContent, editImages])

	// Handle image selection for editing
	const _handleSelectImages = useCallback(() => {
		vscode.postMessage({ type: "selectImages", context: "edit", messageTs: message.ts })
	}, [message.ts])

	const [cost, apiReqCancelReason, _apiReqStreamingFailedMessage] = useMemo(() => {
		if (message.text !== null && message.text !== undefined && message.say === "api_req_started") {
			const info = safeJsonParse<ClineApiReqInfo>(message.text)
			return [info?.cost, info?.cancelReason, info?.streamingFailedMessage]
		}

		return [undefined, undefined, undefined]
	}, [message.text, message.say])

	// When resuming task, last won't be api_req_failed but a resume_task
	// message, so api_req_started will show loading spinner. That's why we just
	// remove the last api_req_started that failed without streaming anything.
	const apiRequestFailedMessage =
		isLast && lastModifiedMessage?.ask === "api_req_failed" ? lastModifiedMessage?.text : undefined

	const isCommandExecuting =
		isLast && lastModifiedMessage?.ask === "command" && lastModifiedMessage?.text?.includes(COMMAND_OUTPUT_STRING)

	const isMcpServerResponding = isLast && lastModifiedMessage?.say === "mcp_server_request_started"

	const type = message.type === "ask" ? message.ask : message.say

	const normalColor = "var(--vscode-foreground)"
	const errorColor = "var(--vscode-errorForeground)"
	const successColor = "var(--vscode-charts-green)"
	const cancelledColor = "var(--vscode-descriptionForeground)"

	// ALL REMAINING HOOKS MUST BE BEFORE EARLY RETURNS
	const [icon, title] = useMemo(() => {
		switch (type) {
			case "error":
			case "mistake_limit_reached":
				return [null, null]
			case "command":
				return [
					isCommandExecuting ? (
						<ProgressIndicator />
					) : (
						<TerminalSquare className="size-4" aria-label="Terminal icon" />
					),
					<span style={{ color: normalColor, fontWeight: "bold" }}>
						{t("chat:commandExecution.running")}
					</span>,
				]
			case "use_mcp_server":
				const mcpServerUse = safeJsonParse<ClineAskUseMcpServer>(message.text)
				if (mcpServerUse === undefined) {
					return [null, null]
				}
				return [
					isMcpServerResponding ? (
						<ProgressIndicator />
					) : (
						<span
							className="codicon codicon-server"
							style={{ color: normalColor, marginBottom: "-1.5px" }}></span>
					),
					<span style={{ color: normalColor, fontWeight: "bold" }}>
						{mcpServerUse.type === "use_mcp_tool"
							? t("chat:mcp.wantsToUseTool", {
									serverName: mcpServerUse.serverName,
									agentName:
										getAllModes(customModes).find((m) => m.slug === message.mode)?.name ||
										"Jabberwock",
								})
							: t("chat:mcp.wantsToAccessResource", {
									serverName: mcpServerUse.serverName,
									agentName:
										getAllModes(customModes).find((m) => m.slug === message.mode)?.name ||
										"Jabberwock",
								})}
					</span>,
				]
			case "completion_result":
				return [
					<span
						className="codicon codicon-check"
						style={{ color: successColor, marginBottom: "-1.5px" }}></span>,
					<span style={{ color: successColor, fontWeight: "bold" }}>{t("chat:taskCompleted")}</span>,
				]
			case "api_req_rate_limit_wait":
				return []
			case "api_req_retry_delayed":
				return []
			case "api_req_started":
				const getIconSpan = (iconName: string, color: string) => (
					<div
						style={{
							width: 16,
							height: 16,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<span
							className={`codicon codicon-${iconName}`}
							style={{ color, fontSize: 16, marginBottom: "-1.5px" }}
						/>
					</div>
				)
				return [
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
							getIconSpan("error", cancelledColor)
						) : (
							getIconSpan("error", errorColor)
						)
					) : cost !== null && cost !== undefined ? (
						getIconSpan("arrow-swap", normalColor)
					) : apiRequestFailedMessage ? (
						getIconSpan("error", errorColor)
					) : isLast ? (
						<ProgressIndicator />
					) : (
						getIconSpan("arrow-swap", normalColor)
					),
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
							<span style={{ color: normalColor, fontWeight: "bold" }}>
								{t("chat:apiRequest.cancelled")}
							</span>
						) : (
							<span style={{ color: errorColor, fontWeight: "bold" }}>
								{t("chat:apiRequest.streamingFailed")}
							</span>
						)
					) : cost !== null && cost !== undefined ? (
						<span style={{ color: normalColor }}>{t("chat:apiRequest.title")}</span>
					) : apiRequestFailedMessage ? (
						<span style={{ color: errorColor }}>{t("chat:apiRequest.failed")}</span>
					) : (
						<span style={{ color: normalColor }}>{t("chat:apiRequest.streaming")}</span>
					),
				]
			case "followup":
				return [
					<MessageCircleQuestionMark className="w-4 shrink-0" aria-label="Question icon" />,
					<span style={{ color: normalColor, fontWeight: "bold" }}>{t("chat:questions.hasQuestion")}</span>,
				]
			default:
				return [null, null]
		}
	}, [
		type,
		isCommandExecuting,
		message,
		isMcpServerResponding,
		apiReqCancelReason,
		cost,
		apiRequestFailedMessage,
		t,
		isLast,
		customModes,
	])

	// ALL REMAINING HOOKS MUST BE BEFORE EARLY RETURNS
	const tool = useMemo(
		() => (message.ask === "tool" ? safeJsonParse<ClineSayTool>(message.text) : null),
		[message.ask, message.text],
	)

	const _followUpData = useMemo(() => {
		if (message.type === "ask" && message.ask === "followup" && !message.partial) {
			return safeJsonParse<FollowUpData>(message.text)
		}
		return null
	}, [message.type, message.ask, message.partial, message.text])

	const _headerStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		cursor: "default",
		marginBottom: "10px",
		wordBreak: "break-word",
	}

	// ==================== RENDER LOGIC ====================

	// 1. User role messages
	if ((message as any).role === "user") {
		return <UserMessage message={message} t={t} />
	}

	// 2. Assistant role messages
	if ((message as any).role === "assistant") {
		return (
			<AssistantMessage message={message} modeName={modeName} isStreaming={isStreaming} isLast={isLast} t={t} />
		)
	}

	// 3. Tool messages (ask === "tool")
	if (tool) {
		return (
			<ToolRenderer
				message={message}
				tool={tool}
				isExpanded={isExpanded}
				isNested={!!isNested}
				isRedundantTodo={isRedundantTodo}
				effectiveHistory={effectiveHistory}
				onToggleExpand={handleToggleExpand}
				onBatchFileResponse={onBatchFileResponse}
				t={t}
			/>
		)
	}

	// 4. Say / Ask messages
	switch (message.type) {
		case "say":
			return (
				<SayRenderer
					message={message}
					lastModifiedMessage={lastModifiedMessage}
					isExpanded={isExpanded}
					isLast={isLast}
					isStreaming={isStreaming}
					isNested={!!isNested}
					isRedundantDelegation={isRedundantDelegation}
					isAgentSaidSummary={isAgentSaidSummary}
					modeName={modeName}
					icon={icon}
					title={title}
					onToggleExpand={handleToggleExpand}
					onSuggestionClick={onSuggestionClick}
					t={t}
					i18n={i18n}
				/>
			)
		case "ask":
			return (
				<AskRenderer
					message={message}
					icon={icon}
					title={title}
					isLast={isLast}
					lastModifiedMessage={lastModifiedMessage}
					onSuggestionClick={onSuggestionClick}
					onFollowUpUnmount={onFollowUpUnmount}
					isFollowUpAnswered={isFollowUpAnswered}
					isFollowUpAutoApprovalPaused={isFollowUpAutoApprovalPaused}
					t={t}
				/>
			)
		default:
			return null
	}
}
