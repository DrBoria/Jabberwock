import { cn } from "@/lib/utils"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { rootStore } from "@src/features/store"
import type { ApiConfigItemProps } from "./types"

export const ApiConfigItem = ({ config, isPinned, isCurrentConfig, onSelect, onTogglePin, t }: ApiConfigItemProps) => {
	const showCheck = isCurrentConfig
	const showModelId = config.modelId != null
	return (
		<div
			key={config.id}
			onClick={() => onSelect(config.id)}
			className={cn(
				"px-3 py-1.5 text-sm cursor-pointer flex items-center group hover:bg-vscode-list-hoverBackground",
				isCurrentConfig &&
					"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
			)}>
			<div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
				<span className="flex-shrink-0">{config.name}</span>
				{showModelId && (
					<span
						className="text-vscode-descriptionForeground opacity-70 min-w-0 overflow-hidden"
						style={{ direction: "rtl", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
						{config.modelId}
					</span>
				)}
			</div>
			<div className="flex items-center gap-1">
				{showCheck && (
					<div className="size-5 p-1 flex items-center justify-center">
						<span className="codicon codicon-check text-xs" />
					</div>
				)}
				<StandardTooltip content={isPinned ? t("chat:unpin") : t("chat:pin")}>
					<Button
						variant="ghost"
						size="icon"
						tabIndex={-1}
						onClick={(e) => {
							e.stopPropagation()
							onTogglePin(config.id)
							rootStore.settings.toggleApiConfigPin(config.id)
						}}
						className={cn("size-5 flex items-center justify-center", {
							"opacity-0 group-hover:opacity-100": !isPinned && !isCurrentConfig,
							"bg-accent opacity-100": isPinned,
						})}>
						<span className="codicon codicon-pin text-xs opacity-50" />
					</Button>
				</StandardTooltip>
			</div>
		</div>
	)
}
