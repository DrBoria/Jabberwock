import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Checkbox } from "vscrui"
import { type ProviderSettings, type ModelInfo, type BedrockServiceTier } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { noTransform } from "../../shared/transforms"
import type { BedrockProps, HandleInputChangeFn } from "./types"

export const ServiceTierSection = ({
	apiConfiguration,
	setApiConfigurationField,
	supportsServiceTiers,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: BedrockProps["setApiConfigurationField"]
	supportsServiceTiers: boolean
}) => {
	const { t } = useAppTranslation()
	if (!supportsServiceTiers) return null
	return (
		<div>
			<label className="block font-medium mb-1">{t("settings:providers.awsServiceTier")}</label>
			<Select
				value={apiConfiguration?.awsBedrockServiceTier || "STANDARD"}
				onValueChange={(value) =>
					setApiConfigurationField("awsBedrockServiceTier", value as BedrockServiceTier)
				}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder={t("settings:common.select")} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="STANDARD">{t("settings:providers.awsServiceTierStandard")}</SelectItem>
					<SelectItem value="FLEX">{t("settings:providers.awsServiceTierFlex")}</SelectItem>
					<SelectItem value="PRIORITY">{t("settings:providers.awsServiceTierPriority")}</SelectItem>
				</SelectContent>
			</Select>
			<div className="text-sm text-vscode-descriptionForeground mt-1">
				{t("settings:providers.awsServiceTierNote")}
			</div>
		</div>
	)
}

export const GlobalInferenceCheckbox = ({
	apiConfiguration,
	setApiConfigurationField,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: BedrockProps["setApiConfigurationField"]
}) => {
	const { t } = useAppTranslation()
	return (
		<Checkbox
			checked={apiConfiguration?.awsUseGlobalInference || false}
			onChange={(checked: boolean) => setApiConfigurationField("awsUseGlobalInference", checked)}>
			{t("settings:providers.awsGlobalInference")}
		</Checkbox>
	)
}

export const PromptCacheSection = ({
	apiConfiguration,
	selectedModelInfo,
	handleInputChange,
}: {
	apiConfiguration: ProviderSettings
	selectedModelInfo: ModelInfo | undefined
	handleInputChange: HandleInputChangeFn
}) => {
	const { t } = useAppTranslation()
	if (!selectedModelInfo?.supportsPromptCache) return null
	return (
		<>
			<Checkbox
				checked={apiConfiguration?.awsUsePromptCache ?? true}
				onChange={handleInputChange("awsUsePromptCache", noTransform)}>
				<div className="flex items-center gap-1">
					<span>{t("settings:providers.enablePromptCaching")}</span>
					<StandardTooltip content={t("settings:providers.enablePromptCachingTitle")}>
						<i
							className="codicon codicon-info text-vscode-descriptionForeground"
							style={{ fontSize: "12px" }}
						/>
					</StandardTooltip>
				</div>
			</Checkbox>
			<div className="text-sm text-vscode-descriptionForeground ml-6 mt-1">
				{t("settings:providers.cacheUsageNote")}
			</div>
		</>
	)
}

export const OneMContextBetaSection = ({
	apiConfiguration,
	setApiConfigurationField,
	supports1MContextBeta,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: BedrockProps["setApiConfigurationField"]
	supports1MContextBeta: boolean
}) => {
	const { t } = useAppTranslation()
	if (!supports1MContextBeta) return null
	return (
		<div>
			<Checkbox
				checked={apiConfiguration?.awsBedrock1MContext ?? false}
				onChange={(checked: boolean) => setApiConfigurationField("awsBedrock1MContext", checked)}>
				{t("settings:providers.awsBedrock1MContextBetaLabel")}
			</Checkbox>
			<div className="text-sm text-vscode-descriptionForeground mt-1 ml-6">
				{t("settings:providers.awsBedrock1MContextBetaDescription")}
			</div>
		</div>
	)
}

export const VpcEndpointSection = ({
	apiConfiguration,
	handleInputChange,
	awsEndpointSelected,
	setAwsEndpointSelected,
	setApiConfigurationField,
}: {
	apiConfiguration: ProviderSettings
	handleInputChange: HandleInputChangeFn
	awsEndpointSelected: boolean
	setAwsEndpointSelected: (v: boolean) => void
	setApiConfigurationField: BedrockProps["setApiConfigurationField"]
}) => {
	const { t } = useAppTranslation()
	return (
		<>
			<Checkbox
				checked={awsEndpointSelected}
				onChange={(isChecked) => {
					setAwsEndpointSelected(isChecked)
					setApiConfigurationField("awsBedrockEndpointEnabled", isChecked)
				}}>
				{t("settings:providers.awsBedrockVpc.useCustomVpcEndpoint")}
			</Checkbox>
			{awsEndpointSelected && (
				<>
					<VSCodeTextField
						value={apiConfiguration?.awsBedrockEndpoint || ""}
						style={{ width: "100%", marginTop: 3, marginBottom: 5 }}
						type="url"
						onInput={handleInputChange("awsBedrockEndpoint")}
						placeholder={t("settings:providers.awsBedrockVpc.vpcEndpointUrlPlaceholder")}
						data-testid="vpc-endpoint-input"
					/>
					<div className="text-sm text-vscode-descriptionForeground ml-6 mt-1 mb-3">
						{t("settings:providers.awsBedrockVpc.examples")}
						<div className="ml-2">• https://vpce-xxx.bedrock.region.vpce.amazonaws.com/</div>
						<div className="ml-2">• https://gateway.my-company.com/route/app/bedrock</div>
					</div>
				</>
			)}
		</>
	)
}
