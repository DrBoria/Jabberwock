import { toast } from "sonner"

import { createRun } from "@/actions/runs"

import type { CreateRun } from "@/lib/schemas"

import type { ImportedSettings, ProviderSource } from "./utils"
import { buildRunValues } from "./utils"

/**
 * Orchestration handler: launches the selected runs one by one (staggered by
 * 20 s), toasting progress. Lives outside `utils.ts` because it is an async
 * side-effecting flow, not a pure helper (no-impure-utils).
 */
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
