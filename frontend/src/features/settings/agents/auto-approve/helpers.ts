import { AutoApproveSetting } from "@src/features/settings/components/auto-approve-controls/AutoApproveToggle"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@/i18n/TranslationContext"

const SETTERS: Record<AutoApproveSetting, (value: boolean) => void> = {
	alwaysAllowReadOnly: (v) => rootStore.setAlwaysAllowReadOnly(v),
	alwaysAllowWrite: (v) => rootStore.setAlwaysAllowWrite(v),
	alwaysAllowExecute: (v) => rootStore.setAlwaysAllowExecute(v),
	alwaysAllowMcp: (v) => rootStore.setAlwaysAllowMcp(v),
	alwaysAllowModeSwitch: (v) => rootStore.setAlwaysAllowModeSwitch(v),
	alwaysAllowSubtasks: (v) => rootStore.setAlwaysAllowSubtasks(v),
	alwaysAllowFollowupQuestions: (v) => rootStore.setAlwaysAllowFollowupQuestions(v),
}

export { SETTERS }

export function useTriggerLabels(enabledCount: number, totalCount: number, effectiveAutoApprovalEnabled: boolean) {
	const { t } = useAppTranslation()

	const getTriggerLabel = (): string => {
		if (!effectiveAutoApprovalEnabled) return t("chat:autoApprove.triggerLabelOff")
		if (enabledCount === totalCount) return t("chat:autoApprove.triggerLabelAll")
		return t("chat:autoApprove.triggerLabel", { count: enabledCount })
	}

	const getTriggerLabelShort = (): string => {
		if (!effectiveAutoApprovalEnabled) return t("chat:autoApprove.triggerLabelOffShort")
		if (enabledCount === totalCount) return t("chat:autoApprove.triggerLabelAll")
		return String(enabledCount)
	}

	return { getTriggerLabel, getTriggerLabelShort }
}
