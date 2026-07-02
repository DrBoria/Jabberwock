import React, { useMemo, useRef, useState } from "react"
import { t } from "i18next"
import type { ModeConfig, Command } from "@jabberwock/types"
import {
	ContextMenuOptionType,
	type ContextMenuQueryItem,
	getContextMenuOptions,
	type SearchResult,
} from "../utils/context-mentions/context-mentions"
import { useContextMenuScroll } from "./useContextMenuScroll"
import ContextMenuSearch from "./ContextMenuSearch"
import MenuItem from "./ContextMenuItem"

interface ContextMenuProps {
	onSelect: (type: ContextMenuOptionType, value?: string) => void
	searchQuery: string
	inputValue: string
	onMouseDown: () => void
	selectedIndex: number
	setSelectedIndex: (index: number) => void
	selectedType: ContextMenuOptionType
	queryItems: ContextMenuQueryItem[]
	modes?: ModeConfig[]
	loading?: boolean
	dynamicSearchResults?: SearchResult[]
	commands?: Command[]
}

const ContextMenuComponent: React.FC<ContextMenuProps> = ({
	onSelect,
	searchQuery,
	onMouseDown,
	selectedIndex,
	setSelectedIndex,
	selectedType,
	queryItems,
	modes,
	dynamicSearchResults = [],
	commands = [],
}) => {
	const [materialIconsBaseUri] = useState(
		(window as Window & { MATERIAL_ICONS_BASE_URI?: string }).MATERIAL_ICONS_BASE_URI ?? "",
	)
	const menuRef = useRef<HTMLDivElement>(null)
	const filteredOptions = useMemo(
		() => getContextMenuOptions(searchQuery, selectedType, queryItems, dynamicSearchResults, modes, commands),
		[searchQuery, selectedType, queryItems, dynamicSearchResults, modes, commands],
	)

	useContextMenuScroll(menuRef, selectedIndex)

	return (
		<div
			style={{ position: "absolute", bottom: "calc(100% - 10px)", left: 15, right: 15, overflowX: "hidden" }}
			onMouseDown={onMouseDown}>
			<div
				ref={menuRef}
				style={{
					backgroundColor: "var(--vscode-dropdown-background)",
					border: "1px solid var(--vscode-editorGroup-border)",
					borderRadius: "3px",
					boxShadow: "0 4px 10px rgba(0, 0, 0, 0.25)",
					zIndex: 1000,
					display: "flex",
					flexDirection: "column",
					maxHeight: "300px",
					overflowY: "auto",
					overflowX: "hidden",
				}}>
				<ContextMenuSearch searchQuery={searchQuery} />
				{filteredOptions && filteredOptions.length > 0 ? (
					filteredOptions.map((option, index) => (
						<MenuItem
							key={`${option.type}-${option.value || index}`}
							option={option}
							index={index}
							selectedIndex={selectedIndex}
							onSelect={onSelect}
							setSelectedIndex={setSelectedIndex}
							materialIconsBaseUri={materialIconsBaseUri}
						/>
					))
				) : (
					<div
						style={{
							padding: "4px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "var(--vscode-foreground)",
							opacity: 0.7,
						}}>
						<span>{t("chat:contextMenu.noResults")}</span>
					</div>
				)}
			</div>
		</div>
	)
}

export default ContextMenuComponent
