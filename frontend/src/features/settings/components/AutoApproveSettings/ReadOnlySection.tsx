import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { SearchableSetting } from "../shared/SearchableSetting"
import type { AutoApproveSettingsProps, AutoApproveSectionProps } from "./types"

type ReadOnlySectionProps = AutoApproveSectionProps & {
	alwaysAllowReadOnlyOutsideWorkspace?: boolean
}

export const ReadOnlySection = ({
	alwaysAllowReadOnlyOutsideWorkspace,
	setCachedStateField,
	t,
}: ReadOnlySectionProps) => (
	<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
		<div className="flex items-center gap-4 font-bold">
			<span className="codicon codicon-eye" />
			<div>{t("settings:autoApprove.readOnly.label")}</div>
		</div>
		<SearchableSetting
			settingId="auto-approve-readonly-outside-workspace"
			section="autoApprove"
			label={t("settings:autoApprove.readOnly.outsideWorkspace.label")}>
			<VSCodeCheckbox
				checked={alwaysAllowReadOnlyOutsideWorkspace}
				onChange={(e) =>
					setCachedStateField("alwaysAllowReadOnlyOutsideWorkspace", (e.target as HTMLInputElement).checked)
				}
				data-testid="always-allow-readonly-outside-workspace-checkbox">
				<span className="font-medium">{t("settings:autoApprove.readOnly.outsideWorkspace.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm mt-1">
				{t("settings:autoApprove.readOnly.outsideWorkspace.description")}
			</div>
		</SearchableSetting>
	</div>
)

export const isReadOnlyVisible = (props: AutoApproveSettingsProps): boolean => !!props.alwaysAllowReadOnly
