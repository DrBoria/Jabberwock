import { useMemo, useCallback, useState, useEffect } from "react"
import type { SayToolData, FollowUpData } from "@jabberwock/types"
import { Mode } from "@shared/modes"
import { getAllModes } from "@shared/modes"
import { useSelectedModel } from "@src/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"
import { rootStore } from "@src/features/store"
import { appendImages } from "@sections/dndTextArea/utils/image-utils"
import { MAX_ATTACHED_IMAGES } from "../responders/constants"
import { useTranslation } from "react-i18next"
import { safeJsonParse } from "@jabberwock/core/browser"
import {
	computeApiRequestFailedMessage,
	computeIsCommandExecuting,
	computeIsMcpServerResponding,
	computeRedundantTodo,
	computeType,
} from "./use-row-display.utils"
import {
	computeIconTitleCommand,
	computeIconTitleUseMcpServer,
	extractApiReqInfo,
	getApiReqIcon,
	getApiReqTitle,
	getIconSpan,
} from "./rowDisplay.icon"
import type { UseChatRowOptions, UseChatRowReturn } from "./chatRow.types"

export function useChatRow(options: UseChatRowOptions): UseChatRowReturn {
	const { message, lastModifiedMessage, isLast, isNested, onToggleExpand, history } = options
	const { t: originalT, i18n } = useTranslation()
	const { customModes, mode, apiConfiguration, messages } = rootStore.extensionState
	const effectiveHistory = useMemo(() => history || messages, [history, messages])
	const isRedundantDelegation = !!(
		isNested &&
		message.text &&
		message.text.includes("Delegated TODO item") &&
		message.say === "tool"
	)
	const isAgentSaidSummary = !!(
		message.text &&
		!message.partial &&
		/^(\p{So}|\p{S})?\s*\w+(\s+\w+)?\s+said:?/iu.test(message.text) &&
		message.text.length < 500
	)
	const isRedundantTodo = computeRedundantTodo(message, effectiveHistory)
	const modeName = useMemo(
		() => (message.mode ? getAllModes(customModes).find((m) => m.slug === message.mode)?.name : undefined),
		[message.mode, customModes],
	)
	const { info: _model } = useSelectedModel(apiConfiguration)
	const [isEditing, setIsEditing] = useState(false)
	const [editedContent, setEditedContent] = useState("")
	const [editMode, setEditMode] = useState<Mode>(mode || "code")
	const [editImages, setEditImages] = useState<string[]>([])
	useEffect(() => {
		const h = (event: MessageEvent) => {
			const msg = event.data
			if (msg.type === "selectedImages" && msg.context === "edit" && msg.messageTs === message.ts && isEditing)
				setEditImages((prev) => appendImages(prev, msg.images, MAX_ATTACHED_IMAGES))
		}
		window.addEventListener("message", h)
		return () => window.removeEventListener("message", h)
	}, [isEditing, message.ts])
	const t = useCallback(
		(key: string, options?: Record<string, unknown>) => {
			const result = originalT(key, options)
			return typeof result === "string" && modeName && result.includes("Jabberwock")
				? result.replace(/Jabberwock/g, modeName)
				: result
		},
		[originalT, modeName],
	) as (key: string, options?: Record<string, unknown>) => string
	const handleToggleExpand = useCallback(() => onToggleExpand(message.ts), [onToggleExpand, message.ts])
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
		rootStore.chat.submitEditedMessage(message.ts, editedContent, editImages)
	}, [message.ts, editedContent, editImages])
	const handleSelectImages = useCallback(() => {
		rootStore.chat.selectImagesForEdit("edit", message.ts)
	}, [message.ts])
	const [cost, apiReqCancelReason, apiReqStreamingFailedMessage] = extractApiReqInfo(message)
	const apiRequestFailedMessage = computeApiRequestFailedMessage(isLast, lastModifiedMessage)
	const isCommandExecuting = computeIsCommandExecuting(isLast, lastModifiedMessage)
	const isMcpServerResponding = computeIsMcpServerResponding(isLast, lastModifiedMessage)
	const type = computeType(message)
	const normalColor = "var(--vscode-foreground)"
	const errorColor = "var(--vscode-errorForeground)"
	const successColor = "var(--vscode-charts-green)"
	const cancelledColor = "var(--vscode-descriptionForeground)"
	const iconTitle = useMemo((): [React.ReactNode, React.ReactNode] => {
		switch (type) {
			case "error":
			case "mistake_limit_reached":
			case "api_req_rate_limit_wait":
			case "api_req_retry_delayed":
				return [null, null]
			case "command":
				return computeIconTitleCommand(isCommandExecuting, normalColor, t)
			case "use_mcp_server":
				return computeIconTitleUseMcpServer(message, isMcpServerResponding, normalColor, customModes, t)
			case "completion_result":
				return [
					<span
						key="icon"
						className="codicon codicon-check"
						style={{ color: successColor, marginBottom: "-1.5px" }}
					/>,
					<span key="title" style={{ color: successColor, fontWeight: "bold" }}>
						{t("chat:taskCompleted")}
					</span>,
				]
			case "api_req_started":
				return [
					getApiReqIcon(
						apiReqCancelReason,
						cost,
						apiRequestFailedMessage,
						isLast,
						cancelledColor,
						errorColor,
						normalColor,
					),
					getApiReqTitle(apiReqCancelReason, cost, apiRequestFailedMessage, t, normalColor, errorColor),
				]
			case "followup":
				return [
					getIconSpan("question", normalColor),
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
		() => (message.ask === "tool" ? (safeJsonParse<SayToolData>(message.text) ?? null) : null),
		[message.ask, message.text],
	)
	const followUpData = useMemo(
		() =>
			message.type === "ask" && message.ask === "followup" && !message.partial
				? (safeJsonParse<FollowUpData>(message.text) ?? null)
				: null,
		[message.type, message.ask, message.partial, message.text],
	)
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
