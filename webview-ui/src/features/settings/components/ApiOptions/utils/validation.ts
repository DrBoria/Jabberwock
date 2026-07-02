import type { OrganizationAllowList, ProviderSettings, RouterModels } from "@jabberwock/types"
import { validateApiConfigurationExcludingModelErrors } from "@src/utils/helpers/validate"

export function validateAndSetError(
	isRetiredSelectedProvider: boolean,
	apiConfiguration: ProviderSettings,
	routerModels: RouterModels | undefined,
	organizationAllowList: OrganizationAllowList,
	setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>,
): void {
	if (isRetiredSelectedProvider) {
		setErrorMessage(undefined)
		return
	}
	const apiValidationResult = validateApiConfigurationExcludingModelErrors(
		apiConfiguration,
		routerModels,
		organizationAllowList,
	)
	setErrorMessage(apiValidationResult)
}
