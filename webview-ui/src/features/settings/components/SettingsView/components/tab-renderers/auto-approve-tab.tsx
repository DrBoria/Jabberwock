import React from "react"
import { AutoApproveSettings } from "../../../AutoApproveSettings/AutoApproveSettingsComponent"
import type { ExtensionState } from "@jabberwock/types"

interface AutoApproveTabProps {
	cachedState: Pick<
		ExtensionState,
		| "alwaysAllowReadOnly"
		| "alwaysAllowReadOnlyOutsideWorkspace"
		| "alwaysAllowWrite"
		| "alwaysAllowWriteOutsideWorkspace"
		| "alwaysAllowWriteProtected"
		| "alwaysAllowMcp"
		| "alwaysAllowModeSwitch"
		| "alwaysAllowSubtasks"
		| "alwaysAllowExecute"
		| "alwaysAllowFollowupQuestions"
		| "followupAutoApproveTimeoutMs"
		| "allowedCommands"
		| "allowedMaxRequests"
		| "allowedMaxCost"
		| "deniedCommands"
	>
	setCachedStateField: <K extends keyof ExtensionState>(field: K, value: ExtensionState[K]) => void
}

export function renderAutoApproveTab({ cachedState, setCachedStateField }: AutoApproveTabProps): React.ReactNode {
	return (
		<AutoApproveSettings
			alwaysAllowReadOnly={cachedState.alwaysAllowReadOnly}
			alwaysAllowReadOnlyOutsideWorkspace={cachedState.alwaysAllowReadOnlyOutsideWorkspace}
			alwaysAllowWrite={cachedState.alwaysAllowWrite}
			alwaysAllowWriteOutsideWorkspace={cachedState.alwaysAllowWriteOutsideWorkspace}
			alwaysAllowWriteProtected={cachedState.alwaysAllowWriteProtected}
			alwaysAllowMcp={cachedState.alwaysAllowMcp}
			alwaysAllowModeSwitch={cachedState.alwaysAllowModeSwitch}
			alwaysAllowSubtasks={cachedState.alwaysAllowSubtasks}
			alwaysAllowExecute={cachedState.alwaysAllowExecute}
			alwaysAllowFollowupQuestions={cachedState.alwaysAllowFollowupQuestions}
			followupAutoApproveTimeoutMs={cachedState.followupAutoApproveTimeoutMs}
			allowedCommands={cachedState.allowedCommands}
			allowedMaxRequests={cachedState.allowedMaxRequests ?? undefined}
			allowedMaxCost={cachedState.allowedMaxCost ?? undefined}
			deniedCommands={cachedState.deniedCommands}
			setCachedStateField={setCachedStateField}
		/>
	)
}
