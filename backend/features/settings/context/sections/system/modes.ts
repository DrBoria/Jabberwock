import type { IExtensionContextView } from "@features/foundation/vscode/context"

import type { ModeConfig } from "@jabberwock/types"

import { getAllModesWithPrompts } from "@shared/modes/extension"
import { ensureSettingsDirectoryExists } from "@utils/globalContext"

/** v4 B2 (L3): structural context view — real host contexts satisfy it structurally. */
export async function getModesSection(context: IExtensionContextView): Promise<string> {
	// Make sure path gets created
	await ensureSettingsDirectoryExists(context)

	// Get all modes with their overrides from extension state
	const allModes = await getAllModesWithPrompts(context)

	const modesContent = `====

MODES

- These are the currently available modes:
- When creating tasks or delegating work to other agents, you MUST assign tasks ONLY to the following available agents:
${allModes
	.map((mode: ModeConfig) => {
		let description: string
		if (mode.whenToUse && mode.whenToUse.trim() !== "") {
			// Use whenToUse as the primary description, indenting subsequent lines for readability
			description = mode.whenToUse.replace(/\n/g, "\n    ")
		} else {
			// Fallback to the first sentence of roleDefinition if whenToUse is not available
			description = mode.roleDefinition.split(".")[0]
		}
		return `  * "${mode.name}" mode (slug: ${mode.slug}) - ${description}`
	})
	.join("\n")}`

	return modesContent
}
