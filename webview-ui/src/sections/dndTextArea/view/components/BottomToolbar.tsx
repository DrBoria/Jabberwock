import React from "react"
import { Activity, VolumeX } from "lucide-react"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { Button } from "@src/shared/ui/buttons/button"
import { Container } from "@src/shared/ui/layouts/Container"
import { ModeSelector } from "@src/features/settings/agents/mode-selector/ModeSelector"
import { ApiConfigSelector } from "@src/features/settings/agents/api-config/api-config-selector/index"
import { AutoApproveDropdown } from "@src/features/settings/agents/auto-approve/index"
import { IndexingStatusBadge } from "@src/features/settings/agents/indexing/status-badge"
import { CloudAccountSwitcher } from "@src/features/cloud/components/CloudAccountSwitcher"
import type { BottomToolbarProps } from "../types"

const DevToolsButton: React.FC<{
	devtoolEnabled: boolean
	toggleDevtool: () => void
}> = ({ devtoolEnabled, toggleDevtool }) => (
	<StandardTooltip content="Toggle DevTools">
		<Button
			variant="devtoolsButton"
			size="icon"
			aria-label="Toggle DevTools"
			onClick={toggleDevtool}
			className={cn(
				devtoolEnabled
					? "text-[#ffaa00] hover:bg-[rgba(255,170,0,0.1)] active:bg-[rgba(255,170,0,0.2)]"
					: "text-vscode-foreground opacity-60 hover:opacity-100 hover:bg-[rgba(255,255,255,0.05)] active:bg-[rgba(255,255,255,0.1)]",
			)}>
			<Activity className="w-4 h-4" />
		</Button>
	</StandardTooltip>
)

const TtsStopButton: React.FC<{
	stopTts: () => void
	t: (key: string, params?: Record<string, string>) => string
}> = ({ stopTts, t }) => (
	<StandardTooltip content={t("chat:stopTts")}>
		<Button variant="iconButton" size="icon" aria-label={t("chat:stopTts")} onClick={stopTts}>
			<VolumeX className="w-4 h-4" />
		</Button>
	</StandardTooltip>
)

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
	mode,
	handleModeChange,
	currentConfigId,
	displayName,
	sendingDisabled,
	handleApiConfigChange,
	listApiConfigMeta,
	pinnedApiConfigs,
	togglePinnedApiConfig,
	lockApiConfigAcrossModes,
	handleToggleLockApiConfig,
	customModes,
	customModePrompts,
	modeShortcutText,
	devtoolEnabled,
	toggleDevtool,
	isTtsPlaying,
	stopTts,
	isEditMode,
	cloudUserInfo,
	t,
}) => (
	<Container className="flex items-center gap-2">
		<Container className="flex items-center gap-2 min-w-0 overflow-clip flex-1">
			<ModeSelector
				data-agent-action="mode-select"
				value={mode}
				title={t("chat:selectMode")}
				onChange={handleModeChange}
				triggerClassName="text-ellipsis overflow-hidden flex-shrink-0"
				modeShortcutText={modeShortcutText}
				customModes={customModes}
				customModePrompts={customModePrompts}
			/>
			<ApiConfigSelector
				value={currentConfigId}
				displayName={displayName}
				disabled={sendingDisabled}
				title={t("chat:selectApiConfig")}
				onChange={handleApiConfigChange}
				triggerClassName="min-w-[28px] text-ellipsis overflow-hidden flex-shrink"
				listApiConfigMeta={listApiConfigMeta || []}
				pinnedApiConfigs={pinnedApiConfigs}
				togglePinnedApiConfig={togglePinnedApiConfig}
				lockApiConfigAcrossModes={lockApiConfigAcrossModes}
				onToggleLockApiConfig={handleToggleLockApiConfig}
			/>
			<AutoApproveDropdown triggerClassName="min-w-[28px] text-ellipsis overflow-hidden flex-shrink" />
		</Container>
		<Container
			className={cn(
				"flex flex-shrink-0 items-center gap-0.5 h-5 leading-none",
				!isEditMode && cloudUserInfo ? "" : "pr-2",
			)}>
			<DevToolsButton devtoolEnabled={devtoolEnabled} toggleDevtool={toggleDevtool} />
			{isTtsPlaying && <TtsStopButton stopTts={stopTts} t={t} />}
			{!isEditMode ? <IndexingStatusBadge /> : null}
			{!isEditMode && cloudUserInfo && <CloudAccountSwitcher />}
		</Container>
	</Container>
)
