import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { cn } from "@src/lib/utils"

import { ProviderSettingsForm } from "../provider-settings-form"
import { DEFAULT_QDRANT_URL } from "../code-index-popover-logic/code-index-popover-constants"
import type { LocalCodeIndexSettings } from "../code-index-popover-logic/code-index-popover-types"
import type { EmbeddingModelProfiles } from "@jabberwock/types"

interface SetupConfigSectionProps {
	isSetupSettingsOpen: boolean
	setIsSetupSettingsOpen: (open: boolean) => void
	currentSettings: LocalCodeIndexSettings
	formErrors: Record<string, string>
	updateSetting: (key: keyof LocalCodeIndexSettings, value: unknown) => void
	handleProviderChange: (value: string) => void
	getAvailableModels: () => string[]
	codebaseIndexModels: EmbeddingModelProfiles | undefined
	openRouterEmbeddingProviders: Record<string, { label: string }> | undefined
	t: (key: string, options?: Record<string, unknown>) => string
}

export const SetupConfigSection = ({
	isSetupSettingsOpen,
	setIsSetupSettingsOpen,
	currentSettings,
	formErrors,
	updateSetting,
	handleProviderChange,
	getAvailableModels,
	codebaseIndexModels,
	openRouterEmbeddingProviders,
	t,
}: SetupConfigSectionProps) => (
	<div className="mt-4">
		<button
			onClick={() => setIsSetupSettingsOpen(!isSetupSettingsOpen)}
			className="flex items-center text-xs text-vscode-foreground hover:text-vscode-textLink-foreground focus:outline-none"
			aria-expanded={isSetupSettingsOpen}>
			<span className={`codicon codicon-${isSetupSettingsOpen ? "chevron-down" : "chevron-right"} mr-1`} />
			<span className="text-base font-semibold">{t("settings:codeIndex.setupConfigLabel")}</span>
		</button>
		{isSetupSettingsOpen && (
			<div className="mt-4 space-y-4">
				<div className="space-y-2">
					<label className="text-sm font-medium">{t("settings:codeIndex.embedderProviderLabel")}</label>
					<Select value={currentSettings.codebaseIndexEmbedderProvider} onValueChange={handleProviderChange}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="openai">{t("settings:codeIndex.openaiProvider")}</SelectItem>
							<SelectItem value="ollama">{t("settings:codeIndex.ollamaProvider")}</SelectItem>
							<SelectItem value="openai-compatible">
								{t("settings:codeIndex.openaiCompatibleProvider")}
							</SelectItem>
							<SelectItem value="gemini">{t("settings:codeIndex.geminiProvider")}</SelectItem>
							<SelectItem value="mistral">{t("settings:codeIndex.mistralProvider")}</SelectItem>
							<SelectItem value="vercel-ai-gateway">
								{t("settings:codeIndex.vercelAiGatewayProvider")}
							</SelectItem>
							<SelectItem value="bedrock">{t("settings:codeIndex.bedrockProvider")}</SelectItem>
							<SelectItem value="openrouter">{t("settings:codeIndex.openRouterProvider")}</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<ProviderSettingsForm
					currentSettings={currentSettings}
					formErrors={formErrors}
					updateSetting={updateSetting}
					getAvailableModels={getAvailableModels}
					codebaseIndexModels={codebaseIndexModels}
					t={t}
					openRouterEmbeddingProviders={openRouterEmbeddingProviders}
				/>
				<div className="space-y-2">
					<label className="text-sm font-medium">{t("settings:codeIndex.qdrantUrlLabel")}</label>
					<VSCodeTextField
						value={currentSettings.codebaseIndexQdrantUrl || ""}
						onInput={(e) => updateSetting("codebaseIndexQdrantUrl", (e.target as HTMLInputElement).value)}
						onBlur={(e) => {
							if (!(e.target as HTMLInputElement).value.trim())
								updateSetting("codebaseIndexQdrantUrl", DEFAULT_QDRANT_URL)
						}}
						placeholder={t("settings:codeIndex.qdrantUrlPlaceholder")}
						className={cn("w-full", {
							"border-red-500": formErrors.codebaseIndexQdrantUrl,
						})}
					/>
					{formErrors.codebaseIndexQdrantUrl && (
						<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
							{formErrors.codebaseIndexQdrantUrl}
						</p>
					)}
				</div>
				<div className="space-y-2">
					<label className="text-sm font-medium">{t("settings:codeIndex.qdrantApiKeyLabel")}</label>
					<VSCodeTextField
						type="password"
						value={currentSettings.codeIndexQdrantApiKey || ""}
						onInput={(e) => updateSetting("codeIndexQdrantApiKey", (e.target as HTMLInputElement).value)}
						placeholder={t("settings:codeIndex.qdrantApiKeyPlaceholder")}
						className={cn("w-full", {
							"border-red-500": formErrors.codeIndexQdrantApiKey,
						})}
					/>
					{formErrors.codeIndexQdrantApiKey && (
						<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
							{formErrors.codeIndexQdrantApiKey}
						</p>
					)}
				</div>
			</div>
		)}
	</div>
)
