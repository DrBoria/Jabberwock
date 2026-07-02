import type { Mode } from "@shared/modes"
import type { Goal, CloudUserInfo, CustomModePrompts, ModeConfig } from "@jabberwock/types"
import type { IDynamicTextAreaStore } from "../store"

export interface DndTextAreaProps {
	placeholderText: string
	onSend: () => void
	onSelectImages: () => void
	shouldDisableImages: boolean
	onHeightChange?: (height: number) => void
	modeShortcutText: string
	isEditMode?: boolean
	onCancel?: () => void
	isStreaming?: boolean
	onStop?: () => void
	onEnqueueMessage?: () => void
	goals?: Goal[]
	onAddGoal?: (text: string) => void
	onRemoveGoal?: (id: string) => void
	onUpdateGoal?: (id: string, partial: Partial<Goal>) => void
	onReorderGoals?: (fromIndex: number, toIndex: number) => void
}

export interface DraggableGoalProps {
	goal: Goal
	index: number
	moveGoal: (dragIndex: number, hoverIndex: number) => void
	removeGoal: (id: string) => void
	updateGoal?: (id: string, partial: Partial<Goal>) => void
}

export interface GoalsSectionProps {
	goals: Goal[]
	isEditMode: boolean
	onAddGoal?: (text: string) => void
	hasContent: boolean
	moveGoal: (dragIndex: number, hoverIndex: number) => void
	onRemoveGoal?: (id: string) => void
	onUpdateGoal?: (id: string, partial: Partial<Goal>) => void
	textAreaStore: IDynamicTextAreaStore
	t: (key: string, params?: Record<string, string>) => string
}

export interface EditModeGoalInputProps {
	textAreaStore: IDynamicTextAreaStore
	onAddGoal?: (text: string) => void
}

export interface ActionButtonsProps {
	isEditMode: boolean
	isStreaming: boolean
	shouldDisableImages: boolean
	hasContent: boolean
	hasTextInput: boolean
	onSelectImages: () => void
	onCancel?: () => void
	handleEnhancePrompt: () => void
	isEnhancingPrompt: boolean
	onEnqueueMessage?: () => void
	sendKeyCombination: string
	isSendVisible: boolean
	onSend: () => void
	onStop?: () => void
	t: (key: string, params?: Record<string, string>) => string
}

export interface PlaceholderBottomProps {
	isEditMode: boolean
	hasInputValue: boolean
	placeholderBottomText: string
}

export interface BottomToolbarProps {
	mode: string
	handleModeChange: (value: Mode) => void
	currentConfigId: string
	displayName: string
	sendingDisabled: boolean
	handleApiConfigChange: (value: string) => void
	listApiConfigMeta?: Array<{ id: string; name: string; errors?: string[] }>
	pinnedApiConfigs?: Record<string, boolean>
	togglePinnedApiConfig: (name: string) => void
	lockApiConfigAcrossModes: boolean
	handleToggleLockApiConfig: () => void
	customModes?: ModeConfig[]
	customModePrompts?: CustomModePrompts
	modeShortcutText: string
	devtoolEnabled: boolean
	toggleDevtool: () => void
	isTtsPlaying: boolean
	stopTts: () => void
	isEditMode: boolean
	cloudUserInfo?: CloudUserInfo | null
	t: (key: string, params?: Record<string, string>) => string
}
