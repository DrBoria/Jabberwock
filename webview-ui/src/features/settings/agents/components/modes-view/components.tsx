import React from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import type { ModeConfig, ToolGroup } from "./types"
import { availableGroups } from "./types"
import { getGroupName, getEditGroupDescription } from "./utils"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { findModeBySlug as findCustomModeBySlug } from "@shared/modes"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

// ─── Config Menu Dropdown ─────────────────────────────────────────────────

type ConfigMenuProps = {
	show: boolean
	onClose: () => void
}

export const ConfigMenu: React.FC<ConfigMenuProps> = ({ show, onClose }) => {
	const { t } = useAppTranslation()
	if (!show) return null

	return (
		<div
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
			className="absolute top-full right-0 w-[200px] mt-1 bg-vscode-editor-background border border-vscode-input-border rounded shadow-md z-[1000]">
			<div
				className="p-2 cursor-pointer text-vscode-foreground text-sm"
				onMouseDown={(e) => {
					e.preventDefault()
					rootStore.settings.openCustomModesSettings()
					onClose()
				}}
				onClick={(e) => e.preventDefault()}>
				{t("prompts:modes.editGlobalModes")}
			</div>
			<div
				className="p-2 cursor-pointer text-vscode-foreground text-sm border-t border-vscode-input-border"
				onMouseDown={(e) => {
					e.preventDefault()
					rootStore.settings.openFile("./.jabberwockmodes", {
						create: true,
						content: JSON.stringify({ customModes: [] }, null, 2),
					})
					onClose()
				}}
				onClick={(e) => e.preventDefault()}>
				{t("prompts:modes.editProjectModes")}
			</div>
		</div>
	)
}

// ─── Edit Tools Grid ────────────────────────────────────────────────────

type EditToolsGridProps = {
	availableGroups: ToolGroup[]
	getCurrentMode: () => ModeConfig | undefined
	visualMode: string
	customModes: ModeConfig[] | undefined
	onGroupChange: (group: ToolGroup, checked: boolean) => void
}

export const EditToolsGrid: React.FC<EditToolsGridProps> = ({
	availableGroups,
	getCurrentMode,
	visualMode,
	customModes,
	onGroupChange,
}) => {
	const { t } = useAppTranslation()
	const currentMode = getCurrentMode()
	const isCustomMode = findCustomModeBySlug(visualMode, customModes)

	return (
		<div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
			{availableGroups.map((group) => {
				const isGroupEnabled = isCustomMode
					? currentMode?.groups?.some((g) => getGroupName(g) === group)
					: false

				return (
					<VSCodeCheckbox
						key={group}
						checked={isGroupEnabled}
						onChange={() => onGroupChange(group, !isGroupEnabled)}
						disabled={!isCustomMode}>
						{t(`prompts:tools.toolNames.${group}`)}
						{group === "edit" && (
							<div className="text-xs text-vscode-descriptionForeground mt-0.5">
								{t("prompts:tools.allowedFiles")}{" "}
								{(() => {
									const desc = getEditGroupDescription(currentMode)
									return desc || t("prompts:allFiles")
								})()}
							</div>
						)}
					</VSCodeCheckbox>
				)
			})}
		</div>
	)
}

// ─── Display Tools List ─────────────────────────────────────────────────

type DisplayToolsListProps = {
	getCurrentMode: () => ModeConfig | undefined
}

export const DisplayToolsList: React.FC<DisplayToolsListProps> = ({ getCurrentMode }) => {
	const { t } = useAppTranslation()
	const currentMode = getCurrentMode()
	const enabledGroups = currentMode?.groups || []

	if (enabledGroups.length === 0) {
		return <div className="text-sm text-vscode-foreground mb-2 leading-relaxed">{t("prompts:tools.noTools")}</div>
	}

	const text = enabledGroups
		.map((group) => {
			const groupName = getGroupName(group)
			const displayName = t(`prompts:tools.toolNames.${groupName}`)
			if (Array.isArray(group) && group[1]?.fileRegex) {
				const description = group[1].description || `/${group[1].fileRegex}/`
				return `${displayName} (${description})`
			}
			return displayName
		})
		.join(", ")

	return <div className="text-sm text-vscode-foreground mb-2 leading-relaxed">{text}</div>
}

// ─── Tools Section ──────────────────────────────────────────────────────

type ToolsSectionProps = {
	visualMode: string
	customModes: ModeConfig[] | undefined
	isToolsEditMode: boolean
	getCurrentMode: () => ModeConfig | undefined
	onToggleEditMode: () => void
	onGroupChange: (group: ToolGroup, checked: boolean) => void
}

export const ToolsSection: React.FC<ToolsSectionProps> = ({
	visualMode,
	customModes,
	isToolsEditMode,
	getCurrentMode,
	onToggleEditMode,
	onGroupChange,
}) => {
	const { t } = useAppTranslation()
	const isCustomMode = findCustomModeBySlug(visualMode, customModes)

	return (
		<div className="mb-4">
			<div className="flex justify-between items-center mb-1">
				<div className="font-bold">{t("prompts:tools.title")}</div>
				{isCustomMode && (
					<StandardTooltip
						content={isToolsEditMode ? t("prompts:tools.doneEditing") : t("prompts:tools.editTools")}>
						<Button variant="ghost" size="icon" onClick={onToggleEditMode}>
							<span className={`codicon codicon-${isToolsEditMode ? "check" : "edit"}`} />
						</Button>
					</StandardTooltip>
				)}
			</div>
			{!isCustomMode && (
				<div className="text-sm text-vscode-descriptionForeground mb-2">
					{t("prompts:tools.builtInModesText")}
				</div>
			)}
			{isToolsEditMode && isCustomMode ? (
				<EditToolsGrid
					availableGroups={availableGroups}
					getCurrentMode={getCurrentMode}
					visualMode={visualMode}
					customModes={customModes}
					onGroupChange={onGroupChange}
				/>
			) : (
				<DisplayToolsList getCurrentMode={getCurrentMode} />
			)}
		</div>
	)
}
