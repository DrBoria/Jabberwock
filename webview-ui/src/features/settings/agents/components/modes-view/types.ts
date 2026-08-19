import { ModeConfig, GroupEntry, PromptComponent, ToolGroup } from "@jabberwock/types"
import { TOOL_GROUPS } from "@shared/tools/tools.groups"

export const availableGroups = (Object.keys(TOOL_GROUPS) as ToolGroup[]).filter(
	(group) => !TOOL_GROUPS[group].alwaysAvailable,
)

export type ModeSource = "global" | "project"

export type ImportModeResult = { type: "importModeResult"; success: boolean; slug?: string; error?: string }

export type MessageHandlerRefs = {
	customModesRef: React.MutableRefObject<ModeConfig[] | undefined>
	handleModeSwitchRef: React.MutableRefObject<(modeConfig: ModeConfig) => void>
	switchModeRef: React.MutableRefObject<(slug: string) => void>
	modeToDeleteRef: React.MutableRefObject<{
		slug: string
		name: string
		source?: string
		rulesFolderPath?: string
	} | null>
}

export type { ModeConfig, GroupEntry, PromptComponent, ToolGroup }
