import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import type { ReasoningEffortSelectorProps } from "../types"
import { getEffortLabel } from "../helpers"

export const ReasoningEffortSelector = ({
	currentReasoningEffort,
	availableOptions,
	onEffortChange,
}: ReasoningEffortSelectorProps) => {
	const { t } = useAppTranslation()
	return (
		<div className="flex flex-col gap-1" data-testid="reasoning-effort">
			<div className="flex justify-between items-center">
				<label className="block font-medium mb-1">{t("settings:providers.reasoningEffort.label")}</label>
			</div>
			<Select value={currentReasoningEffort} onValueChange={onEffortChange}>
				<SelectTrigger className="w-full">
					<SelectValue
						placeholder={
							currentReasoningEffort
								? getEffortLabel(currentReasoningEffort, t)
								: t("settings:common.select")
						}
					/>
				</SelectTrigger>
				<SelectContent>
					{availableOptions.map((value) => (
						<SelectItem key={value} value={value}>
							{getEffortLabel(value, t)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
