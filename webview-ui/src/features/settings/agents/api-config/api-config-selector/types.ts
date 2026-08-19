export interface ApiConfigSelectorProps {
	value: string
	displayName: string
	disabled?: boolean
	title: string
	onChange: (value: string) => void
	triggerClassName?: string
	listApiConfigMeta: Array<{ id: string; name: string; modelId?: string }>
	pinnedApiConfigs?: Record<string, boolean>
	togglePinnedApiConfig: (id: string) => void
	lockApiConfigAcrossModes: boolean
	onToggleLockApiConfig: () => void
}

export interface ApiConfigMeta {
	id: string
	name: string
	modelId?: string
}

export interface ApiConfigItemProps {
	config: ApiConfigMeta
	isPinned: boolean
	isCurrentConfig: boolean
	onSelect: (id: string) => void
	onTogglePin: (id: string) => void
	t: (key: string) => string
}

export interface ApiConfigSearchHeaderProps {
	listApiConfigMeta: ApiConfigMeta[]
	searchValue: string
	onSearchChange: (value: string) => void
	onSearchClear: () => void
	t: (key: string) => string
}

export interface ApiConfigListProps {
	filteredConfigs: ApiConfigMeta[]
	searchValue: string
	pinnedConfigs: ApiConfigMeta[]
	unpinnedConfigs: ApiConfigMeta[]
	value: string
	onSelect: (id: string) => void
	onTogglePin: (id: string) => void
	t: (key: string) => string
}

export interface ApiConfigBottomBarProps {
	listApiConfigMeta: ApiConfigMeta[]
	lockApiConfigAcrossModes: boolean
	onEditClick: () => void
	onToggleLockApiConfig: () => void
	t: (key: string) => string
}
