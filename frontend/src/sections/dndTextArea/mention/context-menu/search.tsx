import React from "react"
import { Trans } from "react-i18next"
import { t } from "i18next"
import { Settings } from "lucide-react"
import { buildDocLink } from "@/utils/misc/docLinks"
import { rootStore } from "@src/features/store"

interface ContextMenuSearchProps {
	searchQuery: string
}

const handleSettingsClick = (e: React.MouseEvent) => {
	e.preventDefault()
	rootStore.windowManager.switchTab("settings", { section: "slashCommands" })
}

const ContextMenuSearch: React.FC<ContextMenuSearchProps> = ({ searchQuery }) => {
	if (searchQuery !== "/") return null

	return (
		<div className="p-2 flex items-start gap-4 justify-between">
			{searchQuery.length === 1 && (
				<div className="text-sm">
					<p className="font-bold text-base text-vscode-foreground mt-1 mb-0.5">Slash Commands</p>
					<p className="text-xs mt-0.5 -mb-1">
						<Trans
							i18nKey="settings:slashCommands.description"
							components={{
								DocsLink: (
									<a
										href={buildDocLink("features/slash-commands", "slash_commands_settings")}
										target="_blank"
										rel="noopener noreferrer"
										className="text-vscode-textLink-foreground hover:underline">
										{t("common:docsLink.label")}
									</a>
								),
							}}
						/>
					</p>
				</div>
			)}
			<button
				className="mt-1 cursor-pointer"
				onClick={handleSettingsClick}
				onMouseDown={(e) => {
					e.stopPropagation()
					e.preventDefault()
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.opacity = "1"
					e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground)"
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.opacity = "0.7"
					e.currentTarget.style.backgroundColor = "transparent"
				}}
				title={t("chat:slashCommands.manageCommands")}>
				<Settings size={16} />
			</button>
		</div>
	)
}

export default ContextMenuSearch
