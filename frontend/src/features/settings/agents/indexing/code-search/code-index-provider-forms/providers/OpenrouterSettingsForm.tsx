import { VSCodeTextField, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"

import { cn } from "@src/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { OPENROUTER_DEFAULT_PROVIDER_NAME } from "@jabberwock/types"

import type { CodeIndexFormProps } from "../../code-index-popover-logic/code-index-popover-types"

interface OpenrouterSettingsFormProps extends CodeIndexFormProps {
	openRouterEmbeddingProviders?: Record<string, { label: string }>
}

export const OpenrouterSettingsForm = ({
	currentSettings,
	formErrors,
	updateSetting,
	getAvailableModels,
	codebaseIndexModels,
	t,
	openRouterEmbeddingProviders,
}: OpenrouterSettingsFormProps) => {
	return (
		<>
			<div className="space-y-2">
				<label className="text-sm font-medium">{t("settings:codeIndex.openRouterApiKeyLabel")}</label>
				<VSCodeTextField
					type="password"
					value={currentSettings.codebaseIndexOpenRouterApiKey || ""}
					onInput={(e) =>
						updateSetting("codebaseIndexOpenRouterApiKey", (e.target as HTMLInputElement).value)
					}
					placeholder={t("settings:codeIndex.openRouterApiKeyPlaceholder")}
					className={cn("w-full", {
						"border-red-500": formErrors.codebaseIndexOpenRouterApiKey,
					})}
				/>
				{formErrors.codebaseIndexOpenRouterApiKey && (
					<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
						{formErrors.codebaseIndexOpenRouterApiKey}
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

			{/* Provider Routing for OpenRouter */}
			{openRouterEmbeddingProviders && Object.keys(openRouterEmbeddingProviders).length > 0 && (
				<div className="space-y-2">
					<label className="text-sm font-medium">
						<a
							href="https://openrouter.ai/docs/features/provider-routing"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1 hover:underline">
							{t("settings:codeIndex.openRouterProviderRoutingLabel")}
							<span className="codicon codicon-link-external text-xs" />
						</a>
					</label>
					<Select
						value={
							currentSettings.codebaseIndexOpenRouterSpecificProvider || OPENROUTER_DEFAULT_PROVIDER_NAME
						}
						onValueChange={(value) => updateSetting("codebaseIndexOpenRouterSpecificProvider", value)}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={OPENROUTER_DEFAULT_PROVIDER_NAME}>
								{OPENROUTER_DEFAULT_PROVIDER_NAME}
							</SelectItem>
							{Object.entries(openRouterEmbeddingProviders).map(([value, { label }]) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-xs text-vscode-descriptionForeground mt-1 mb-0">
						{t("settings:codeIndex.openRouterProviderRoutingDescription")}
					</p>
				</div>
			)}
		</>
	)
}
