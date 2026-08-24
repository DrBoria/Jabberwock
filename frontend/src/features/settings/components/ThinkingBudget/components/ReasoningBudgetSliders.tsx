import { DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS } from "@shared/api"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Slider } from "@src/shared/ui/inputs/slider"
import type { ReasoningBudgetSlidersProps } from "../types"

export const ReasoningBudgetSliders = ({
	enableReasoningEffort,
	isReasoningBudgetRequired,
	minThinkingTokens,
	customMaxOutputTokens,
	customMaxThinkingTokens,
	modelMaxThinkingTokens,
	modelInfo,
	setApiConfigurationField,
}: ReasoningBudgetSlidersProps) => {
	const { t } = useAppTranslation()
	if (!isReasoningBudgetRequired && !enableReasoningEffort) return null
	const maxSliderValue = Math.max(
		modelInfo.maxTokens ?? 8192,
		customMaxOutputTokens,
		DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS,
	)
	const sliderStep = minThinkingTokens === 128 ? 128 : 1024
	return (
		<>
			<div className="flex flex-col gap-1">
				<div className="font-medium">{t("settings:thinkingBudget.maxTokens")}</div>
				<div className="flex items-center gap-1">
					<Slider
						min={8192}
						max={maxSliderValue}
						step={1024}
						value={[customMaxOutputTokens]}
						onValueChange={([value]) => setApiConfigurationField("modelMaxTokens", value)}
					/>
					<div className="w-12 text-sm text-center">{customMaxOutputTokens}</div>
				</div>
			</div>
			<div className="flex flex-col gap-1">
				<div className="font-medium">{t("settings:thinkingBudget.maxThinkingTokens")}</div>
				<div className="flex items-center gap-1" data-testid="reasoning-budget">
					<Slider
						min={minThinkingTokens}
						max={modelMaxThinkingTokens}
						step={sliderStep}
						value={[customMaxThinkingTokens]}
						onValueChange={([value]) => setApiConfigurationField("modelMaxThinkingTokens", value)}
					/>
					<div className="w-12 text-sm text-center">{customMaxThinkingTokens}</div>
				</div>
			</div>
		</>
	)
}
