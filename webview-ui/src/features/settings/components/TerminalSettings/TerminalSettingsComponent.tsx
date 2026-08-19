import { useState, useCallback } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useEvent, useMount } from "react-use"
import type { TerminalOutputPreviewSize } from "@jabberwock/types"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { Trans } from "react-i18next"
import { SectionHeader } from "../shared/SectionHeader"
import { Section } from "../shared/Section"
import { SearchableSetting } from "../shared/SearchableSetting"
import type { TerminalSettingsProps } from "./types"
import { handleVscodeSettingMessage, docLink } from "./helpers"
import { AdvancedTerminalSettings } from "./AdvancedTerminalSettings"

export const TerminalSettings = ({
	terminalOutputPreviewSize,
	terminalShellIntegrationTimeout,
	terminalShellIntegrationDisabled,
	terminalCommandDelay,
	terminalPowershellCounter,
	terminalZshClearEolMark,
	terminalZshOhMy,
	terminalZshP10k,
	terminalZdotdir,
	setCachedStateField,
	className,
	...props
}: TerminalSettingsProps) => {
	const { t } = useAppTranslation()
	const [inheritEnv, setInheritEnv] = useState<boolean>(true)
	useMount(() => rootStore.settings.getVscodeSetting("terminal.integrated.inheritEnv"))
	useEvent(
		"message",
		useCallback((event: MessageEvent) => handleVscodeSettingMessage(event, setInheritEnv), []),
	)
	return (
		<div className={cn("flex flex-col", className)} {...props}>
			<SectionHeader>{t("settings:sections.terminal")}</SectionHeader>
			<Section>
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2 font-bold">
							<span className="codicon codicon-settings-gear" />
							<div>{t("settings:terminal.basic.label")}</div>
						</div>
					</div>
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<SearchableSetting
							settingId="terminal-output-preview-size"
							section="terminal"
							label={t("settings:terminal.outputPreviewSize.label")}>
							<label className="block font-medium mb-1">
								{t("settings:terminal.outputPreviewSize.label")}
							</label>
							<Select
								value={terminalOutputPreviewSize || "medium"}
								onValueChange={(value) =>
									setCachedStateField("terminalOutputPreviewSize", value as TerminalOutputPreviewSize)
								}>
								<SelectTrigger className="w-full" data-testid="terminal-output-preview-size-dropdown">
									<SelectValue placeholder={t("settings:common.select")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="small">
										{t("settings:terminal.outputPreviewSize.options.small")}
									</SelectItem>
									<SelectItem value="medium">
										{t("settings:terminal.outputPreviewSize.options.medium")}
									</SelectItem>
									<SelectItem value="large">
										{t("settings:terminal.outputPreviewSize.options.large")}
									</SelectItem>
								</SelectContent>
							</Select>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:terminal.outputPreviewSize.description")}
							</div>
						</SearchableSetting>
					</div>
				</div>
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2 font-bold">
							<span className="codicon codicon-tools" />
							<div>{t("settings:terminal.advanced.label")}</div>
						</div>
						<div className="text-vscode-descriptionForeground">
							{t("settings:terminal.advanced.description")}
						</div>
					</div>
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<SearchableSetting
							settingId="terminal-shell-integration-disabled"
							section="terminal"
							label={t("settings:terminal.shellIntegrationDisabled.label")}>
							<VSCodeCheckbox
								checked={terminalShellIntegrationDisabled ?? true}
								onChange={(e) =>
									setCachedStateField(
										"terminalShellIntegrationDisabled",
										(e.target as HTMLInputElement).checked,
									)
								}>
								<span className="font-medium">
									{t("settings:terminal.shellIntegrationDisabled.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								<Trans i18nKey="settings:terminal.shellIntegrationDisabled.description">
									{docLink(
										"features/shell-integration#use-inline-terminal-recommended",
										"settings_terminal_shell_integration_disabled",
									)}
								</Trans>
							</div>
						</SearchableSetting>
						<AdvancedTerminalSettings
							terminalShellIntegrationDisabled={terminalShellIntegrationDisabled}
							terminalShellIntegrationTimeout={terminalShellIntegrationTimeout}
							terminalCommandDelay={terminalCommandDelay}
							terminalPowershellCounter={terminalPowershellCounter}
							terminalZshClearEolMark={terminalZshClearEolMark}
							terminalZshOhMy={terminalZshOhMy}
							terminalZshP10k={terminalZshP10k}
							terminalZdotdir={terminalZdotdir}
							inheritEnv={inheritEnv}
							setCachedStateField={setCachedStateField}
							setInheritEnv={setInheritEnv}
							t={t}
						/>
					</div>
				</div>
			</Section>
		</div>
	)
}
