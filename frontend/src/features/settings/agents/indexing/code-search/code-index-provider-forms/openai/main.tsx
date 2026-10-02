import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { cn } from "@src/lib/utils"

import { ModelDropdownField } from "@src/features/settings/agents/indexing/code-search/code-index-provider-forms/providers/model-dropdown-field"

import type { CodeIndexFormProps } from "@src/features/settings/agents/indexing/code-search/popover-logic/types"

export const OpenaiSettingsForm = ({
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
				<label className="text-sm font-medium">{t("settings:codeIndex.openAiKeyLabel")}</label>
				<VSCodeTextField
					type="password"
					value={currentSettings.codeIndexOpenAiKey || ""}
					onInput={(e) => updateSetting("codeIndexOpenAiKey", (e.target as HTMLInputElement).value)}
					placeholder={t("settings:codeIndex.openAiKeyPlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codeIndexOpenAiKey,
					})}
				/>
				{formErrors.codeIndexOpenAiKey && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">{formErrors.codeIndexOpenAiKey}</p>
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
