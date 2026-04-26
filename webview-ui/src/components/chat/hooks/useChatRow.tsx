import { useMemo, useCallback, useState, useEffect } from "react"
import type React from "react"
import type { ClineMessage, ClineApiReqInfo, ClineAskUseMcpServer, ClineSayTool, FollowUpData } from "@jabberwock/types"
import { COMMAND_OUTPUT_STRING } from "@shared/combineCommandSequences"
import { safeJsonParse } from "@shared/core"
import { getAllModes } from "@shared/modes"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"
import { vscode } from "@src/utils/vscode"
import { appendImages } from "@src/utils/imageUtils"
import { MAX_IMAGES_PER_MESSAGE } from "../ChatView"
import { useTranslation } from "react-i18next"
import { ProgressIndicator } from "../ProgressIndicator"
import { TerminalSquare, MessageCircleQuestionMark } from "lucide-react"
import type { Mode } from "@shared/modes"

export interface UseChatRowOptions {
	message: ClineMessage
	lastModifiedMessage?: ClineMessage
	isLast: boolean
	isStreaming: boolean
	isNested?: boolean
	onToggleExpand: (ts: number) => void
	history?: ClineMessage[]
}

export interface UseChatRowReturn {
	/** Translation function with mode name replacement */
	t: (key: string, options?: any) => string
	i18n: any
	/** Computed icon + title pair for the message */
	iconTitle: [React.ReactNode, React.ReactNode]
	/** Parsed tool from message text */
	tool: ClineSayTool | null
	/** Follow-up data */
	followUpData: FollowUpData | null
	/** Whether this is a redundant delegation */
	isRedundantDelegation: boolean
	/** Whether this is an agent-said summary */
	isAgentSaidSummary: boolean
	/** Whether this is a redundant todo */
	isRedundantTodo: boolean
	/** Mode name for the message */
	modeName: string | undefined
	/** Effective history (passed or from context) */
	effectiveHistory: ClineMessage[]
	/** Edit state */
	isEditing: boolean
	editedContent: string
	editMode: Mode
	editImages: string[]
	setEditedContent: (v: string) => void
	setEditMode: (v: Mode) => void
	handleEditClick: () => void
	handleCancelEdit: () => void
	handleSaveEdit: () => void
	handleSelectImages: () => void
	handleToggleExpand: () => void
	/** API request info */
	cost: number | undefined
	apiReqCancelReason: string | undefined
	apiReqStreamingFailedMessage: string | undefined
	apiRequestFailedMessage: string | undefined
	isCommandExecuting: boolean
	isMcpServerResponding: boolean
}

