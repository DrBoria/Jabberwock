import type { ReactNode } from "react"
import type { Notification, FollowUpData, SayToolData } from "@jabberwock/types"
import { Mode } from "@shared/modes"

export interface UseChatRowOptions {
	message: Notification
	lastModifiedMessage?: Notification
	isLast: boolean
	isStreaming: boolean
	isNested?: boolean
	onToggleExpand: (ts: number) => void
	history?: Notification[]
}

export interface UseChatRowReturn {
	t: (key: string, options?: Record<string, unknown>) => string
	i18n: { exists: (key: string) => boolean }
	iconTitle: [ReactNode, ReactNode]
	tool: SayToolData | null
	followUpData: FollowUpData | null
	isRedundantDelegation: boolean
	isAgentSaidSummary: boolean
	isRedundantTodo: boolean
	modeName: string | undefined
	effectiveHistory: Notification[]
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
	cost: number | undefined
	apiReqCancelReason: string | undefined
	apiReqStreamingFailedMessage: string | undefined
	apiRequestFailedMessage: string | undefined
	isCommandExecuting: boolean
	isMcpServerResponding: boolean
}
