import { useMemo } from "react"
import { rootStore } from "@src/features/store"

/**
 * Custom hook that creates and returns the auto-approval toggles object
 * This encapsulates the logic for creating the toggles object from "extension" state
 */
export function useAutoApprovalToggles() {
	const s = rootStore.extensionState
	const {
		alwaysAllowReadOnly,
		alwaysAllowWrite,
		alwaysAllowExecute,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		alwaysAllowFollowupQuestions,
	} = s

	const toggles = useMemo(
		() => ({
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowExecute,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			alwaysAllowFollowupQuestions,
		}),
		[
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowExecute,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			alwaysAllowFollowupQuestions,
		],
	)

	return toggles
}

interface AutoApprovalToggles {
	alwaysAllowReadOnly?: boolean
	alwaysAllowWrite?: boolean
	alwaysAllowExecute?: boolean
	alwaysAllowMcp?: boolean
	alwaysAllowModeSwitch?: boolean
	alwaysAllowSubtasks?: boolean
	alwaysAllowFollowupQuestions?: boolean
}

export function useAutoApprovalState(toggles: AutoApprovalToggles, autoApprovalEnabled?: boolean) {
	const hasEnabledOptions = useMemo(() => {
		return Object.values(toggles).some((value) => !!value)
	}, [toggles])

	const effectiveAutoApprovalEnabled = useMemo(() => {
		return autoApprovalEnabled ?? false
	}, [autoApprovalEnabled])

	return {
		hasEnabledOptions,
		effectiveAutoApprovalEnabled,
	}
}
