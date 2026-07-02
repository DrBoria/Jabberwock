import { Checkbox } from "vscrui"
import { VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, VERTEX_REGIONS, VERTEX_1M_CONTEXT_MODEL_IDS } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"

import { inputEventTransform } from "../../../shared/transforms"

type VertexProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

function safeValue(value: string | undefined | null, fallback = ""): string {
	if (value == null) return fallback
	return value
}

function handleInputChange<K extends keyof ProviderSettings, E>(
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void,
	field: K,
	transform?: (event: E) => ProviderSettings[K],
) {
	return (event: E | Event) => {
		setApiConfigurationField(
			field,
			transform
				? transform(event as E)
				: (inputEventTransform(event as { target: HTMLInputElement }) as ProviderSettings[K]),
		)
	}
}

function VertexSetupLinks({ t }: { t: (key: string) => string }) {
	return (
		<div className="text-sm text-vscode-descriptionForeground">
			<div>{t("settings:providers.googleCloudSetup.title")}</div>
			<div>
				<VSCodeLink
					href="https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#before_you_begin"
					className="text-sm">
					{t("settings:providers.googleCloudSetup.step1")}
				</VSCodeLink>
			</div>
			<div>
				<VSCodeLink
					href="https://cloud.google.com/docs/authentication/provide-credentials-adc#google-idp"
					className="text-sm">
					{t("settings:providers.googleCloudSetup.step2")}
				</VSCodeLink>
			</div>
			<div>
				<VSCodeLink
					href="https://developers.google.com/workspace/guides/create-credentials?hl=en#service-account"
					className="text-sm">
					{t("settings:providers.googleCloudSetup.step3")}
				</VSCodeLink>
			</div>
		</div>
	)
}

function VertexCredentialsFields({
	apiConfiguration,
	setApiConfigurationField,
	t,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	t: (key: string) => string
}) {
	return (
		<>
			<VSCodeTextField
				value={safeValue(apiConfiguration?.vertexJsonCredentials)}
				onInput={handleInputChange(setApiConfigurationField, "vertexJsonCredentials")}
				placeholder={t("settings:placeholders.credentialsJson")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.googleCloudCredentials")}</label>
			</VSCodeTextField>
			<VSCodeTextField
				value={safeValue(apiConfiguration?.vertexKeyFile)}
				onInput={handleInputChange(setApiConfigurationField, "vertexKeyFile")}
				placeholder={t("settings:placeholders.keyFilePath")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.googleCloudKeyFile")}</label>
			</VSCodeTextField>
			<VSCodeTextField
				value={safeValue(apiConfiguration?.vertexProjectId)}
				onInput={handleInputChange(setApiConfigurationField, "vertexProjectId")}
				placeholder={t("settings:placeholders.projectId")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.googleCloudProjectId")}</label>
			</VSCodeTextField>
		</>
	)
}

function VertexRegionSelect({
	apiConfiguration,
	setApiConfigurationField,
	t,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	t: (key: string) => string
}) {
	return (
		<div>
			<label className="block font-medium mb-1">{t("settings:providers.googleCloudRegion")}</label>
			<Select
				value={safeValue(apiConfiguration?.vertexRegion)}
				onValueChange={(value) => setApiConfigurationField("vertexRegion", value)}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder={t("settings:common.select")} />
				</SelectTrigger>
				<SelectContent>
					{VERTEX_REGIONS.map(({ value, label }) => (
						<SelectItem key={value} value={value}>
							{label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}

function Vertex1MContextCheckbox({
	apiConfiguration,
	setApiConfigurationField,
	t,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	t: (key: string) => string
}) {
	return (
		<div>
			<Checkbox
				data-testid="checkbox-vertex-1m-context"
				checked={apiConfiguration?.vertex1MContext ?? false}
				onChange={(checked: boolean) => {
					setApiConfigurationField("vertex1MContext", checked)
				}}>
				{t("settings:providers.vertex1MContextBetaLabel")}
			</Checkbox>
			<div className="text-sm text-vscode-descriptionForeground mt-1 ml-6">
				{t("settings:providers.vertex1MContextBetaDescription")}
			</div>
		</div>
	)
}

export const Vertex = ({ apiConfiguration, setApiConfigurationField }: VertexProps) => {
	const { t } = useAppTranslation()

	const supports1MContextBeta =
		apiConfiguration?.apiModelId != null &&
		VERTEX_1M_CONTEXT_MODEL_IDS.includes(
			apiConfiguration.apiModelId as (typeof VERTEX_1M_CONTEXT_MODEL_IDS)[number],
		)

	return (
		<>
			<VertexSetupLinks t={t} />
			<VertexCredentialsFields
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				t={t}
			/>
			<VertexRegionSelect
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				t={t}
			/>
			{supports1MContextBeta && (
				<Vertex1MContextCheckbox
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					t={t}
				/>
			)}
		</>
	)
}
