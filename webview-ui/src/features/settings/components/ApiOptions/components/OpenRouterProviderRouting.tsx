import { ExternalLinkIcon } from "@radix-ui/react-icons"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@src/shared/ui/selects/select"
import { OPENROUTER_DEFAULT_PROVIDER_NAME } from "@jabberwock/types"
import type { OpenRouterProviderRoutingProps } from "../types"

export const OpenRouterProviderRouting = ({
	selectedProvider,
	openRouterModelProviders,
	selectedModelId,
	apiConfiguration,
	setApiConfigurationField,
	t,
}: OpenRouterProviderRoutingProps) => {
	if (selectedProvider !== "openrouter") return null
	if (!openRouterModelProviders) return null
	if (Object.keys(openRouterModelProviders).length === 0) return null
	return (
		<div>
			<div className="flex items-center gap-1">
				<label className="block font-medium mb-1">
					{t("settings:providers.openRouter.providerRouting.title")}
				</label>
				<a href={`https://openrouter.ai/${selectedModelId}/providers`}>
					<ExternalLinkIcon className="w-4 h-4" />
				</a>
			</div>
			<Select
				value={apiConfiguration?.openRouterSpecificProvider || OPENROUTER_DEFAULT_PROVIDER_NAME}
				onValueChange={(value) => setApiConfigurationField("openRouterSpecificProvider", value)}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder={t("settings:common.select")} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={OPENROUTER_DEFAULT_PROVIDER_NAME}>{OPENROUTER_DEFAULT_PROVIDER_NAME}</SelectItem>
					{Object.entries(openRouterModelProviders).map(([value, { label }]) => (
						<SelectItem key={value} value={value}>
							{label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<div className="text-sm text-vscode-descriptionForeground mt-1">
				{t("settings:providers.openRouter.providerRouting.description")}{" "}
				<a href="https://openrouter.ai/docs/features/provider-routing">
					{t("settings:providers.openRouter.providerRouting.learnMore")}.
				</a>
			</div>
		</div>
	)
}
