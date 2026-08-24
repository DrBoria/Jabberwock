import type { OrganizationAllowList, ProviderName } from "@jabberwock/types"
import { filterProviders, filterModels } from "../../utils/organizationFilters"
import { MODELS_BY_PROVIDER, PROVIDERS } from "../../shared/constants"

export function getProviderOptions(
	organizationAllowList: OrganizationAllowList,
	apiProvider: string | undefined,
	fromWelcomeView: boolean | undefined,
): { value: string; label: string }[] {
	const allowedProviders = filterProviders(PROVIDERS, organizationAllowList)
	const providersWithModels = allowedProviders.filter(({ value }) => {
		if (value === apiProvider) return true
		const staticModels = MODELS_BY_PROVIDER[value as ProviderName]
		if (staticModels) {
			const filteredModels = filterModels(staticModels, value as ProviderName, organizationAllowList)
			return filteredModels && Object.keys(filteredModels).length > 0
		}
		return true
	})
	const options = providersWithModels.map(({ value, label }) => ({ value, label }))
	if (!fromWelcomeView) {
		const rooIndex = options.findIndex((opt) => opt.value === "jabberwock")
		if (rooIndex > 0) {
			const [rooOption] = options.splice(rooIndex, 1)
			options.unshift(rooOption)
		}
	} else {
		const filteredOptions = options.filter((opt) => opt.value !== "jabberwock")
		options.length = 0
		options.push(...filteredOptions)
		const openRouterIndex = options.findIndex((opt) => opt.value === "openrouter")
		if (openRouterIndex > 0) {
			const [openRouterOption] = options.splice(openRouterIndex, 1)
			options.unshift(openRouterOption)
		}
	}
	return options
}
