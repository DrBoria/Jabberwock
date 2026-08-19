import React from "react"
import { ContextManagementSettings } from "../../../ContextManagementSettings/ContextManagementSettingsComponent"
import type { ExtensionState } from "@jabberwock/types"

interface ContextManagementTabProps {
	cachedState: Pick<
		ExtensionState,
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
	>
	listApiConfigMeta: readonly { id: string; name: string }[]
	customSupportPrompts: Record<string, string | undefined>
	setCustomSupportPrompts: (prompts: Record<string, string | undefined>) => void
	setCachedStateField: <K extends keyof ExtensionState>(field: K, value: ExtensionState[K]) => void
}

export function renderContextManagementTab(props: ContextManagementTabProps): React.ReactNode {
	const { cachedState, listApiConfigMeta, customSupportPrompts, setCustomSupportPrompts, setCachedStateField } = props

	return (
		<ContextManagementSettings
			autoCondenseContext={cachedState.autoCondenseContext}
			autoCondenseContextPercent={cachedState.autoCondenseContextPercent}
			listApiConfigMeta={[...(listApiConfigMeta ?? [])]}
			maxOpenTabsContext={cachedState.maxOpenTabsContext}
			maxWorkspaceFiles={cachedState.maxWorkspaceFiles ?? 200}
			showJabberwockIgnoredFiles={cachedState.showJabberwockIgnoredFiles}
			enableSubfolderRules={cachedState.enableSubfolderRules}
			maxImageFileSize={cachedState.maxImageFileSize}
			maxTotalImageSize={cachedState.maxTotalImageSize}
			profileThresholds={cachedState.profileThresholds}
			includeDiagnosticMessages={cachedState.includeDiagnosticMessages}
			maxDiagnosticMessages={cachedState.maxDiagnosticMessages}
			writeDelayMs={cachedState.writeDelayMs}
			includeCurrentTime={cachedState.includeCurrentTime}
			includeCurrentCost={cachedState.includeCurrentCost}
			maxGitStatusFiles={cachedState.maxGitStatusFiles}
			customSupportPrompts={customSupportPrompts}
			setCustomSupportPrompts={setCustomSupportPrompts}
			setCachedStateField={setCachedStateField}
		/>
	)
}
