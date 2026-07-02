import { toast } from "sonner"

import type { ProviderSettings, GlobalSettings, JabberwockSettings } from "@jabberwock/types"
import { getModelId, EVALS_SETTINGS } from "@jabberwock/types"

import { createRun } from "@/actions/runs"

import type { CreateRun } from "@/lib/schemas"

export type ImportedSettings = {
	apiConfigs: Record<string, ProviderSettings>
	globalSettings: GlobalSettings
	currentApiConfigName: string
}

export type ModelSelection = {
	id: string
	model: string
	popoverOpen: boolean
}

export type ConfigSelection = {
	id: string
	configName: string
	popoverOpen: boolean
}

export type ProviderSource = "jabberwock" | "openrouter" | "other"

export function buildSelectionsToLaunch(
	provider: ProviderSource,
	configSelections: ConfigSelection[],
	modelSelections: ModelSelection[],
): Array<{ model: string; configName?: string }> {
	const selections: Array<{ model: string; configName?: string }> = []

	if (provider === "other") {
		for (const config of configSelections) {
			if (config.configName) {
				selections.push({ model: "", configName: config.configName })
			}
		}
	} else {
		for (const selection of modelSelections) {
			if (selection.model) {
				selections.push({ model: selection.model })
			}
		}
	}

	return selections
}

export function buildRunValues(
	selection: { model: string; configName?: string },
	provider: ProviderSource,
	baseValues: CreateRun,
	importedSettings: ImportedSettings | null,
	commandExecutionTimeout: number,
	terminalShellIntegrationTimeout: number,
): CreateRun {
	const runValues = { ...baseValues }

	if (provider === "openrouter") {
		runValues.model = selection.model
		runValues.settings = {
			...(runValues.settings || {}),
			apiProvider: "openrouter",
			openRouterModelId: selection.model,
			commandExecutionTimeout,
			terminalShellIntegrationTimeout: terminalShellIntegrationTimeout * 1000,
		}
	} else if (provider === "jabberwock") {
		runValues.model = selection.model
		runValues.settings = {
			...(runValues.settings || {}),
			apiProvider: "jabberwock",
			apiModelId: selection.model,
			commandExecutionTimeout,
			terminalShellIntegrationTimeout: terminalShellIntegrationTimeout * 1000,
		}
	} else if (provider === "other" && selection.configName && importedSettings) {
		const providerSettings = importedSettings.apiConfigs[selection.configName] ?? {}
		runValues.model = getModelId(providerSettings) ?? ""
		runValues.settings = {
			...EVALS_SETTINGS,
			...providerSettings,
			...importedSettings.globalSettings,
			commandExecutionTimeout,
			terminalShellIntegrationTimeout: terminalShellIntegrationTimeout * 1000,
		} as JabberwockSettings
	}

	return runValues
}

export async function launchRuns(
	selections: Array<{ model: string; configName?: string }>,
	provider: ProviderSource,
	baseValues: CreateRun,
	importedSettings: ImportedSettings | null,
	commandExecutionTimeout: number,
	terminalShellIntegrationTimeout: number,
	onSuccess: () => void,
): Promise<void> {
	const totalRuns = selections.length
	toast.info(totalRuns > 1 ? `Launching ${totalRuns} runs (every 20 seconds)...` : "Launching run...")

	for (let i = 0; i < selections.length; i++) {
		if (i > 0) {
			await new Promise((resolve) => setTimeout(resolve, 20_000))
		}

		const runValues = buildRunValues(
			selections[i]!,
			provider,
			baseValues,
			importedSettings,
			commandExecutionTimeout,
			terminalShellIntegrationTimeout,
		)

		try {
			await createRun(runValues)
			toast.success(`Run ${i + 1}/${totalRuns} launched`)
		} catch (e) {
			toast.error(`Run ${i + 1} failed: ${e instanceof Error ? e.message : "Unknown error"}`)
		}
	}

	onSuccess()
}
