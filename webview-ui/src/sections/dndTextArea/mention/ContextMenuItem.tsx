import React from "react"
import { getIconForFilePath, getIconUrlByName, getIconForDirectoryPath } from "vscode-material-icons"
import type { ContextMenuQueryItem } from "../utils/context-mentions/context-mentions"
import { ContextMenuOptionType } from "../utils/context-mentions/context-mentions"
import { MATERIAL_ICON_TYPES, NON_ICON_TYPES, CHEVRON_TYPES, getIconForOption, isOptionSelectable } from "./constants"
import { renderOptionContent } from "./renderers"

interface MenuItemProps {
	option: ContextMenuQueryItem
	index: number
	selectedIndex: number
	onSelect: (type: ContextMenuOptionType, value?: string) => void
	setSelectedIndex: (index: number) => void
	materialIconsBaseUri: string
}

const getMenuItemStyle = (
	option: ContextMenuQueryItem,
	index: number,
	selectedIndex: number,
	selectable: boolean,
): React.CSSProperties => ({
	padding: option.type === ContextMenuOptionType.SectionHeader ? "16px 8px 4px 8px" : "4px 8px",
	cursor: selectable ? "pointer" : "default",
	color: "var(--vscode-dropdown-foreground)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	position: "relative",
	...(option.type === ContextMenuOptionType.SectionHeader
		? { borderBottom: "1px solid var(--vscode-editorGroup-border)", marginBottom: "2px" }
		: {}),
	...(index === selectedIndex && selectable
		? {
				backgroundColor: "var(--vscode-list-activeSelectionBackground)",
				color: "var(--vscode-list-activeSelectionForeground)",
			}
		: {}),
})

const getMaterialIconSrc = (option: ContextMenuQueryItem, baseUri: string) =>
	getIconUrlByName(
		option.type === ContextMenuOptionType.Folder
			? getIconForDirectoryPath(option.value?.split("/").filter(Boolean).at(-1) ?? "")
			: getIconForFilePath(option.value?.split("/").filter(Boolean).at(-1) ?? ""),
		baseUri,
	)

const MenuItem: React.FC<MenuItemProps> = ({
	option,
	index,
	selectedIndex,
	onSelect,
	setSelectedIndex,
	materialIconsBaseUri,
}) => {
	const selectable = isOptionSelectable(option)
	const showMaterialIcon = MATERIAL_ICON_TYPES.has(option.type)
	const showCodicon = !NON_ICON_TYPES.has(option.type) && !!getIconForOption(option)
	const showChevron = CHEVRON_TYPES.has(option.type) && !option.value
	return (
		<div
			onClick={() => {
				if (selectable) onSelect(option.type, option.value)
			}}
			style={getMenuItemStyle(option, index, selectedIndex, selectable)}
			onMouseEnter={() => {
				if (selectable) setSelectedIndex(index)
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					flex: 1,
					minWidth: 0,
					overflow: "hidden",
					paddingTop: 0,
					position: "relative",
				}}>
				{showMaterialIcon && (
					<img
						src={getMaterialIconSrc(option, materialIconsBaseUri)}
						alt="Mode"
						style={{ marginRight: "6px", flexShrink: 0, width: "16px", height: "16px" }}
					/>
				)}
				{showCodicon && (
					<i
						className={`codicon codicon-${getIconForOption(option)}`}
						style={{ marginRight: "6px", flexShrink: 0, fontSize: "14px", marginTop: 0 }}
					/>
				)}
				{renderOptionContent(option)}
			</div>
			{showChevron && (
				<i
					className="codicon codicon-chevron-right"
					style={{ fontSize: "10px", flexShrink: 0, marginLeft: 8 }}
				/>
			)}
		</div>
	)
}

export type { MenuItemProps }
export default MenuItem
