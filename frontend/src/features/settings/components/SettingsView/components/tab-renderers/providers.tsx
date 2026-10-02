import React from "react"
import { SectionHeader } from "@src/features/settings/components/shared/header"
import { Section } from "@src/features/settings/components/shared/section"
import ApiConfigManager from "@src/features/settings/components/ApiConfigManager/ApiConfigManagerComponent"
import ApiOptions from "@src/features/settings/components/ApiOptions/components/ApiOptions"
import { rootStore } from "@src/features/store"
import type { ProviderSettings, ProviderSettingsWithId } from "@jabberwock/types"

interface ProvidersTabProps {
	currentApiConfigName: string
	listApiConfigMeta: { id: string; name: string }[]
	uriScheme: string | undefined
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	errorMessage: string | undefined
	setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>
	checkUnsaveChanges: (then: () => void) => void
	onRenameConfig: (oldName: string, newName: string) => void
	t: (key: string) => string
}

export function renderProvidersTab(props: ProvidersTabProps): React.ReactNode {
	const {
		currentApiConfigName,
		listApiConfigMeta,
		uriScheme,
		apiConfiguration,
		setApiConfigurationField,
		errorMessage,
		setErrorMessage,
		checkUnsaveChanges,
		onRenameConfig,
		t,
	} = props

	return (
		<div>
			<SectionHeader>{t("settings:sections.providers")}</SectionHeader>
			<Section>
				<ApiConfigManager
					currentApiConfigName={currentApiConfigName}
					listApiConfigMeta={listApiConfigMeta}
					onSelectConfig={(configName: string) =>
						checkUnsaveChanges(() => rootStore.settings.loadApiConfig(configName))
					}
					onDeleteConfig={(configName: string) => rootStore.settings.deleteApiConfig(configName)}
					onRenameConfig={onRenameConfig}
					onUpsertConfig={(configName: string) => {
						// A brand-new profile must not inherit the active profile's id.
						// The form state carries the active profile's id at runtime even
						// though the ProviderSettings type omits it; forwarding it made
						// saveConfig store a duplicate id, breaking id-keyed selection,
						// mode switching and pins. Strip it so the backend assigns a fresh id.
						const configWithId: ProviderSettingsWithId = apiConfiguration
						const { id, ...rest } = configWithId
						rootStore.settings.upsertApiConfig(configName, rest)
					}}
				/>
				<ApiOptions
					uriScheme={uriScheme}
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					errorMessage={errorMessage}
					setErrorMessage={setErrorMessage}
				/>
			</Section>
		</div>
	)
}
