import { type ModeConfig, type CustomModePrompts } from "@jabberwock/types"
import { type Mode } from "@shared/modes"

export interface ModeSelectorProps {
	value: Mode
	onChange: (value: Mode) => void
	disabled?: boolean
	title: string
	triggerClassName?: string
	modeShortcutText: string
	customModes?: ModeConfig[]
	customModePrompts?: CustomModePrompts
	disableSearch?: boolean
}

export interface ModeSelectorContentProps {
	searchValue: string
	setSearchValue: (v: string) => void
	searchInputRef: React.RefObject<HTMLInputElement>
	portalContainer: HTMLElement | undefined
	showSearch: boolean
	instructionText: string
	onClearSearch: () => void
	filteredModes: ModeConfig[]
	value: Mode
	handleSelect: (slug: string) => void
	selectedItemRef: React.RefObject<HTMLDivElement>
	t: (key: string, options?: Record<string, unknown>) => string
	setOpen: (v: boolean) => void
}
