import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { Notification, SuggestionItem, SayToolData, FollowUpData } from "@jabberwock/types"
import { Mode } from "@shared/modes"
import { safeJsonParse } from "@jabberwock/core/browser"
import { observer } from "mobx-react-lite"
import { rootStore } from "@src/features/store"
import { useChatUI } from "@src/features/chat/store"
import { getAllModes } from "@shared/modes"
import { useSelectedModel } from "@src/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"
import { appendImages } from "@sections/dndTextArea/utils/image-utils"
import { MAX_ATTACHED_IMAGES } from "../responders/constants"
import { computeIconTitle } from "./icons"
import {
	computeRedundantTodo,
	extractApiReqInfo,
	computeApiRequestFailedMessage,
	computeIsCommandExecuting,
	computeIsMcpServerResponding,
	computeType,
	renderChatContent,
} from "./helpers"

export interface ChatRowContentProps {
	message: Notification
	lastModifiedMessage?: Notification
	isLast: boolean
	onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	isNested?: boolean
	history?: Notification[]
}

export const ChatRowContent = observer(
	({ message, lastModifiedMessage, isLast, onSuggestionClick, isNested, history }: ChatRowContentProps) => {
		const { t: originalT, i18n } = useTranslation()
		const ui = useChatUI()
		const customModes = rootStore.extensionState.customModes
		const mode = rootStore.extensionState.mode
		const apiConfiguration = rootStore.extensionState.apiConfiguration
		const messages = rootStore.extensionState.messages
		const isExpanded = ui.expandedRows[message.ts] || false
		const isFollowUpAnswered = message.isAnswered === true || message.ts === ui.currentFollowUpTs
		const effectiveHistory = useMemo(() => history || messages, [history, messages])
		const isRedundantDelegation = useMemo(
			() =>
				!!(isNested && message.text && message.text.includes("Delegated TODO item") && message.say === "tool"),
			[isNested, message.text, message.say],
		)
		const isAgentSaidSummary = useMemo(
			() =>
				!!(
					message.text &&
					!message.partial &&
					/^(\p{So}|\p{S})?\s*\w+(\s+\w+)?\s+said:?/iu.test(message.text) &&
					message.text.length < 500
				),
			[message.text, message.partial],
		)
		const isRedundantTodo = computeRedundantTodo(message, effectiveHistory)
		const modeName = useMemo(() => {
			if (!message.mode) return undefined
			const allModes = getAllModes(customModes)
			return allModes.find((m) => m.slug === message.mode)?.name
		}, [message.mode, customModes])
		const { info: _model } = useSelectedModel(apiConfiguration)
		const [isEditing, setIsEditing] = useState(false)
		const [editedContent, setEditedContent] = useState("")
		const [_editMode, setEditMode] = useState<Mode>(mode || "code")
		const [editImages, setEditImages] = useState<string[]>([])
		const t = useCallback(
			(key: string, options?: Record<string, unknown>) => {
				const r = originalT(key, options)
				return typeof r === "string" && modeName && r.includes("Jabberwock")
					? r.replace(/Jabberwock/g, modeName)
					: r
			},
			[originalT, modeName],
		) as (key: string, options?: Record<string, unknown>) => string
		useEffect(() => {
			const h = (event: MessageEvent) => {
				const msg = event.data
				if (
					msg.type === "selectedImages" &&
					msg.context === "edit" &&
					msg.messageTs === message.ts &&
					isEditing
				)
					setEditImages((prev) => appendImages(prev, msg.images, MAX_ATTACHED_IMAGES))
			}
			window.addEventListener("message", h)
			return () => window.removeEventListener("message", h)
		}, [isEditing, message.ts])
		const handleToggleExpand = useCallback(() => ui.toggleRowExpansion(message.ts), [ui, message.ts])
		const _handleEditClick = useCallback(() => {
			setIsEditing(true)
			setEditedContent(message.text || "")
			setEditImages(message.images || [])
			setEditMode(mode || "code")
		}, [message.text, message.images, mode])
		const _handleCancelEdit = useCallback(() => {
			setIsEditing(false)
			setEditedContent(message.text || "")
			setEditImages(message.images || [])
			setEditMode(mode || "code")
		}, [message.text, message.images, mode])
		const _handleSaveEdit = useCallback(() => {
			setIsEditing(false)
			rootStore.chat.submitEditedMessage(message.ts, editedContent, editImages)
		}, [message.ts, editedContent, editImages])
		const _handleSelectImages = useCallback(
			() => rootStore.chat.selectImagesForEdit("edit", message.ts),
			[message.ts],
		)
		const [cost, apiReqCancelReason, _apiReqStreamingFailedMessage] = extractApiReqInfo(message)
		const apiRequestFailedMessage = computeApiRequestFailedMessage(isLast, lastModifiedMessage)
		const isCommandExecuting = computeIsCommandExecuting(isLast, lastModifiedMessage)
		const isMcpServerResponding = computeIsMcpServerResponding(isLast, lastModifiedMessage)
		const type = computeType(message)
		const normalColor = "var(--vscode-foreground)"
		const errorColor = "var(--vscode-errorForeground)"
		const successColor = "var(--vscode-charts-green)"
		const cancelledColor = "var(--vscode-descriptionForeground)"
		const [icon, title] = useMemo(
			() =>
				computeIconTitle(
					type,
					isCommandExecuting,
					message,
					isMcpServerResponding,
					normalColor,
					t,
					successColor,
					apiReqCancelReason,
					cost,
					apiRequestFailedMessage,
					isLast,
					cancelledColor,
					errorColor,
					customModes,
				),
			[
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
			],
		)
		const tool = useMemo(
			() => (message.ask === "tool" ? (safeJsonParse<SayToolData>(message.text) ?? null) : null),
			[message.ask, message.text],
		)
		const _followUpData = useMemo(
			() =>
				message.type === "ask" && message.ask === "followup" && !message.partial
					? safeJsonParse<FollowUpData>(message.text)
					: null,
			[message.type, message.ask, message.partial, message.text],
		)
		const _headerStyle: React.CSSProperties = {
			display: "flex",
			alignItems: "center",
			gap: "10px",
			cursor: "default",
			marginBottom: "10px",
			wordBreak: "break-word",
		}
		return renderChatContent({
			message,
			t,
			tool,
			isExpanded,
			isNested,
			isRedundantTodo,
			effectiveHistory,
			handleToggleExpand,
			isStreaming: ui.isStreaming,
			isFollowUpAutoApprovalPaused: ui.isFollowUpAutoApprovalPaused,
			lastModifiedMessage,
			isLast,
			isRedundantDelegation,
			isAgentSaidSummary,
			modeName,
			icon,
			title,
			onSuggestionClick,
			i18n,
			isFollowUpAnswered,
			onBatchFileResponse: rootStore.windowManager.batchFileResponse,
		})
	},
)
