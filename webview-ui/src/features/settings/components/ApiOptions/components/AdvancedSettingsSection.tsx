import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "@jabberwock/types"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@src/shared/ui/displays/collapsible"
import { TemperatureControl } from "../../provider-controls/TemperatureControl"
import { RateLimitSecondsControl } from "../../provider-controls/RateLimitSecondsControl"
import { ConsecutiveMistakeLimitControl } from "../../provider-controls/ConsecutiveMistakeLimitControl"
import { noTransform } from "../../shared/transforms"
import { OpenRouterProviderRouting } from "./OpenRouterProviderRouting"
import type { AdvancedSettingsSectionProps } from "../types"

export const AdvancedSettingsSection = ({
	fromWelcomeView,
	isAdvancedSettingsOpen,
	setIsAdvancedSettingsOpen,
	selectedModelInfo,
	selectedProvider,
	apiConfiguration,
	setApiConfigurationField,
	handleInputChange,
	openRouterModelProviders,
	selectedModelId,
	t,
}: AdvancedSettingsSectionProps) => {
	if (fromWelcomeView) return null
	return (
		<Collapsible open={isAdvancedSettingsOpen} onOpenChange={setIsAdvancedSettingsOpen}>
			<CollapsibleTrigger className="flex items-center gap-1 w-full cursor-pointer hover:opacity-80 mb-2">
				<span className={`codicon codicon-chevron-${isAdvancedSettingsOpen ? "down" : "right"}`} />
				<span className="font-medium">{t("settings:advancedSettings.title")}</span>
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-3">
				{selectedModelInfo?.supportsTemperature !== false && (
					<TemperatureControl
						value={apiConfiguration.modelTemperature}
						onChange={handleInputChange("modelTemperature", noTransform)}
						maxValue={2}
						defaultValue={selectedModelInfo?.defaultTemperature}
					/>
				)}
				<RateLimitSecondsControl
					value={apiConfiguration.rateLimitSeconds || 0}
					onChange={(value) => setApiConfigurationField("rateLimitSeconds", value)}
				/>
				<ConsecutiveMistakeLimitControl
					value={
						apiConfiguration.consecutiveMistakeLimit !== undefined
							? apiConfiguration.consecutiveMistakeLimit
							: DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
					}
					onChange={(value) => setApiConfigurationField("consecutiveMistakeLimit", value)}
				/>
				<OpenRouterProviderRouting
					selectedProvider={selectedProvider || ""}
					openRouterModelProviders={openRouterModelProviders}
					selectedModelId={selectedModelId}
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					t={t}
				/>
			</CollapsibleContent>
		</Collapsible>
	)
}
