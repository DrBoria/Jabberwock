import React from "react"
import { Fzf } from "fzf"
import { type ModeConfig, type CustomModePrompts, TelemetryEventName } from "@jabberwock/types"
import { type Mode, getAllModes } from "@shared/modes"
import { telemetryClient } from "@/features/cloud/utils/TelemetryClient"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useJabberwockPortal } from "@/features/foundation/ui/hooks/useJabberwock/useJabberwockPortal"

const SEARCH_THRESHOLD = 6

interface UseModeSelectorOptions {
	value: Mode
	onChange: (value: Mode) => void
	modeShortcutText: string
	customModes?: ModeConfig[]
	customModePrompts?: CustomModePrompts
	disableSearch?: boolean
}

interface UseModeSelectorResult {
	open: boolean
	setOpen: (v: boolean) => void
	searchValue: string
	setSearchValue: (v: string) => void
	searchInputRef: React.RefObject<HTMLInputElement>
	selectedItemRef: React.RefObject<HTMLDivElement>
	portalContainer: HTMLElement | undefined
	showSearch: boolean
	instructionText: string
	onClearSearch: () => void
	filteredModes: ModeConfig[]
	handleSelect: (slug: string) => void
	onOpenChange: (isOpen: boolean) => void
	selectedMode: ModeConfig | undefined
	t: (key: string, options?: Record<string, unknown>) => string
}

export function useModeSelector({
	value,
	onChange,
	modeShortcutText,
	customModes,
	customModePrompts,
	disableSearch = false,
}: UseModeSelectorOptions): UseModeSelectorResult {
	const [open, setOpen] = React.useState(false)
	const [searchValue, setSearchValue] = React.useState("")
	const searchInputRef = React.useRef<HTMLInputElement>(null)
	const selectedItemRef = React.useRef<HTMLDivElement>(null)
	const scrollContainerRef = React.useRef<HTMLDivElement>(null)
	const portalContainer = useJabberwockPortal("jabberwock-portal")
	const { t } = useAppTranslation()

	const trackModeSelectorOpened = React.useCallback(() => {
		telemetryClient?.capture?.(TelemetryEventName.MODE_SELECTOR_OPENED)
	}, [])

	const modes = React.useMemo(() => {
		const allModes = getAllModes(customModes)
		return allModes.map((mode) => ({
			...mode,
			description: customModePrompts?.[mode.slug]?.roleDefinition ?? mode.description,
		}))
	}, [customModes, customModePrompts])

	React.useEffect(() => {
		if (open && selectedItemRef.current && scrollContainerRef.current) {
			requestAnimationFrame(() => {
				selectedItemRef.current?.scrollIntoView({ block: "nearest" })
			})
		}
	}, [open])

	const nameSearchItems = React.useMemo(
		() => modes.map((mode) => ({ original: mode, searchStr: mode.name })),
		[modes],
	)

	const descriptionSearchItems = React.useMemo(
		() => modes.map((mode) => ({ original: mode, searchStr: mode.description || "" })),
		[modes],
	)

	const nameFzf = React.useMemo(
		() => new Fzf(nameSearchItems, { selector: (item) => item.searchStr }),
		[nameSearchItems],
	)

	const descriptionFzf = React.useMemo(
		() => new Fzf(descriptionSearchItems, { selector: (item) => item.searchStr }),
		[descriptionSearchItems],
	)

	const filteredModes = React.useMemo(() => {
		if (!searchValue) return modes
		const nameMatches = new Set(nameFzf.find(searchValue).map((r) => r.item.original.slug))
		const descriptionMatches = new Set(descriptionFzf.find(searchValue).map((r) => r.item.original.slug))
		return modes.filter((mode) => new Set([...nameMatches, ...descriptionMatches]).has(mode.slug))
	}, [modes, searchValue, nameFzf, descriptionFzf])

	const showSearch = React.useMemo(
		() => !disableSearch && modes.length > SEARCH_THRESHOLD,
		[disableSearch, modes.length],
	)

	const instructionText = React.useMemo(
		() => t("chat:modeSelector.instruction", { shortcut: modeShortcutText }),
		[t, modeShortcutText],
	)

	const onClearSearch = React.useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])

	const handleSelect = React.useCallback(
		(modeSlug: string) => {
			if (modeSlug !== value) onChange(modeSlug)
			setOpen(false)
			setSearchValue("")
		},
		[onChange, value],
	)

	const onOpenChange = React.useCallback(
		(isOpen: boolean) => {
			setOpen(isOpen)
			if (isOpen) {
				trackModeSelectorOpened()
				requestAnimationFrame(() => {
					searchInputRef.current?.focus()
				})
			} else {
				setSearchValue("")
			}
		},
		[trackModeSelectorOpened],
	)

	React.useEffect(() => {
		if (!open || !showSearch) return
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false)
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [open, showSearch])

	const selectedMode = modes.find((m) => m.slug === value)

	return {
		open,
		setOpen,
		searchValue,
		setSearchValue,
		searchInputRef,
		selectedItemRef,
		portalContainer,
		showSearch,
		instructionText,
		onClearSearch,
		filteredModes,
		handleSelect,
		onOpenChange,
		selectedMode,
		t,
	}
}
