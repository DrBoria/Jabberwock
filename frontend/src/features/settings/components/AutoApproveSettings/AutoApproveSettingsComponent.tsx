import { Trans } from "react-i18next"
import { Package } from "@shared/package"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { rootStore } from "@src/features/store"
import { observer } from "mobx-react-lite"
import { useAutoApprovalState } from "@/hooks/useAutoApprovalState"
import { useAutoApprovalToggles } from "@/hooks/useAutoApprovalToggles"
import { SectionHeader } from "../shared/SectionHeader"
import { Section } from "../shared/Section"
import { SearchableSetting } from "../shared/SearchableSetting"
import { AutoApproveToggle } from "../auto-approve-controls/AutoApproveToggle"
import { MaxLimitInputs } from "../auto-approve-controls/MaxLimitInputs"
import { AutoApproveExecuteSection } from "../auto-approve-controls/AutoApproveExecuteSection"
import { ReadOnlySection, isReadOnlyVisible } from "./ReadOnlySection"
import { WriteSection, isWriteVisible } from "./WriteSection"
import { FollowupSection, isFollowupVisible } from "./FollowupSection"
import type { AutoApproveSettingsProps } from "./types"

export const AutoApproveSettings = observer(
	({
		alwaysAllowReadOnly,
		alwaysAllowReadOnlyOutsideWorkspace,
		alwaysAllowWrite,
		alwaysAllowWriteOutsideWorkspace,
		alwaysAllowWriteProtected,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		alwaysAllowExecute,
		alwaysAllowFollowupQuestions,
		followupAutoApproveTimeoutMs = 60000,
		allowedCommands,
		allowedMaxRequests,
		allowedMaxCost,
		deniedCommands,
		setCachedStateField,
		...props
	}: AutoApproveSettingsProps) => {
		const { t } = useAppTranslation()
		const autoApprovalEnabled = rootStore.extensionState.autoApprovalEnabled
		const toggles = useAutoApprovalToggles()
		const { effectiveAutoApprovalEnabled } = useAutoApprovalState(toggles, autoApprovalEnabled)

		return (
			<div {...props}>
				<SectionHeader>{t("settings:sections.autoApprove")}</SectionHeader>
				<Section>
					<div className="space-y-4">
						<SearchableSetting
							settingId="auto-approve-enabled"
							section="autoApprove"
							label={t("settings:autoApprove.enabled")}>
							<VSCodeCheckbox
								checked={effectiveAutoApprovalEnabled}
								aria-label={t("settings:autoApprove.toggleAriaLabel")}
								onChange={() => rootStore.setAutoApprovalEnabled(!(autoApprovalEnabled ?? false))}>
								<span className="font-medium">{t("settings:autoApprove.enabled")}</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								<p>{t("settings:autoApprove.description")}</p>
								<p>
									<Trans
										i18nKey="settings:autoApprove.toggleShortcut"
										components={{
											SettingsLink: (
												<a
													href="#"
													className="text-vscode-textLink-foreground hover:underline cursor-pointer"
													onClick={(e) => {
														e.preventDefault()
														rootStore.settings.openKeyboardShortcuts(
															`${Package.name}.toggleAutoApprove`,
														)
													}}
												/>
											),
										}}
									/>
								</p>
							</div>
						</SearchableSetting>
						<AutoApproveToggle
							alwaysAllowReadOnly={alwaysAllowReadOnly}
							alwaysAllowWrite={alwaysAllowWrite}
							alwaysAllowMcp={alwaysAllowMcp}
							alwaysAllowModeSwitch={alwaysAllowModeSwitch}
							alwaysAllowSubtasks={alwaysAllowSubtasks}
							alwaysAllowExecute={alwaysAllowExecute}
							alwaysAllowFollowupQuestions={alwaysAllowFollowupQuestions}
							onToggle={(key, value) => setCachedStateField(key, value)}
						/>
						<MaxLimitInputs
							allowedMaxRequests={allowedMaxRequests}
							allowedMaxCost={allowedMaxCost}
							onMaxRequestsChange={(value) => setCachedStateField("allowedMaxRequests", value)}
							onMaxCostChange={(value) => setCachedStateField("allowedMaxCost", value)}
						/>
					</div>
					{isReadOnlyVisible({ alwaysAllowReadOnly } as AutoApproveSettingsProps) && (
						<ReadOnlySection
							alwaysAllowReadOnlyOutsideWorkspace={alwaysAllowReadOnlyOutsideWorkspace}
							setCachedStateField={setCachedStateField}
							t={t}
						/>
					)}
					{isWriteVisible({ alwaysAllowWrite } as AutoApproveSettingsProps) && (
						<WriteSection
							alwaysAllowWriteOutsideWorkspace={alwaysAllowWriteOutsideWorkspace}
							alwaysAllowWriteProtected={alwaysAllowWriteProtected}
							setCachedStateField={setCachedStateField}
							t={t}
						/>
					)}
					{isFollowupVisible({ alwaysAllowFollowupQuestions } as AutoApproveSettingsProps) && (
						<FollowupSection
							followupAutoApproveTimeoutMs={followupAutoApproveTimeoutMs}
							setCachedStateField={setCachedStateField}
							t={t}
						/>
					)}
					{alwaysAllowExecute && (
						<AutoApproveExecuteSection
							allowedCommands={allowedCommands}
							deniedCommands={deniedCommands}
							setCachedStateField={setCachedStateField}
						/>
					)}
				</Section>
			</div>
		)
	},
)
