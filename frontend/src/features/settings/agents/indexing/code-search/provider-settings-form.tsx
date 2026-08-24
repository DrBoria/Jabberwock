import type { EmbedderProvider } from "@jabberwock/types"

import { OpenaiSettingsForm } from "./code-index-provider-forms/openai/OpenaiSettingsForm"
import { OllamaSettingsForm } from "./code-index-provider-forms/providers/OllamaSettingsForm"
import { OpenaiCompatibleSettingsForm } from "./code-index-provider-forms/openai/OpenaiCompatibleSettingsForm"
import { GeminiSettingsForm } from "./code-index-provider-forms/providers/GeminiSettingsForm"
import { MistralSettingsForm } from "./code-index-provider-forms/providers/MistralSettingsForm"
import { VercelAiGatewaySettingsForm } from "./code-index-provider-forms/providers/VercelAiGatewaySettingsForm"
import { BedrockSettingsForm } from "./code-index-provider-forms/providers/BedrockSettingsForm"
import { OpenrouterSettingsForm } from "./code-index-provider-forms/providers/OpenrouterSettingsForm"

import type { CodeIndexFormProps } from "./code-index-popover-logic/code-index-popover-types"

interface ProviderSettingsFormProps extends CodeIndexFormProps {
	openRouterEmbeddingProviders?: Record<string, { label: string }>
}

const providerFormComponents: Record<
	EmbedderProvider,
	React.FC<CodeIndexFormProps & { openRouterEmbeddingProviders?: Record<string, { label: string }> }>
> = {
	openai: OpenaiSettingsForm,
	ollama: OllamaSettingsForm,
	"openai-compatible": OpenaiCompatibleSettingsForm,
	gemini: GeminiSettingsForm,
	mistral: MistralSettingsForm,
	"vercel-ai-gateway": VercelAiGatewaySettingsForm,
	bedrock: BedrockSettingsForm,
	openrouter: OpenrouterSettingsForm,
}

export const ProviderSettingsForm = ({
	currentSettings,
	formErrors,
	updateSetting,
	getAvailableModels,
	codebaseIndexModels,
	t,
	openRouterEmbeddingProviders,
}: ProviderSettingsFormProps) => {
	const FormComponent = providerFormComponents[currentSettings.codebaseIndexEmbedderProvider]

	return (
		<FormComponent
			currentSettings={currentSettings}
			formErrors={formErrors}
			updateSetting={updateSetting}
			getAvailableModels={getAvailableModels}
			codebaseIndexModels={codebaseIndexModels}
			t={t}
			openRouterEmbeddingProviders={openRouterEmbeddingProviders}
		/>
	)
}
