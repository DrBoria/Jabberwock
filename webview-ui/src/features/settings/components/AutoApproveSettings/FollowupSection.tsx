import { Slider } from "@src/shared/ui/inputs/slider"
import { SearchableSetting } from "../shared/SearchableSetting"
import type { AutoApproveSettingsProps, AutoApproveSectionProps } from "./types"

type FollowupSectionProps = AutoApproveSectionProps & {
	followupAutoApproveTimeoutMs: number
}

export const FollowupSection = ({ followupAutoApproveTimeoutMs, setCachedStateField, t }: FollowupSectionProps) => (
	<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
		<div className="flex items-center gap-4 font-bold">
			<span className="codicon codicon-question" />
			<div>{t("settings:autoApprove.followupQuestions.label")}</div>
		</div>
		<SearchableSetting
			settingId="auto-approve-followup-timeout"
			section="autoApprove"
			label={t("settings:autoApprove.followupQuestions.timeoutLabel")}>
			<div className="flex items-center gap-2">
				<Slider
					min={1000}
					max={300000}
					step={1000}
					value={[followupAutoApproveTimeoutMs]}
					onValueChange={([value]) => setCachedStateField("followupAutoApproveTimeoutMs", value)}
					data-testid="followup-timeout-slider"
				/>
				<span className="w-20">{followupAutoApproveTimeoutMs / 1000}s</span>
			</div>
			<div className="text-vscode-descriptionForeground text-sm mt-1">
				{t("settings:autoApprove.followupQuestions.timeoutLabel")}
			</div>
		</SearchableSetting>
	</div>
)

export const isFollowupVisible = (props: AutoApproveSettingsProps): boolean => !!props.alwaysAllowFollowupQuestions
