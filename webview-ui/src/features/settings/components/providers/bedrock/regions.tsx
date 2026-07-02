import { BEDROCK_REGIONS } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import type { ProviderSettings } from "@jabberwock/types"
import type { BedrockProps } from "./types"

export const RegionSelect = ({
	apiConfiguration,
	setApiConfigurationField,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: BedrockProps["setApiConfigurationField"]
}) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<label className="block font-medium mb-1">{t("settings:providers.awsRegion")}</label>
			<Select
				value={apiConfiguration?.awsRegion || ""}
				onValueChange={(value) => setApiConfigurationField("awsRegion", value)}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder={t("settings:common.select")} />
				</SelectTrigger>
				<SelectContent>
					{BEDROCK_REGIONS.map(({ value, label }) => (
						<SelectItem key={value} value={value}>
							{label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
