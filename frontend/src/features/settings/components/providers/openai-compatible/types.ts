import type { ProviderSettings, OrganizationAllowList } from "@jabberwock/types"

export type OpenAICompatibleProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export type InputEvent = { target: EventTarget | null }

export type CustomHeaderEntry = [string, string]

export const getEventValue = (event: InputEvent) => {
	const t = event.target
	return t && "value" in t ? (t.value as string) : ""
}

export const getPositiveBorderColor = (v: number | undefined | null) =>
	!v ? "var(--vscode-input-border)" : v > 0 ? "var(--vscode-charts-green)" : "var(--vscode-errorForeground)"

export const getNonNegativeBorderColor = (v: number | undefined | null) =>
	!v && v !== 0
		? "var(--vscode-input-border)"
		: v >= 0
			? "var(--vscode-charts-green)"
			: "var(--vscode-errorForeground)"

export const createEmptyCustomHeader = (): CustomHeaderEntry => ["", ""]
