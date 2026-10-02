import { Checkbox } from "vscrui"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { ReasoningBinaryToggleProps } from "@src/features/settings/components/ThinkingBudget/types"
import { makeEnableReasoningHandler } from "./reasoning-field-events"

export const ReasoningBinaryToggle = ({
	enableReasoningEffort,
	setApiConfigurationField,
}: ReasoningBinaryToggleProps) => {
	const { t } = useAppTranslation()
	const onEnableChange = makeEnableReasoningHandler(setApiConfigurationField)
	return (
		<div className="flex flex-col gap-1">
			<Checkbox checked={enableReasoningEffort} onChange={onEnableChange}>
				{t("settings:providers.useReasoning")}
			</Checkbox>
		</div>
	)
}
