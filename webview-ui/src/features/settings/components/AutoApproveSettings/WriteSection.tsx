import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { SearchableSetting } from "../shared/SearchableSetting"
import type { AutoApproveSettingsProps, AutoApproveSectionProps } from "./types"

type WriteSectionProps = AutoApproveSectionProps & {
	alwaysAllowWriteOutsideWorkspace?: boolean
	alwaysAllowWriteProtected?: boolean
}

export const WriteSection = ({
	alwaysAllowWriteOutsideWorkspace,
	alwaysAllowWriteProtected,
	setCachedStateField,
	t,
}: WriteSectionProps) => (
	<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
		<div className="flex items-center gap-4 font-bold">
			<span className="codicon codicon-edit" />
			<div>{t("settings:autoApprove.write.label")}</div>
		</div>
		<SearchableSetting
			settingId="auto-approve-write-outside-workspace"
			section="autoApprove"
			label={t("settings:autoApprove.write.outsideWorkspace.label")}>
			<VSCodeCheckbox
				checked={alwaysAllowWriteOutsideWorkspace}
				onChange={(e) =>
					setCachedStateField("alwaysAllowWriteOutsideWorkspace", (e.target as HTMLInputElement).checked)
				}
				data-testid="always-allow-write-outside-workspace-checkbox">
				<span className="font-medium">{t("settings:autoApprove.write.outsideWorkspace.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm mt-1">
				{t("settings:autoApprove.write.outsideWorkspace.description")}
			</div>
		</SearchableSetting>
		<SearchableSetting
			settingId="auto-approve-write-protected"
			section="autoApprove"
			label={t("settings:autoApprove.write.protected.label")}>
			<VSCodeCheckbox
				checked={alwaysAllowWriteProtected}
				onChange={(e) =>
					setCachedStateField("alwaysAllowWriteProtected", (e.target as HTMLInputElement).checked)
				}
				data-testid="always-allow-write-protected-checkbox">
				<span className="font-medium">{t("settings:autoApprove.write.protected.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
				{t("settings:autoApprove.write.protected.description")}
			</div>
		</SearchableSetting>
	</div>
)

export const isWriteVisible = (props: AutoApproveSettingsProps): boolean => !!props.alwaysAllowWrite