export function useChatRow(options: UseChatRowOptions): UseChatRowReturn {
	const {
		message,
		lastModifiedMessage,
		isLast,
		isStreaming: _isStreaming,
		isNested,
		onToggleExpand,
		history,
	} = options

	const { t: originalT, i18n } = useTranslation()
	const { customModes, mode, apiConfiguration, clineMessages } = useExtensionState()

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
		const found = allModes.find((m) => m.slug === message.mode)
		return found?.name
	}, [message.mode, customModes])

	const { info: _model } = useSelectedModel(apiConfiguration)

	const [isEditing, setIsEditing] = useState(false)
	const [editedContent, setEditedContent] = useState("")
	const [editMode, setEditMode] = useState<Mode>(mode || "code")
	const [editImages, setEditImages] = useState<string[]>([])

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

	const handleToggleExpand = useCallback(() => {
		onToggleExpand(message.ts)
	}, [onToggleExpand, message.ts])

	const handleEditClick = useCallback(() => {
		setIsEditing(true)
		setEditedContent(message.text || "")
		setEditImages(message.images || [])
		setEditMode(mode || "code")
	}, [message.text, message.images, mode])

	const handleCancelEdit = useCallback(() => {
		setIsEditing(false)
		setEditedContent(message.text || "")
		setEditImages(message.images || [])
		setEditMode(mode || "code")
	}, [message.text, message.images, mode])

	const handleSaveEdit = useCallback(() => {
		setIsEditing(false)
		vscode.postMessage({
			type: "submitEditedMessage",
			value: message.ts,
			editedMessageContent: editedContent,
			images: editImages,
		})
	}, [message.ts, editedContent, editImages])

	const handleSelectImages = useCallback(() => {
		vscode.postMessage({ type: "selectImages", context: "edit", messageTs: message.ts })
	}, [message.ts])

	const [cost, apiReqCancelReason, apiReqStreamingFailedMessage] = useMemo(() => {
		if (message.text !== null && message.text !== undefined && message.say === "api_req_started") {
			const info = safeJsonParse<ClineApiReqInfo>(message.text)
			return [info?.cost, info?.cancelReason, info?.streamingFailedMessage]
		}
		return [undefined, undefined, undefined]
	}, [message.text, message.say])

	const apiRequestFailedMessage =
		isLast && lastModifiedMessage?.ask === "api_req_failed" ? lastModifiedMessage?.text : undefined

	const isCommandExecuting = !!(
		isLast &&
		lastModifiedMessage?.ask === "command" &&
		lastModifiedMessage?.text?.includes(COMMAND_OUTPUT_STRING)
	)

	const isMcpServerResponding = !!(isLast && lastModifiedMessage?.say === "mcp_server_request_started")

	const type = message.type === "ask" ? message.ask : message.say

	const normalColor = "var(--vscode-foreground)"
	const errorColor = "var(--vscode-errorForeground)"
	const successColor = "var(--vscode-charts-green)"
	const cancelledColor = "var(--vscode-descriptionForeground)"

	const iconTitle = useMemo((): [React.ReactNode, React.ReactNode] => {
		switch (type) {
			case "error":
			case "mistake_limit_reached":
				return [null, null]
			case "command":
				return [
					isCommandExecuting ? (
						<ProgressIndicator key="icon" />
					) : (
						<TerminalSquare key="icon" className="size-4" aria-label="Terminal icon" />
					),
					<span key="title" style={{ color: normalColor, fontWeight: "bold" }}>
						{t("chat:commandExecution.running")}
					</span>,
				]
			case "use_mcp_server": {
				const mcpServerUse = safeJsonParse<ClineAskUseMcpServer>(message.text)
				if (mcpServerUse === undefined) return [null, null]
				return [
					isMcpServerResponding ? (
						<ProgressIndicator key="icon" />
					) : (
						<span
							key="icon"
							className="codicon codicon-server"
							style={{ color: normalColor, marginBottom: "-1.5px" }}></span>
					),
					<span key="title" style={{ color: normalColor, fontWeight: "bold" }}>
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
			}
			case "completion_result":
				return [
					<span
						key="icon"
						className="codicon codicon-check"
						style={{ color: successColor, marginBottom: "-1.5px" }}></span>,
					<span key="title" style={{ color: successColor, fontWeight: "bold" }}>
						{t("chat:taskCompleted")}
					</span>,
				]
			case "api_req_rate_limit_wait":
				return [null, null]
			case "api_req_retry_delayed":
				return [null, null]
			case "api_req_started": {
				const getIconSpan = (iconName: string, color: string) => (
					<div
						key="icon"
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
						<ProgressIndicator key="icon" />
					) : (
						getIconSpan("arrow-swap", normalColor)
					),
					apiReqCancelReason !== null && apiReqCancelReason !== undefined ? (
						apiReqCancelReason === "user_cancelled" ? (
							<span key="title" style={{ color: normalColor, fontWeight: "bold" }}>
								{t("chat:apiRequest.cancelled")}
							</span>
						) : (
							<span key="title" style={{ color: errorColor, fontWeight: "bold" }}>
								{t("chat:apiRequest.streamingFailed")}
							</span>
						)
					) : cost !== null && cost !== undefined ? (
						<span key="title" style={{ color: normalColor }}>
							{t("chat:apiRequest.title")}
						</span>
					) : apiRequestFailedMessage ? (
						<span key="title" style={{ color: errorColor }}>
							{t("chat:apiRequest.failed")}
						</span>
					) : (
						<span key="title" style={{ color: normalColor }}>
							{t("chat:apiRequest.streaming")}
						</span>
					),
				]
			}
			case "followup":
				return [
					<MessageCircleQuestionMark key="icon" className="w-4 shrink-0" aria-label="Question icon" />,
					<span key="title" style={{ color: normalColor, fontWeight: "bold" }}>
						{t("chat:questions.hasQuestion")}
					</span>,
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

	const tool = useMemo(
		() => (message.ask === "tool" ? (safeJsonParse<ClineSayTool>(message.text) ?? null) : null),
		[message.ask, message.text],
	)

	const followUpData = useMemo(() => {
		if (message.type === "ask" && message.ask === "followup" && !message.partial) {
			return safeJsonParse<FollowUpData>(message.text) ?? null
		}
		return null
	}, [message.type, message.ask, message.partial, message.text])

	return {
		t,
		i18n,
		iconTitle,
		tool,
		followUpData,
		isRedundantDelegation,
		isAgentSaidSummary,
		isRedundantTodo,
		modeName,
		effectiveHistory,
		isEditing,
		editedContent,
		editMode,
		editImages,
		setEditedContent,
		setEditMode,
		handleEditClick,
		handleCancelEdit,
		handleSaveEdit,
		handleSelectImages,
		handleToggleExpand,
		cost,
		apiReqCancelReason,
		apiReqStreamingFailedMessage,
		apiRequestFailedMessage,
		isCommandExecuting,
		isMcpServerResponding,
	}
}
