import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { cn } from "@src/lib/utils"

import type { CodeIndexFormProps } from "../../code-index-popover-logic/code-index-popover-types"

export const OpenaiCompatibleSettingsForm = ({ currentSettings, formErrors, updateSetting, t }: CodeIndexFormProps) => {
	return (
		<>
			<div className="space-y-2">
				<label className="text-sm font-medium">{t("settings:codeIndex.openAiCompatibleBaseUrlLabel")}</label>
				<VSCodeTextField
					value={currentSettings.codebaseIndexOpenAiCompatibleBaseUrl || ""}
					onInput={(e) =>
						updateSetting("codebaseIndexOpenAiCompatibleBaseUrl", (e.target as HTMLInputElement).value)
					}
					placeholder={t("settings:codeIndex.openAiCompatibleBaseUrlPlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexOpenAiCompatibleBaseUrl,
					})}
				/>
				{formErrors.codebaseIndexOpenAiCompatibleBaseUrl && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexOpenAiCompatibleBaseUrl}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<label className="text-sm font-medium">{t("settings:codeIndex.openAiCompatibleApiKeyLabel")}</label>
				<VSCodeTextField
					type="password"
					value={currentSettings.codebaseIndexOpenAiCompatibleApiKey || ""}
					onInput={(e) =>
						updateSetting("codebaseIndexOpenAiCompatibleApiKey", (e.target as HTMLInputElement).value)
					}
					placeholder={t("settings:codeIndex.openAiCompatibleApiKeyPlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexOpenAiCompatibleApiKey,
					})}
				/>
				{formErrors.codebaseIndexOpenAiCompatibleApiKey && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexOpenAiCompatibleApiKey}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<label className="text-sm font-medium">{t("settings:codeIndex.modelLabel")}</label>
				<VSCodeTextField
					value={currentSettings.codebaseIndexEmbedderModelId || ""}
					onInput={(e) => updateSetting("codebaseIndexEmbedderModelId", (e.target as HTMLInputElement).value)}
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
