import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import type { ProviderSettings } from "@jabberwock/types"
import type { BedrockProps, HandleInputChangeFn } from "./types"

export const getAuthMethodValue = (apiConfiguration: ProviderSettings): string =>
	apiConfiguration?.awsUseApiKey ? "apikey" : apiConfiguration?.awsUseProfile ? "profile" : "credentials"

export const handleAuthMethodChange = (value: string, setField: BedrockProps["setApiConfigurationField"]) => {
	if (value === "apikey") {
		setField("awsUseApiKey", true)
		setField("awsUseProfile", false)
	} else if (value === "profile") {
		setField("awsUseApiKey", false)
		setField("awsUseProfile", true)
	} else {
		setField("awsUseApiKey", false)
		setField("awsUseProfile", false)
	}
}

export const AuthMethodSelect = ({
	apiConfiguration,
	setApiConfigurationField,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: BedrockProps["setApiConfigurationField"]
}) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<label className="block font-medium mb-1">Authentication Method</label>
			<Select
				value={getAuthMethodValue(apiConfiguration)}
				onValueChange={(value) => handleAuthMethodChange(value, setApiConfigurationField)}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder={t("settings:common.select")} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="credentials">{t("settings:providers.awsCredentials")}</SelectItem>
					<SelectItem value="profile">{t("settings:providers.awsProfile")}</SelectItem>
					<SelectItem value="apikey">{t("settings:providers.awsApiKey")}</SelectItem>
				</SelectContent>
			</Select>
		</div>
	)
}

const CredentialsFields = ({
	apiConfiguration,
	handleInputChange,
}: {
	apiConfiguration: ProviderSettings
	handleInputChange: HandleInputChangeFn
}) => {
	const { t } = useAppTranslation()
	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.awsAccessKey || ""}
				type="password"
				onInput={handleInputChange("awsAccessKey")}
				placeholder={t("settings:placeholders.accessKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.awsAccessKey")}</label>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.awsSecretKey || ""}
				type="password"
				onInput={handleInputChange("awsSecretKey")}
				placeholder={t("settings:placeholders.secretKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.awsSecretKey")}</label>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.awsSessionToken || ""}
				type="password"
				onInput={handleInputChange("awsSessionToken")}
				placeholder={t("settings:placeholders.sessionToken")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.awsSessionToken")}</label>
			</VSCodeTextField>
		</>
	)
}

export const AuthFields = ({
	apiConfiguration,
	handleInputChange,
}: {
	apiConfiguration: ProviderSettings
	handleInputChange: HandleInputChangeFn
}) => {
	const { t } = useAppTranslation()
	if (apiConfiguration?.awsUseApiKey)
		return (
			<VSCodeTextField
				value={apiConfiguration?.awsApiKey || ""}
				type="password"
				onInput={handleInputChange("awsApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.awsApiKey")}</label>
			</VSCodeTextField>
		)
	if (apiConfiguration?.awsUseProfile)
		return (
			<VSCodeTextField
				value={apiConfiguration?.awsProfile || ""}
				onInput={handleInputChange("awsProfile")}
				placeholder={t("settings:placeholders.profileName")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.awsProfileName")}</label>
			</VSCodeTextField>
		)
	return <CredentialsFields apiConfiguration={apiConfiguration} handleInputChange={handleInputChange} />
}
