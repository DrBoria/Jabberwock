import type { SectionName } from "../../constants"
import { CheckpointSettings } from "../../../about-general/CheckpointSettings"
import { NotificationSettings } from "../../../about-general/NotificationSettings"
import { TerminalSettings } from "../../../TerminalSettings/TerminalSettingsComponent"
import { ExperimentalSettings } from "../../../experimental/ExperimentalSettings"
import { LanguageSettings } from "../../../about-general/LanguageSettings"
import { About } from "../../../about-general/About"
import PromptsSettings from "../../../PromptsSettings/PromptsSettingsComponent"
import { SystemPromptsSettings } from "../../../PromptsSettings/SystemPromptsSettings"
import { SlashCommandsSettings } from "../../../slash-commands/SlashCommandsSettings"
import { SkillsSettings } from "../../../SkillsSettings/SkillsSettingsComponent"
import { UISettings } from "../../../about-general/UISettings"
import ModesView from "@/features/settings/agents/components/ModesView"
import McpView from "@src/features/settings/mcp/components/McpView"
import { WorktreesView } from "@src/features/settings/components/WorktreesView/WorktreesViewComponent"
import { renderProvidersTab } from "./providers-tab"
import { renderAutoApproveTab } from "./auto-approve-tab"
import { renderContextManagementTab } from "./context-management-tab"
import type { BuildTabRenderersParams } from "./types"

export function buildTabRenderers(params: BuildTabRenderersParams): Record<SectionName, () => React.ReactNode> {
	const {
		cachedState,
		apiConfiguration,
		currentApiConfigName,
		listApiConfigMeta,
		uriScheme,
		errorMessage,
		setErrorMessage,
		setCachedStateField,
		setApiConfigurationField,
		setExperimentEnabled,
		setTelemetrySetting,
		setDebug,
		setImageGenerationProvider,
		setOpenRouterImageApiKey,
		setImageGenerationSelectedModel,
		setCustomSupportPromptsField,
		checkUnsaveChanges,
		onRenameConfig,
		t,
	} = params

	const {
		enableCheckpoints,
		checkpointTimeout,
		ttsEnabled,
		ttsSpeed,
		soundEnabled,
		soundVolume,
		telemetrySetting,
		terminalOutputPreviewSize,
		terminalShellIntegrationTimeout,
		terminalShellIntegrationDisabled,
		terminalCommandDelay,
		terminalPowershellCounter,
		terminalZshClearEolMark,
		terminalZshOhMy,
		terminalZshP10k,
		terminalZdotdir,
		customSupportPrompts,
		includeTaskHistoryInEnhance,
		language,
		experiments,
		imageGenerationProvider,
		openRouterImageApiKey,
		openRouterImageGenerationSelectedModel,
		reasoningBlockCollapsed,
		enterBehavior,
		locatorTarget,
	} = cachedState

	return {
		providers: () =>
			renderProvidersTab({
				currentApiConfigName,
				listApiConfigMeta,
				uriScheme,
				apiConfiguration,
				setApiConfigurationField,
				errorMessage,
				setErrorMessage,
				checkUnsaveChanges,
				onRenameConfig,
				t,
			}),
		autoApprove: () =>
			renderAutoApproveTab({
				cachedState,
				setCachedStateField,
			}),
		slashCommands: () => <SlashCommandsSettings />,
		skills: () => <SkillsSettings />,
		checkpoints: () => (
			<CheckpointSettings
				enableCheckpoints={enableCheckpoints}
				checkpointTimeout={checkpointTimeout}
				setCachedStateField={setCachedStateField}
			/>
		),
		notifications: () => (
			<NotificationSettings
				ttsEnabled={ttsEnabled}
				ttsSpeed={ttsSpeed}
				soundEnabled={soundEnabled}
				soundVolume={soundVolume}
				setCachedStateField={setCachedStateField}
			/>
		),
		contextManagement: () =>
			renderContextManagementTab({
				cachedState,
				listApiConfigMeta,
				customSupportPrompts: customSupportPrompts || {},
				setCustomSupportPrompts: setCustomSupportPromptsField,
				setCachedStateField,
			}),
		terminal: () => (
			<TerminalSettings
				terminalOutputPreviewSize={terminalOutputPreviewSize}
				terminalShellIntegrationTimeout={terminalShellIntegrationTimeout}
				terminalShellIntegrationDisabled={terminalShellIntegrationDisabled}
				terminalCommandDelay={terminalCommandDelay}
				terminalPowershellCounter={terminalPowershellCounter}
				terminalZshClearEolMark={terminalZshClearEolMark}
				terminalZshOhMy={terminalZshOhMy}
				terminalZshP10k={terminalZshP10k}
				terminalZdotdir={terminalZdotdir}
				setCachedStateField={setCachedStateField}
			/>
		),
		modes: () => <ModesView />,
		mcp: () => <McpView />,
		worktrees: () => <WorktreesView />,
		prompts: () => (
			<>
				<PromptsSettings
					customSupportPrompts={customSupportPrompts || {}}
					setCustomSupportPrompts={setCustomSupportPromptsField}
					includeTaskHistoryInEnhance={includeTaskHistoryInEnhance}
					setIncludeTaskHistoryInEnhance={(value) =>
						setCachedStateField("includeTaskHistoryInEnhance", value)
					}
				/>
				<div className="mt-8">
					<SystemPromptsSettings />
				</div>
			</>
		),
		ui: () => (
			<UISettings
				reasoningBlockCollapsed={reasoningBlockCollapsed ?? true}
				enterBehavior={enterBehavior ?? "send"}
				locatorTarget={locatorTarget ?? "vscode"}
				setCachedStateField={setCachedStateField}
			/>
		),
		experimental: () => (
			<ExperimentalSettings
				setExperimentEnabled={setExperimentEnabled}
				experiments={experiments}
				apiConfiguration={apiConfiguration}
				imageGenerationProvider={imageGenerationProvider}
				openRouterImageApiKey={openRouterImageApiKey}
				openRouterImageGenerationSelectedModel={openRouterImageGenerationSelectedModel}
				setImageGenerationProvider={setImageGenerationProvider}
				setOpenRouterImageApiKey={setOpenRouterImageApiKey}
				setImageGenerationSelectedModel={setImageGenerationSelectedModel}
			/>
		),
		language: () => <LanguageSettings language={language || "en"} setCachedStateField={setCachedStateField} />,
		about: () => (
			<About
				telemetrySetting={telemetrySetting}
				setTelemetrySetting={setTelemetrySetting}
				debug={cachedState.debug}
				setDebug={setDebug}
			/>
		),
	}
}
