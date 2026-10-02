import type { ProviderName } from "@jabberwock/types"
import type { ProviderRenderProps } from "./types"
import { Anthropic } from "@src/features/settings/components/providers/provider-components/major-cloud/Anthropic"
import { Baseten } from "@src/features/settings/components/providers/provider-components/gateway-proxy/Baseten"
import { Bedrock } from "@src/features/settings/components/providers/bedrock/main"
import { DeepSeek } from "@src/features/settings/components/providers/provider-components/chinese-api/DeepSeek"
import { Fireworks } from "@src/features/settings/components/providers/provider-components/other-openai-compatible/Fireworks"
import { Gemini } from "@src/features/settings/components/providers/provider-components/major-cloud/Gemini"
import { Jabberwock } from "@src/features/settings/components/providers/provider-components/self-hosted/Jabberwock"
import { LiteLLM } from "@src/features/settings/components/providers/LiteLLM/LiteLLMComponent"
import { LMStudio } from "@src/features/settings/components/providers/provider-components/self-hosted/LMStudio"
import { MiniMax } from "@src/features/settings/components/providers/provider-components/chinese-api/MiniMax"
import { Mistral } from "@src/features/settings/components/providers/provider-components/major-cloud/Mistral"
import { Moonshot } from "@src/features/settings/components/providers/provider-components/chinese-api/Moonshot"
import { Ollama } from "@src/features/settings/components/providers/provider-components/self-hosted/Ollama"
import { OpenAI } from "@src/features/settings/components/providers/provider-components/major-cloud/OpenAI"
import { OpenAICompatible } from "@src/features/settings/components/providers/openai-compatible/OpenAICompatible"
import { OpenAICodex } from "@src/features/settings/components/providers/openai-codex/main"
import { OpenRouter } from "@src/features/settings/components/providers/provider-components/gateway-proxy/OpenRouter"
import { QwenCode } from "@src/features/settings/components/providers/provider-components/chinese-api/QwenCode"
import { Requesty } from "@src/features/settings/components/providers/provider-components/gateway-proxy/Requesty"
import { SambaNova } from "@src/features/settings/components/providers/provider-components/other-openai-compatible/SambaNova"
import { Unbound } from "@src/features/settings/components/providers/provider-components/gateway-proxy/Unbound"
import { VercelAiGateway } from "@src/features/settings/components/providers/provider-components/gateway-proxy/VercelAiGateway"
import { Vertex } from "@src/features/settings/components/providers/provider-components/major-cloud/Vertex"
import { VSCodeLM } from "@src/features/settings/components/providers/provider-components/major-cloud/VSCodeLM"
import { XAI } from "@src/features/settings/components/providers/provider-components/other-openai-compatible/XAI"
import { ZAi } from "@src/features/settings/components/providers/provider-components/other-openai-compatible/ZAi"

export const providerRenderers: Partial<Record<ProviderName, (props: ProviderRenderProps) => React.ReactNode>> = {
	openrouter: (p) => (
		<OpenRouter
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			routerModels={p.routerModels}
			selectedModelId={p.selectedModelId}
			uriScheme={p.uriScheme}
			simplifySettings={p.simplifySettings}
			organizationAllowList={p.organizationAllowList}
			modelValidationError={p.modelValidationError}
		/>
	),
	requesty: (p) => (
		<Requesty
			uriScheme={p.uriScheme}
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			routerModels={p.routerModels}
			refetchRouterModels={p.refetchRouterModels}
			organizationAllowList={p.organizationAllowList}
			modelValidationError={p.modelValidationError}
			simplifySettings={p.simplifySettings}
		/>
	),
	unbound: (p) => (
		<Unbound
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			routerModels={p.routerModels}
			refetchRouterModels={p.refetchRouterModels}
			organizationAllowList={p.organizationAllowList}
			modelValidationError={p.modelValidationError}
			simplifySettings={p.simplifySettings}
		/>
	),
	anthropic: (p) => (
		<Anthropic
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			simplifySettings={p.simplifySettings}
		/>
	),
	"openai-codex": (p) => (
		<OpenAICodex
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			simplifySettings={p.simplifySettings}
			openAiCodexIsAuthenticated={p.openAiCodexIsAuthenticated}
		/>
	),
	"openai-native": (p) => (
		<OpenAI
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			selectedModelInfo={p.selectedModelInfo}
			simplifySettings={p.simplifySettings}
		/>
	),
	mistral: (p) => (
		<Mistral
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			simplifySettings={p.simplifySettings}
		/>
	),
	baseten: (p) => (
		<Baseten
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			simplifySettings={p.simplifySettings}
		/>
	),
	bedrock: (p) => (
		<Bedrock
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			selectedModelInfo={p.selectedModelInfo}
			simplifySettings={p.simplifySettings}
		/>
	),
	vertex: (p) => (
		<Vertex apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />
	),
	gemini: (p) => (
		<Gemini apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />
	),
	openai: (p) => (
		<OpenAICompatible
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			organizationAllowList={p.organizationAllowList}
			modelValidationError={p.modelValidationError}
			simplifySettings={p.simplifySettings}
		/>
	),
	lmstudio: (p) => (
		<LMStudio apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />
	),
	deepseek: (p) => (
		<DeepSeek
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			simplifySettings={p.simplifySettings}
		/>
	),
	"qwen-code": (p) => (
		<QwenCode
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			simplifySettings={p.simplifySettings}
		/>
	),
	moonshot: (p) => (
		<Moonshot
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			simplifySettings={p.simplifySettings}
		/>
	),
	minimax: (p) => (
		<MiniMax apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />
	),
	"vscode-lm": (p) => (
		<VSCodeLM apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />
	),
	ollama: (p) => (
		<Ollama apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />
	),
	xai: (p) => <XAI apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />,
	litellm: (p) => (
		<LiteLLM
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			organizationAllowList={p.organizationAllowList}
			modelValidationError={p.modelValidationError}
			simplifySettings={p.simplifySettings}
		/>
	),
	sambanova: (p) => (
		<SambaNova apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />
	),
	zai: (p) => <ZAi apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />,
	"vercel-ai-gateway": (p) => (
		<VercelAiGateway
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			routerModels={p.routerModels}
			organizationAllowList={p.organizationAllowList}
			modelValidationError={p.modelValidationError}
			simplifySettings={p.simplifySettings}
		/>
	),
	fireworks: (p) => (
		<Fireworks apiConfiguration={p.apiConfiguration} setApiConfigurationField={p.setApiConfigurationField} />
	),
	jabberwock: (p) => (
		<Jabberwock
			apiConfiguration={p.apiConfiguration}
			setApiConfigurationField={p.setApiConfigurationField}
			routerModels={p.routerModels}
			cloudIsAuthenticated={p.cloudIsAuthenticated}
			organizationAllowList={p.organizationAllowList}
			modelValidationError={p.modelValidationError}
			simplifySettings={p.simplifySettings}
		/>
	),
}
