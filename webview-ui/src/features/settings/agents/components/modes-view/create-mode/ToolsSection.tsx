import React from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import type { GroupEntry, ToolGroup } from "../types"
import { availableGroups } from "../types"
import { getGroupName } from "../utils"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface ToolsSectionProps {
	newModeGroups: GroupEntry[]
	groupsError: string
	onGroupToggle: (group: ToolGroup, checked: boolean) => void
}

export const ToolsSection: React.FC<ToolsSectionProps> = ({ newModeGroups, groupsError, onGroupToggle }) => {
	const { t } = useAppTranslation()

	return (
		<div className="mb-4">
			<div className="font-bold mb-1">{t("prompts:createModeDialog.tools.label")}</div>
			<div className="text-[13px] text-vscode-descriptionForeground mb-2">
				{t("prompts:createModeDialog.tools.description")}
			</div>
			<div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
				{availableGroups.map((group) => (
					<VSCodeCheckbox
						key={group}
						checked={newModeGroups.some((g) => getGroupName(g) === group)}
						onChange={(e: Event | React.FormEvent<HTMLElement>) => {
							const target = (e as CustomEvent)?.detail?.target || (e.target as HTMLInputElement)
							onGroupToggle(group, target.checked)
						}}>
						{t(`prompts:tools.toolNames.${group}`)}
					</VSCodeCheckbox>
				))}
			</div>
			{groupsError && <div className="text-xs text-vscode-errorForeground mt-1">{groupsError}</div>}
		</div>
	)
}
