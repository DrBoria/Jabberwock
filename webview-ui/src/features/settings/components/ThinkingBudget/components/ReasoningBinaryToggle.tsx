import { Checkbox } from "vscrui"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { ReasoningBinaryToggleProps } from "../types"

export const ReasoningBinaryToggle = ({
	enableReasoningEffort,
	setApiConfigurationField,
}: ReasoningBinaryToggleProps) => {
	const { t } = useAppTranslation()
	return (
		<div className="flex flex-col gap-1">
			<Checkbox
				checked={enableReasoningEffort}
				onChange={(checked: boolean) => setApiConfigurationField("enableReasoningEffort", checked === true)}>
				{t("settings:providers.useReasoning")}
			</Checkbox>
		</div>
	)
}
