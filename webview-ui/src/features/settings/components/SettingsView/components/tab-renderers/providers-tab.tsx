import React from "react"
import { SectionHeader } from "../../../shared/SectionHeader"
import { Section } from "../../../shared/Section"
import ApiConfigManager from "../../../ApiConfigManager/ApiConfigManagerComponent"
import ApiOptions from "../../../ApiOptions/components/ApiOptions"
import { rootStore } from "@src/features/store"
import type { ProviderSettings } from "@jabberwock/types"

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
					onUpsertConfig={(configName: string) =>
						rootStore.settings.upsertApiConfig(configName, apiConfiguration)
					}
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
