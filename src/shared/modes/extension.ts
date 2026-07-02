import * as vscode from "vscode"
import { type ModeConfig, type CustomModePrompts } from "@jabberwock/types"
import { addCustomInstructions } from "@features/settings/context/sections/custom-instructions"
import { modes, getAllModes, getModeBySlug } from "./modes"

// Helper function to get all modes with their prompt overrides from extension state
export async function getAllModesWithPrompts(context: vscode.ExtensionContext): Promise<ModeConfig[]> {
	const customModes = (await context.globalState.get<ModeConfig[]>("customModes")) || []
	const customModePrompts = (await context.globalState.get<CustomModePrompts>("customModePrompts")) || {}

	const allModes = getAllModes(customModes)
	return allModes.map((mode) => ({
		...mode,
		roleDefinition: customModePrompts[mode.slug]?.roleDefinition ?? mode.roleDefinition,
		whenToUse: customModePrompts[mode.slug]?.whenToUse ?? mode.whenToUse,
		customInstructions: customModePrompts[mode.slug]?.customInstructions ?? mode.customInstructions,
	}))
}

function getPromptOverrides(promptComponent: CustomModePrompts[string] | undefined, baseMode: ModeConfig) {
	return {
		customInstructions: promptComponent?.customInstructions || baseMode.customInstructions || "",
		whenToUse: promptComponent?.whenToUse || baseMode.whenToUse || "",
		description: promptComponent?.description || baseMode.description || "",
	}
}

async function resolveCustomInstructions(
	baseCustomInstructions: string,
	options: { cwd?: string; globalCustomInstructions?: string; language?: string } | undefined,
	modeSlug: string,
): Promise<string> {
	if (!options?.cwd) {
		return baseCustomInstructions
	}
	return addCustomInstructions(
		baseCustomInstructions,
		options.globalCustomInstructions || "",
		options.cwd,
		modeSlug,
		{ language: options.language },
	)
}

// Helper function to get complete mode details with all overrides
export async function getFullModeDetails(
	modeSlug: string,
	customModes?: ModeConfig[],
	customModePrompts?: CustomModePrompts,
	options?: {
		cwd?: string
		globalCustomInstructions?: string
		language?: string
	},
): Promise<ModeConfig> {
	const baseMode = getModeBySlug(modeSlug, customModes) || modes.find((m) => m.slug === modeSlug) || modes[0]
	const promptComponent = customModePrompts?.[modeSlug]
	const overrides = getPromptOverrides(promptComponent, baseMode)
	const fullCustomInstructions = await resolveCustomInstructions(overrides.customInstructions, options, modeSlug)

	return {
		...baseMode,
		roleDefinition: promptComponent?.roleDefinition || baseMode.roleDefinition,
		whenToUse: overrides.whenToUse,
		description: overrides.description,
		customInstructions: fullCustomInstructions,
	}
}
