import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { Fzf } from "fzf"

import type { SectionName } from "../SettingsView/constants"
import { SettingsSearchStoreModel } from "../../search/store"

export interface SearchableSettingData {
	settingId: string
	section: SectionName
	label: string
	sectionLabel: string
}

export interface SearchResult {
	settingId: string
	section: SectionName
	label: string
	sectionLabel: string
	/** Character positions that matched the search query (for highlighting) */
	positions: Set<number>
}

// ── Module-level registry (module-level mutable state is explicitly allowed by no-state-outside-mobx) ──
// Only one SettingsView exists at a time, so a single module-level reference is safe.

type RegisterFn = (setting: Omit<SearchableSettingData, "sectionLabel">) => void

let currentRegisterSetting: RegisterFn | null = null

/**
 * Set the current registerSetting function for the active SettingsView.
 * Called from useSearchIndexRegistry on mount/cleanup.
 */
function setActiveRegisterSetting(fn: RegisterFn | null) {
	currentRegisterSetting = fn
}

/**
 * Hook for deeply nested SearchableSetting components to register themselves.
 * Reads from module-level state — no React.createContext needed.
 */
export function useSearchIndexContext(): { registerSetting: RegisterFn } | null {
	if (!currentRegisterSetting) {
		return null
	}
	return { registerSetting: currentRegisterSetting }
}

/**
 * Hook to create a search index registry.
 * Returns the register function and the current index.
 */
export function useSearchIndexRegistry(getSectionLabel: (section: SectionName) => string) {
	const settingsRef = useRef<Map<string, Omit<SearchableSettingData, "sectionLabel">>>(new Map())
	const updateScheduled = useRef(false)
	const storeRef = useRef<ReturnType<typeof SettingsSearchStoreModel.create>>()

	if (!storeRef.current) {
		storeRef.current = SettingsSearchStoreModel.create({ index: [] })
	}

	const scheduleUpdate = useCallback(() => {
		if (updateScheduled.current) return
		updateScheduled.current = true

		// Batch updates to avoid frequent re-renders
		requestAnimationFrame(() => {
			const settings = Array.from(settingsRef.current.values()).map((s) => ({
				...s,
				sectionLabel: getSectionLabel(s.section),
			}))
			if (storeRef.current) {
				storeRef.current.setIndex(settings)
			}
			updateScheduled.current = false
		})
	}, [getSectionLabel])

	const registerSetting = useCallback(
		(setting: Omit<SearchableSettingData, "sectionLabel">) => {
			settingsRef.current.set(setting.settingId, setting)
			scheduleUpdate()
		},
		[scheduleUpdate],
	)

	// Register/unregister the module-level function for SearchableSetting components
	useEffect(() => {
		setActiveRegisterSetting(registerSetting)
		return () => setActiveRegisterSetting(null)
	}, [registerSetting])

	return { registerSetting, index: storeRef.current?.index ?? [] }
}

/**
 * Scan the DOM for searchable settings within a container.
 * This is called once on mount to build the index.
 */
export function scanDOMForSearchableSettings(
	container: Element,
	getSectionLabel: (section: SectionName) => string,
): SearchableSettingData[] {
	const settings: SearchableSettingData[] = []
	const elements = container.querySelectorAll("[data-searchable]")

	elements.forEach((el) => {
		const settingId = el.getAttribute("data-setting-id")
		const section = el.getAttribute("data-setting-section") as SectionName | null
		const label = el.getAttribute("data-setting-label")

		if (settingId && section && label) {
			settings.push({
				settingId,
				section,
				label,
				sectionLabel: getSectionLabel(section),
			})
		}
	})

	return settings
}

interface UseSettingsSearchOptions {
	index: SearchableSettingData[]
}

/**
 * Hook for searching settings using fuzzy matching.
 */
export function useSettingsSearch({ index }: UseSettingsSearchOptions) {
	const [searchQuery, setSearchQuery] = useState("")
	const [isOpen, setIsOpen] = useState(false)

	// Create Fzf instance for fuzzy searching
	const fzf = useMemo(
		() =>
			new Fzf(index, {
				selector: (item) => `${item.label} ${item.sectionLabel}`,
			}),
		[index],
	)

	// Search results
	const results = useMemo((): SearchResult[] => {
		if (!searchQuery.trim()) {
			return []
		}

		const fzfResults = fzf.find(searchQuery)
		return fzfResults.slice(0, 10).map((result) => ({
			settingId: result.item.settingId,
			section: result.item.section,
			label: result.item.label,
			sectionLabel: result.item.sectionLabel,
			positions: result.positions,
		}))
	}, [fzf, searchQuery])

	const clearSearch = useCallback(() => {
		setSearchQuery("")
		setIsOpen(false)
	}, [])

	return {
		searchQuery,
		setSearchQuery,
		results,
		isOpen,
		setIsOpen,
		clearSearch,
	}
}
