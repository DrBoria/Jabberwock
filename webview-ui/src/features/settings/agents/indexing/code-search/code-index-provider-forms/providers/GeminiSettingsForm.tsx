import { VSCodeTextField, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"

import { cn } from "@src/lib/utils"

import type { CodeIndexFormProps } from "../../code-index-popover-logic/code-index-popover-types"

export const GeminiSettingsForm = ({
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
				<label className="text-sm font-medium">{t("settings:codeIndex.geminiApiKeyLabel")}</label>
				<VSCodeTextField
					type="password"
					value={currentSettings.codebaseIndexGeminiApiKey || ""}
					onInput={(e) => updateSetting("codebaseIndexGeminiApiKey", (e.target as HTMLInputElement).value)}
					placeholder={t("settings:codeIndex.geminiApiKeyPlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexGeminiApiKey,
					})}
				/>
				{formErrors.codebaseIndexGeminiApiKey && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexGeminiApiKey}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<label className="text-sm font-medium">{t("settings:codeIndex.modelLabel")}</label>
				<VSCodeDropdown
					value={currentSettings.codebaseIndexEmbedderModelId}
					onChange={(e) =>
						updateSetting("codebaseIndexEmbedderModelId", (e.target as HTMLInputElement).value)
					}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexEmbedderModelId,
					})}>
					<VSCodeOption value="" className="p-2">
						{t("settings:codeIndex.selectModel")}
					</VSCodeOption>
					{getAvailableModels().map((modelId) => {
						const model =
							codebaseIndexModels?.[
								currentSettings.codebaseIndexEmbedderProvider as keyof typeof codebaseIndexModels
							]?.[modelId]
						return (
							<VSCodeOption key={modelId} value={modelId} className="p-2">
								{modelId}{" "}
								{model
									? t("settings:codeIndex.modelDimensions", {
											dimension: model.dimension,
										})
									: ""}
							</VSCodeOption>
						)
					})}
				</VSCodeDropdown>
				{formErrors.codebaseIndexEmbedderModelId && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexEmbedderModelId}
					</p>
				)}
			</div>
		</>
	)
}
