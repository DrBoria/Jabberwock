import { cn } from "@/lib/utils"
import type { ApiConfigListProps } from "./types"
import { ApiConfigItem } from "./ApiConfigItem"

export const ApiConfigList = ({
	filteredConfigs,
	searchValue,
	pinnedConfigs,
	unpinnedConfigs,
	value,
	onSelect,
	onTogglePin,
	t,
}: ApiConfigListProps) => {
	if (filteredConfigs.length === 0 && searchValue) {
		return <div className="py-2 px-3 text-sm text-vscode-foreground/70">{t("common:ui.no_results")}</div>
	}
	return (
		<div className="max-h-[300px] overflow-y-auto">
			{pinnedConfigs.length > 0 && (
				<div
					className={cn(
						"sticky top-0 z-10 bg-vscode-dropdown-background py-1",
						unpinnedConfigs.length > 0 && "border-b border-vscode-dropdown-foreground/10",
					)}
					aria-label="Pinned configurations">
					{pinnedConfigs.map((config) => (
						<ApiConfigItem
							key={config.id}
							config={config}
							isPinned={true}
							isCurrentConfig={config.id === value}
							onSelect={onSelect}
							onTogglePin={onTogglePin}
							t={t}
						/>
					))}
				</div>
			)}
			{unpinnedConfigs.length > 0 && (
				<div className="py-1" aria-label="All configurations">
					{unpinnedConfigs.map((config) => (
						<ApiConfigItem
							key={config.id}
							config={config}
							isPinned={false}
							isCurrentConfig={config.id === value}
							onSelect={onSelect}
							onTogglePin={onTogglePin}
							t={t}
						/>
					))}
				</div>
			)}
		</div>
	)
}
