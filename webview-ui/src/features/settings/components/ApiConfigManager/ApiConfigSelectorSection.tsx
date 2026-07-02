import { AlertTriangle } from "lucide-react"
import type { ProviderSettingsEntry } from "@jabberwock/types"
import type { SearchableSelectOption } from "@src/shared/ui/selects/searchable-select"
import { Button } from "@src/shared/ui/buttons/button"
import { SearchableSelect } from "@src/shared/ui/selects/searchable-select"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface ApiConfigSelectorSectionProps {
	currentApiConfigName: string
	listApiConfigMeta: ProviderSettingsEntry[]
	isOnlyProfile: boolean
	isProfileValid: (profile: ProviderSettingsEntry) => boolean
	onSelectConfig: (configName: string) => void
	onAdd: () => void
	onStartRename: () => void
	onDelete: () => void
	t: (key: string) => string
}

export const ApiConfigSelectorSection = ({
	currentApiConfigName,
	listApiConfigMeta,
	isOnlyProfile,
	isProfileValid,
	onSelectConfig,
	onAdd,
	onStartRename,
	onDelete,
	t,
}: ApiConfigSelectorSectionProps) => (
	<>
		<div className="flex items-center gap-1">
			<SearchableSelect
				value={currentApiConfigName}
				onValueChange={onSelectConfig}
				options={listApiConfigMeta.map((config) => {
					const valid = isProfileValid(config)
					return {
						value: config.name,
						label: config.name,
						disabled: !valid,
						icon: !valid ? (
							<StandardTooltip content={t("settings:validation.profileInvalid")}>
								<span>
									<AlertTriangle size={16} className="mr-2 text-vscode-errorForeground" />
								</span>
							</StandardTooltip>
						) : undefined,
					} as SearchableSelectOption
				})}
				placeholder={t("settings:common.select")}
				searchPlaceholder={t("settings:providers.searchPlaceholder")}
				emptyMessage={t("settings:providers.noMatchFound")}
				className="grow"
				data-testid="select-component"
			/>
			<StandardTooltip content={t("settings:providers.addProfile")}>
				<Button variant="ghost" size="icon" onClick={onAdd} data-testid="add-profile-button">
					<span className="codicon codicon-add" />
				</Button>
			</StandardTooltip>
			{currentApiConfigName && (
				<>
					<StandardTooltip content={t("settings:providers.renameProfile")}>
						<Button variant="ghost" size="icon" onClick={onStartRename} data-testid="rename-profile-button">
							<span className="codicon codicon-edit" />
						</Button>
					</StandardTooltip>
					<StandardTooltip
						content={
							isOnlyProfile
								? t("settings:providers.cannotDeleteOnlyProfile")
								: t("settings:providers.deleteProfile")
						}>
						<Button
							variant="ghost"
							size="icon"
							onClick={onDelete}
							data-testid="delete-profile-button"
							disabled={isOnlyProfile}>
							<span className="codicon codicon-trash" />
						</Button>
					</StandardTooltip>
				</>
			)}
		</div>
		<div className="text-vscode-descriptionForeground text-sm mt-1">{t("settings:providers.description")}</div>
	</>
)
