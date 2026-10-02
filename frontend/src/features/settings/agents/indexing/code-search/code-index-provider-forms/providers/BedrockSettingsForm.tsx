import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { cn } from "@src/lib/utils"

import { ModelDropdownField } from "./model-dropdown-field"

import type { CodeIndexFormProps } from "@src/features/settings/agents/indexing/code-search/popover-logic/types"

export const BedrockSettingsForm = ({
	currentSettings,
	formErrors,
	updateSetting,
	getAvailableModels,
	codebaseIndexModels,
	t,
}: CodeIndexFormProps) => {
	return (
		<>
			<div className="space-y-2">
				<label className="text-sm font-medium">{t("settings:codeIndex.bedrockRegionLabel")}</label>
				<VSCodeTextField
					value={currentSettings.codebaseIndexBedrockRegion || ""}
					onInput={(e) => updateSetting("codebaseIndexBedrockRegion", (e.target as HTMLInputElement).value)}
					placeholder={t("settings:codeIndex.bedrockRegionPlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexBedrockRegion,
					})}
				/>
				{formErrors.codebaseIndexBedrockRegion && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexBedrockRegion}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<label className="text-sm font-medium">
					{t("settings:codeIndex.bedrockProfileLabel")}
					<span className="text-xs text-vscode-descriptionForeground ml-1">
						({t("settings:codeIndex.optional")})
					</span>
				</label>
				<VSCodeTextField
					value={currentSettings.codebaseIndexBedrockProfile || ""}
					onInput={(e) => updateSetting("codebaseIndexBedrockProfile", (e.target as HTMLInputElement).value)}
					placeholder={t("settings:codeIndex.bedrockProfilePlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexBedrockProfile,
					})}
				/>
				{formErrors.codebaseIndexBedrockProfile && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexBedrockProfile}
					</p>
				)}
				{!formErrors.codebaseIndexBedrockProfile && (
					<p className="text-xs text-vscode-descriptionForeground mt-1 mb-0">
						{t("settings:codeIndex.bedrockProfileDescription")}
					</p>
				)}
			</div>

			<ModelDropdownField
				value={currentSettings.codebaseIndexEmbedderModelId}
				updateSetting={updateSetting}
				error={formErrors.codebaseIndexEmbedderModelId}
				getAvailableModels={getAvailableModels}
				codebaseIndexModels={codebaseIndexModels}
				embedderProvider={currentSettings.codebaseIndexEmbedderProvider}
				t={t}
			/>
		</>
	)
}
