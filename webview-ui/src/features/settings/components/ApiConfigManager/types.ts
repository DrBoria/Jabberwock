import type { ProviderSettingsEntry, OrganizationAllowList } from "@jabberwock/types"

export interface ApiConfigManagerProps {
	currentApiConfigName?: string
	listApiConfigMeta?: ProviderSettingsEntry[]
	organizationAllowList?: OrganizationAllowList
	onSelectConfig: (configName: string) => void
	onDeleteConfig: (configName: string) => void
	onRenameConfig: (oldName: string, newName: string) => void
	onUpsertConfig: (configName: string) => void
}
