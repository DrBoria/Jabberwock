import { Fzf } from "fzf"

export enum DropdownOptionType {
	ITEM = "item",
	SEPARATOR = "separator",
	SHORTCUT = "shortcut",
	ACTION = "action",
}

export interface DropdownOption {
	value: string
	label: string
	disabled?: boolean
	type?: DropdownOptionType
	pinned?: boolean
}

export interface SelectDropdownProps {
	value: string
	options: DropdownOption[]
	onChange: (value: string) => void
	disabled?: boolean
	title?: string
	triggerClassName?: string
	contentClassName?: string
	itemClassName?: string
	sideOffset?: number
	align?: "start" | "center" | "end"
	placeholder?: string
	shortcutText?: string
	renderItem?: (option: DropdownOption) => React.ReactNode
	disableSearch?: boolean
}

export const getDisplayText = (
	value: string,
	selectedOption: DropdownOption | undefined,
	placeholder: string,
): string => (value && !selectedOption && placeholder ? placeholder : selectedOption?.label || placeholder || "")

export const isShortcutOrDisabledItem = (option: DropdownOption, shortcutText: string): boolean =>
	option.type === DropdownOptionType.SHORTCUT ||
	!!(option.disabled && !!shortcutText && option.label.includes(shortcutText))

export const isSearchableOption = (option: DropdownOption): boolean =>
	option.type !== DropdownOptionType.SEPARATOR && option.type !== DropdownOptionType.SHORTCUT

export const buildSearchableItems = (options: DropdownOption[]) =>
	options
		.filter(isSearchableOption)
		.map((o) => ({ original: o, searchStr: [o.label, o.value].filter(Boolean).join(" ") }))

export const filterOptions = (
	options: DropdownOption[],
	searchValue: string,
	fzf: Fzf<Array<{ original: DropdownOption; searchStr: string }>>,
	disableSearch: boolean,
) => {
	if (disableSearch || !searchValue) return options
	const items = fzf.find(searchValue).map((r) => r.item.original)
	return options.filter((o) => (isSearchableOption(o) ? items.some((i) => i.value === o.value) : true))
}

export const groupOptions = (filteredOptions: DropdownOption[]) => {
	const result: DropdownOption[] = []
	let lastWasSeparator = false
	filteredOptions.forEach((o) => {
		if (o.type === DropdownOptionType.SEPARATOR) {
			if (result.length > 0 && !lastWasSeparator) {
				result.push(o)
				lastWasSeparator = true
			}
		} else {
			result.push(o)
			lastWasSeparator = false
		}
	})
	if (result.length > 0 && result[result.length - 1].type === DropdownOptionType.SEPARATOR) result.pop()
	return result
}

export interface DropdownSearchProps {
	searchValue: string
	onSearchChange: (value: string) => void
	onClearSearch: () => void
}

export interface SelectDropdownInnerProps {
	open: boolean
	title: string
	triggerContent: React.ReactNode
	portalContainer: HTMLElement | undefined
	align: "start" | "center" | "end"
	sideOffset: number
	contentClassName: string
	disableSearch: boolean
	searchValue: string
	onSearchChange: (value: string) => void
	onClearSearch: () => void
	onOpenChange: (open: boolean) => void
	showNoResults: boolean
	groupedOptions: DropdownOption[]
	value: string
	shortcutText: string
	itemClassName: string
	renderItem?: (option: DropdownOption) => React.ReactNode
	handleSelect: (value: string) => void
}

export interface DropdownTriggerProps {
	ref: React.Ref<React.ElementRef<typeof import("../overlays/popover").PopoverTrigger>>
	disabled: boolean
	triggerClassName: string
	displayText: string
}
