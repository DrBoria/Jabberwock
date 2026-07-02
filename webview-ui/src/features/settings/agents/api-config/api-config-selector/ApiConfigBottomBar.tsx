import { IconButton } from "@src/shared/ui/buttons/icon-button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import type { ApiConfigBottomBarProps } from "./types"

export const ApiConfigBottomBar = ({
	listApiConfigMeta,
	lockApiConfigAcrossModes,
	onEditClick,
	onToggleLockApiConfig,
	t,
}: ApiConfigBottomBarProps) => {
	const showInfo = listApiConfigMeta.length > 6
	return (
		<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
			<div className="flex flex-row gap-1">
				<IconButton
					iconClass="codicon-settings-gear"
					title={t("chat:edit")}
					onClick={onEditClick}
					tooltip={false}
				/>
				<IconButton
					iconClass={lockApiConfigAcrossModes ? "codicon-lock" : "codicon-unlock"}
					title={
						lockApiConfigAcrossModes
							? t("chat:unlockApiConfigAcrossModes")
							: t("chat:lockApiConfigAcrossModes")
					}
					className={lockApiConfigAcrossModes ? "text-vscode-focusBorder" : "opacity-60"}
					onClick={onToggleLockApiConfig}
				/>
			</div>
			<div className="flex items-center gap-1 pr-1">
				{showInfo && (
					<StandardTooltip content={t("prompts:apiConfiguration.select")}>
						<span className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help" />
					</StandardTooltip>
				)}
				<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
					{t("prompts:apiConfiguration.title")}
				</h4>
			</div>
		</div>
	)
}
