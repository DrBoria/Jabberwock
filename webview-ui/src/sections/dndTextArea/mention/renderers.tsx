import React from "react"
import { t } from "i18next"
import type { ContextMenuQueryItem } from "../utils/context-mentions/context-mentions"
import { ContextMenuOptionType } from "../utils/context-mentions/context-mentions"
import { removeLeadingNonAlphanumeric } from "@src/utils/helpers/removeLeadingNonAlphanumeric"

export const renderSectionHeaderContent = (option: ContextMenuQueryItem) => (
	<span style={{ fontWeight: "bold", fontSize: "0.85em", opacity: 0.8 }}>{option.label}</span>
)

export const renderModeContent = (option: ContextMenuQueryItem) => (
	<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
		<div style={{ lineHeight: "1.2" }}>
			<span>{option.slashCommand}</span>
		</div>
		{option.description && (
			<span
				style={{
					opacity: 0.5,
					fontSize: "0.9em",
					lineHeight: "1.2",
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
				}}>
				{option.description}
			</span>
		)}
	</div>
)

export const renderCommandContent = (option: ContextMenuQueryItem) => (
	<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
		<div style={{ lineHeight: "1.2", display: "flex", alignItems: "center", gap: "6px" }}>
			<span>{option.slashCommand}</span>
			{option.argumentHint && (
				<span style={{ opacity: 0.5, fontSize: "0.9em", lineHeight: "1.2" }}>{option.argumentHint}</span>
			)}
		</div>
		{option.description && (
			<span
				style={{
					opacity: 0.5,
					fontSize: "0.9em",
					lineHeight: "1.2",
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
				}}>
				{option.description}
			</span>
		)}
	</div>
)

export const renderGoalContent = (option: ContextMenuQueryItem) => (
	<div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
		<span style={{ lineHeight: "1.2" }}>{option.value}</span>
		{option.description && (
			<span
				style={{
					fontSize: "0.85em",
					opacity: 0.7,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
					lineHeight: "1.2",
				}}>
				{option.description}
			</span>
		)}
	</div>
)

export const renderGitContent = (option: ContextMenuQueryItem) =>
	option.value ? (
		<div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
			<span style={{ lineHeight: "1.2" }}>{option.label}</span>
			<span
				style={{
					fontSize: "0.85em",
					opacity: 0.7,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
					lineHeight: "1.2",
				}}>
				{option.description}
			</span>
		</div>
	) : (
		<span>Git Commits</span>
	)

export const renderFileContent = (option: ContextMenuQueryItem) =>
	option.value ? (
		(() => {
			const path = removeLeadingNonAlphanumeric(option.value || "").replace(/\/$/, "")
			const pathList = path.split("/")
			return (
				<div
					style={{
						flex: 1,
						overflow: "hidden",
						display: "flex",
						gap: "0.5em",
						whiteSpace: "nowrap",
						alignItems: "center",
						justifyContent: "space-between",
						textAlign: "left",
					}}>
					<span>{pathList.at(-1)}</span>
					<span
						style={{
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							direction: "rtl",
							textAlign: "right",
							flex: 1,
							opacity: 0.75,
							fontSize: "0.75em",
						}}>
						{pathList.slice(0, -1).join("/")}
					</span>
				</div>
			)
		})()
	) : (
		<span>Add {option.type === ContextMenuOptionType.File ? "File" : "Folder"}</span>
	)

export const optionRenderers: Partial<
	Record<ContextMenuOptionType, (option: ContextMenuQueryItem) => React.ReactNode>
> = {
	[ContextMenuOptionType.SectionHeader]: renderSectionHeaderContent,
	[ContextMenuOptionType.Mode]: renderModeContent,
	[ContextMenuOptionType.Command]: renderCommandContent,
	[ContextMenuOptionType.Problems]: () => <span>{t("chat:contextMenu.problems")}</span>,
	[ContextMenuOptionType.Terminal]: () => <span>{t("chat:contextMenu.terminal")}</span>,
	[ContextMenuOptionType.URL]: () => <span>{t("chat:contextMenu.url")}</span>,
	[ContextMenuOptionType.NoResults]: () => <span>{t("chat:contextMenu.noResults")}</span>,
	[ContextMenuOptionType.Goal]: renderGoalContent,
	[ContextMenuOptionType.Git]: renderGitContent,
	[ContextMenuOptionType.File]: renderFileContent,
	[ContextMenuOptionType.OpenedFile]: renderFileContent,
	[ContextMenuOptionType.Folder]: renderFileContent,
}

export const renderOptionContent = (option: ContextMenuQueryItem) => {
	const fn = optionRenderers[option.type]
	return fn ? fn(option) : null
}
