import { HTMLAttributes } from "react"
import { SetCachedStateField } from "../shared/types"

export type ContextManagementCachedField =
	| "autoCondenseContext"
	| "autoCondenseContextPercent"
	| "maxOpenTabsContext"
	| "maxWorkspaceFiles"
	| "showJabberwockIgnoredFiles"
	| "enableSubfolderRules"
	| "maxImageFileSize"
	| "maxTotalImageSize"
	| "profileThresholds"
	| "includeDiagnosticMessages"
	| "maxDiagnosticMessages"
	| "writeDelayMs"
	| "includeCurrentTime"
	| "includeCurrentCost"
	| "maxGitStatusFiles"

export type ContextManagementSettingsProps = HTMLAttributes<HTMLDivElement> & {
	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	listApiConfigMeta: Array<{ id: string; name: string }>
	maxOpenTabsContext: number
	maxWorkspaceFiles: number
	showJabberwockIgnoredFiles?: boolean
	enableSubfolderRules?: boolean
	maxImageFileSize?: number
	maxTotalImageSize?: number
	profileThresholds?: Record<string, number>
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
	writeDelayMs: number
	includeCurrentTime?: boolean
	includeCurrentCost?: boolean
	maxGitStatusFiles?: number
	customSupportPrompts: Record<string, string | undefined>
	setCustomSupportPrompts: (prompts: Record<string, string | undefined>) => void
	setCachedStateField: SetCachedStateField<ContextManagementCachedField>
}
