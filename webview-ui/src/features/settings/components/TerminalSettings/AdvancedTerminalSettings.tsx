import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { rootStore } from "@src/features/store"
import { Slider } from "@src/shared/ui/inputs/slider"
import { SearchableSetting } from "../shared/SearchableSetting"
import { defaultTimeout, defaultDelay, defaultFalse, defaultTrue, SettingDescription } from "./helpers"
import type { AdvancedProps } from "./types"

export const AdvancedTerminalSettings = ({
	terminalShellIntegrationDisabled,
	terminalShellIntegrationTimeout,
	terminalCommandDelay,
	terminalPowershellCounter,
	terminalZshClearEolMark,
	terminalZshOhMy,
	terminalZshP10k,
	terminalZdotdir,
	inheritEnv,
	setCachedStateField,
	setInheritEnv,
	t,
}: AdvancedProps) => {
	if (terminalShellIntegrationDisabled) return null
	return (
		<>
			<SearchableSetting
				settingId="terminal-inherit-env"
				section="terminal"
				label={t("settings:terminal.inheritEnv.label")}>
				<VSCodeCheckbox
					checked={inheritEnv}
					onChange={(e) => (
						setInheritEnv((e.target as HTMLInputElement).checked),
						rootStore.settings.updateVscodeSetting(
							"terminal.integrated.inheritEnv",
							Number((e.target as HTMLInputElement).checked),
						)
					)}
					data-testid="terminal-inherit-env-checkbox">
					<span className="font-medium">{t("settings:terminal.inheritEnv.label")}</span>
				</VSCodeCheckbox>
				<SettingDescription
					i18nKey="settings:terminal.inheritEnv.description"
					href="features/shell-integration#inherit-environment-variables"
					linkId="settings_terminal_inherit_env"
				/>
			</SearchableSetting>
			<SearchableSetting
				settingId="terminal-shell-integration-timeout"
				section="terminal"
				label={t("settings:terminal.shellIntegrationTimeout.label")}>
				<label className="block font-medium mb-1">{t("settings:terminal.shellIntegrationTimeout.label")}</label>
				<div className="flex items-center gap-2">
					<Slider
						min={1000}
						max={60000}
						step={1000}
						value={[defaultTimeout(terminalShellIntegrationTimeout)]}
						onValueChange={([value]) =>
							setCachedStateField(
								"terminalShellIntegrationTimeout",
								Math.min(60000, Math.max(1000, value)),
							)
						}
					/>
					<span className="w-10">{defaultTimeout(terminalShellIntegrationTimeout) / 1000}s</span>
				</div>
				<SettingDescription
					i18nKey="settings:terminal.shellIntegrationTimeout.description"
					href="features/shell-integration#terminal-shell-integration-timeout"
					linkId="settings_terminal_shell_integration_timeout"
				/>
			</SearchableSetting>
			<SearchableSetting
				settingId="terminal-command-delay"
				section="terminal"
				label={t("settings:terminal.commandDelay.label")}>
				<label className="block font-medium mb-1">{t("settings:terminal.commandDelay.label")}</label>
				<div className="flex items-center gap-2">
					<Slider
						min={0}
						max={1000}
						step={10}
						value={[terminalCommandDelay || 0]}
						onValueChange={([value]) =>
							setCachedStateField("terminalCommandDelay", Math.min(1000, Math.max(0, value)))
						}
					/>
					<span className="w-10">{defaultDelay(terminalCommandDelay)}ms</span>
				</div>
				<SettingDescription
					i18nKey="settings:terminal.commandDelay.description"
					href="features/shell-integration#terminal-command-delay"
					linkId="settings_terminal_command_delay"
				/>
			</SearchableSetting>
			<SearchableSetting
				settingId="terminal-powershell-counter"
				section="terminal"
				label={t("settings:terminal.powershellCounter.label")}>
				<VSCodeCheckbox
					checked={defaultFalse(terminalPowershellCounter)}
					onChange={(e) =>
						setCachedStateField("terminalPowershellCounter", (e.target as HTMLInputElement).checked)
					}
					data-testid="terminal-powershell-counter-checkbox">
					<span className="font-medium">{t("settings:terminal.powershellCounter.label")}</span>
				</VSCodeCheckbox>
				<SettingDescription
					i18nKey="settings:terminal.powershellCounter.description"
					href="features/shell-integration#enable-powershell-counter-workaround"
					linkId="settings_terminal_powershell_counter"
				/>
			</SearchableSetting>
			<SearchableSetting
				settingId="terminal-zsh-clear-eol-mark"
				section="terminal"
				label={t("settings:terminal.zshClearEolMark.label")}>
				<VSCodeCheckbox
					checked={defaultTrue(terminalZshClearEolMark)}
					onChange={(e) =>
						setCachedStateField("terminalZshClearEolMark", (e.target as HTMLInputElement).checked)
					}
					data-testid="terminal-zsh-clear-eol-mark-checkbox">
					<span className="font-medium">{t("settings:terminal.zshClearEolMark.label")}</span>
				</VSCodeCheckbox>
				<SettingDescription
					i18nKey="settings:terminal.zshClearEolMark.description"
					href="features/shell-integration#clear-zsh-eol-mark"
					linkId="settings_terminal_zsh_clear_eol_mark"
				/>
			</SearchableSetting>
			<SearchableSetting
				settingId="terminal-zsh-oh-my"
				section="terminal"
				label={t("settings:terminal.zshOhMy.label")}>
				<VSCodeCheckbox
					checked={defaultFalse(terminalZshOhMy)}
					onChange={(e) => setCachedStateField("terminalZshOhMy", (e.target as HTMLInputElement).checked)}
					data-testid="terminal-zsh-oh-my-checkbox">
					<span className="font-medium">{t("settings:terminal.zshOhMy.label")}</span>
				</VSCodeCheckbox>
				<SettingDescription
					i18nKey="settings:terminal.zshOhMy.description"
					href="features/shell-integration#enable-oh-my-zsh-integration"
					linkId="settings_terminal_zsh_oh_my"
				/>
			</SearchableSetting>
			<SearchableSetting
				settingId="terminal-zsh-p10k"
				section="terminal"
				label={t("settings:terminal.zshP10k.label")}>
				<VSCodeCheckbox
					checked={defaultFalse(terminalZshP10k)}
					onChange={(e) => setCachedStateField("terminalZshP10k", (e.target as HTMLInputElement).checked)}
					data-testid="terminal-zsh-p10k-checkbox">
					<span className="font-medium">{t("settings:terminal.zshP10k.label")}</span>
				</VSCodeCheckbox>
				<SettingDescription
					i18nKey="settings:terminal.zshP10k.description"
					href="features/shell-integration#enable-powerlevel10k-integration"
					linkId="settings_terminal_zsh_p10k"
				/>
			</SearchableSetting>
			<SearchableSetting
				settingId="terminal-zdotdir"
				section="terminal"
				label={t("settings:terminal.zdotdir.label")}>
				<VSCodeCheckbox
					checked={defaultFalse(terminalZdotdir)}
					onChange={(e) => setCachedStateField("terminalZdotdir", (e.target as HTMLInputElement).checked)}
					data-testid="terminal-zdotdir-checkbox">
					<span className="font-medium">{t("settings:terminal.zdotdir.label")}</span>
				</VSCodeCheckbox>
				<SettingDescription
					i18nKey="settings:terminal.zdotdir.description"
					href="features/shell-integration#enable-zdotdir-handling"
					linkId="settings_terminal_zdotdir"
				/>
			</SearchableSetting>
		</>
	)
}
