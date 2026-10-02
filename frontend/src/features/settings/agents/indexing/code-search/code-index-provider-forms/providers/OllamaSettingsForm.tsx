import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { cn } from "@src/lib/utils"

import { handleModelIdInput } from "./model-dropdown-field"

import type { CodeIndexFormProps } from "@src/features/settings/agents/indexing/code-search/popover-logic/types"

const DEFAULT_OLLAMA_URL = "http://localhost:11434"

export const OllamaSettingsForm = ({ currentSettings, formErrors, updateSetting, t }: CodeIndexFormProps) => {
	return (
		<>
			<div className="space-y-2">
				<label className="text-sm font-medium">{t("settings:codeIndex.ollamaBaseUrlLabel")}</label>
				<VSCodeTextField
					value={currentSettings.codebaseIndexEmbedderBaseUrl || ""}
					onInput={(e) => updateSetting("codebaseIndexEmbedderBaseUrl", (e.target as HTMLInputElement).value)}
					onBlur={(e) => {
						if (!(e.target as HTMLInputElement).value.trim()) {
							;(e.target as HTMLInputElement).value = DEFAULT_OLLAMA_URL
							updateSetting("codebaseIndexEmbedderBaseUrl", DEFAULT_OLLAMA_URL)
						}
					}}
					placeholder={t("settings:codeIndex.ollamaUrlPlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexEmbedderBaseUrl,
					})}
				/>
				{formErrors.codebaseIndexEmbedderBaseUrl && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexEmbedderBaseUrl}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<label className="text-sm font-medium">{t("settings:codeIndex.modelLabel")}</label>
				<VSCodeTextField
					value={currentSettings.codebaseIndexEmbedderModelId || ""}
					onInput={handleModelIdInput(updateSetting)}
					placeholder={t("settings:codeIndex.modelPlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexEmbedderModelId,
					})}
				/>
				{formErrors.codebaseIndexEmbedderModelId && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexEmbedderModelId}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<label className="text-sm font-medium">{t("settings:codeIndex.modelDimensionLabel")}</label>
				<VSCodeTextField
					value={currentSettings.codebaseIndexEmbedderModelDimension?.toString() || ""}
					onInput={(e) => {
						const value = (e.target as HTMLInputElement).value
							? parseInt((e.target as HTMLInputElement).value, 10) || undefined
							: undefined
						updateSetting("codebaseIndexEmbedderModelDimension", value)
					}}
					placeholder={t("settings:codeIndex.modelDimensionPlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexEmbedderModelDimension,
					})}
				/>
				{formErrors.codebaseIndexEmbedderModelDimension && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexEmbedderModelDimension}
					</p>
				)}
			</div>
		</>
	)
}
