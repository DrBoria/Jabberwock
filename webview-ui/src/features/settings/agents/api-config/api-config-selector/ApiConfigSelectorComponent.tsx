import { useState, useMemo } from "react"
import { Fzf } from "fzf"
import { cn } from "@/lib/utils"
import { useJabberwockPortal } from "@/features/foundation/ui/hooks/useJabberwock/useJabberwockPortal"
import { Popover, PopoverContent, PopoverTrigger } from "@src/shared/ui/overlays/popover"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import type { ApiConfigSelectorProps } from "./types"
import { ApiConfigSearchHeader } from "./ApiConfigSearchHeader"
import { ApiConfigList } from "./ApiConfigList"
import { ApiConfigBottomBar } from "./ApiConfigBottomBar"

export const ApiConfigSelector = ({
	value,
	displayName,
	disabled = false,
	title,
	onChange,
	triggerClassName = "",
	listApiConfigMeta,
	pinnedApiConfigs,
	togglePinnedApiConfig,
	lockApiConfigAcrossModes,
	onToggleLockApiConfig,
}: ApiConfigSelectorProps) => {
	const { t } = useAppTranslation()
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const portalContainer = useJabberwockPortal("jabberwock-portal")
	const searchableItems = useMemo(
		() => listApiConfigMeta.map((config) => ({ original: config, searchStr: config.name })),
		[listApiConfigMeta],
	)
	const fzfInstance = useMemo(
		() => new Fzf(searchableItems, { selector: (item) => item.searchStr }),
		[searchableItems],
	)
	const filteredConfigs = useMemo(() => {
		if (!searchValue) return listApiConfigMeta
		return fzfInstance.find(searchValue).map((result) => result.item.original)
	}, [listApiConfigMeta, searchValue, fzfInstance])
	const { pinnedConfigs, unpinnedConfigs } = useMemo(() => {
		const pinned = filteredConfigs.filter((config) => pinnedApiConfigs?.[config.id])
		const unpinned = filteredConfigs.filter((config) => !pinnedApiConfigs?.[config.id])
		return { pinnedConfigs: pinned, unpinnedConfigs: unpinned }
	}, [filteredConfigs, pinnedApiConfigs])
	const handleSelect = (configId: string) => {
		onChange(configId)
		setOpen(false)
		setSearchValue("")
	}
	const handleEditClick = () => {
		rootStore.windowManager.switchTab("settings")
		setOpen(false)
	}
	const handleTogglePin = (configId: string) => {
		togglePinnedApiConfig(configId)
	}
	return (
		<Popover open={open} onOpenChange={setOpen} data-testid="api-config-selector-root">
			<StandardTooltip content={title}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="dropdown-trigger"
					className={cn(
						"min-w-0 inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					<span className="truncate">{displayName}</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				data-testid="popover-content"
				className="p-0 overflow-hidden w-[300px]">
				<div className="flex flex-col w-full">
					<ApiConfigSearchHeader
						listApiConfigMeta={listApiConfigMeta}
						searchValue={searchValue}
						onSearchChange={setSearchValue}
						onSearchClear={() => setSearchValue("")}
						t={t}
					/>
					<ApiConfigList
						filteredConfigs={filteredConfigs}
						searchValue={searchValue}
						pinnedConfigs={pinnedConfigs}
						unpinnedConfigs={unpinnedConfigs}
						value={value}
						onSelect={handleSelect}
						onTogglePin={handleTogglePin}
						t={t}
					/>
					<ApiConfigBottomBar
						listApiConfigMeta={listApiConfigMeta}
						lockApiConfigAcrossModes={lockApiConfigAcrossModes}
						onEditClick={handleEditClick}
						onToggleLockApiConfig={onToggleLockApiConfig}
						t={t}
					/>
				</div>
			</PopoverContent>
		</Popover>
	)
}
