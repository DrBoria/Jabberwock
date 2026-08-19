import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useSearchIndexRegistry } from "../../settings-search/useSettingsSearch"
import { SectionName, sectionNames } from "../constants"

export function useSettingsSearchIndex(
	getSectionLabel: (section: SectionName) => string,
	activeTab: SectionName,
	setActiveTab: (tab: SectionName) => void,
	handleTabChange: (tab: SectionName) => void,
) {
	const { registerSetting, index: searchIndex } = useSearchIndexRegistry(getSectionLabel)

	const [indexingTabIndex, setIndexingTabIndex] = useState(0)
	const initialTab = useRef<SectionName>(activeTab)
	const isIndexing = indexingTabIndex < sectionNames.length
	const tabTitlesRegistered = useRef(false)

	useLayoutEffect(() => {
		if (indexingTabIndex >= sectionNames.length) {
			if (!tabTitlesRegistered.current && registerSetting) {
				sectionNames.forEach((id) =>
					registerSetting({
						settingId: `tab-${id}`,
						section: id,
						label: getSectionLabel(id),
					}),
				)
				tabTitlesRegistered.current = true
				setActiveTab(initialTab.current)
			}
			return
		}
		setIndexingTabIndex((prev) => prev + 1)
	}, [indexingTabIndex, registerSetting, getSectionLabel, setActiveTab])

	const renderTab = useMemo(
		() => (isIndexing ? sectionNames[indexingTabIndex] : activeTab),
		[isIndexing, indexingTabIndex, activeTab],
	)

	const handleSearchNavigate = useCallback(
		(section: SectionName, settingId: string) => {
			handleTabChange(section)
			requestAnimationFrame(() =>
				setTimeout(() => {
					const element = document.querySelector(`[data-setting-id="${settingId}"]`)
					if (element) {
						element.scrollIntoView({ behavior: "smooth", block: "center" })
						element.classList.add("settings-highlight")
						setTimeout(() => element.classList.remove("settings-highlight"), 1500)
					}
				}, 100),
			)
		},
		[handleTabChange],
	)

	const tabContentClass = useMemo(
		() => (isIndexing ? "p-0 flex-1 overflow-auto opacity-0" : "p-0 flex-1 overflow-auto"),
		[isIndexing],
	)

	return { registerSetting, index: searchIndex, isIndexing, renderTab, handleSearchNavigate, tabContentClass }
}
