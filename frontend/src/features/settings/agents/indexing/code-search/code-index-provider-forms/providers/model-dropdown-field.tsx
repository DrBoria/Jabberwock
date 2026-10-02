import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"

import { cn } from "@src/lib/utils"

import type { EmbeddingModelProfiles, EmbedderProvider } from "@jabberwock/types"
import type { LocalCodeIndexSettings } from "@src/features/settings/agents/indexing/code-search/popover-logic/types"

type UpdateSetting = (key: keyof LocalCodeIndexSettings, value: unknown) => void

export const handleModelIdInput = (updateSetting: UpdateSetting) => (e: Event | React.FormEvent) =>
	updateSetting("codebaseIndexEmbedderModelId", (e.target as HTMLInputElement).value)

interface ModelDropdownFieldProps {
	value: string
	error?: string
	getAvailableModels: () => string[]
	codebaseIndexModels: EmbeddingModelProfiles | undefined
	embedderProvider: EmbedderProvider
	updateSetting: (key: keyof LocalCodeIndexSettings, value: unknown) => void
	t: (key: string, options?: Record<string, unknown>) => string
}

export const ModelDropdownField = ({
	value,
	error,
	getAvailableModels,
	codebaseIndexModels,
	embedderProvider,
	updateSetting,
	t,
}: ModelDropdownFieldProps) => (
	<div className="space-y-2">
		<label className="text-sm font-medium">{t("settings:codeIndex.modelLabel")}</label>
		<VSCodeDropdown
			value={value}
			onChange={handleModelIdInput(updateSetting)}
			className={cn("w-full", {
				"border-red-500": error,
			})}>
			<VSCodeOption value="" className="p-2">
				{t("settings:codeIndex.selectModel")}
			</VSCodeOption>
			{getAvailableModels().map((modelId) => {
				const model = codebaseIndexModels?.[embedderProvider as keyof typeof codebaseIndexModels]?.[modelId]
				return (
					<VSCodeOption key={modelId} value={modelId} className="p-2">
						{modelId} {model ? t("settings:codeIndex.modelDimensions", { dimension: model.dimension }) : ""}
					</VSCodeOption>
				)
			})}
		</VSCodeDropdown>
		{error && <p className="text-xs text-vscode-errorForeground mt-1 mb-0">{error}</p>}
	</div>
)
