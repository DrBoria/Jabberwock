import { useState, useCallback, useMemo, useEffect } from "react"
import { useEvent } from "react-use"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, ExtensionMessage, ModelRecord } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useRouterModels } from "@src/features/foundation/ui/hooks/useModelProviders/useRouterModels"
import { rootStore } from "@src/features/store"

import { inputEventTransform } from "../../../shared/transforms"
import { ModelPicker } from "../../../ModelPicker/ModelPickerComponent"

type OllamaProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

function checkModelNotAvailable(
	apiConfiguration: ProviderSettings,
	ollamaModels: ModelRecord,
	routerModels: ReturnType<typeof useRouterModels>,
	t: ReturnType<typeof useAppTranslation>["t"],
): string | undefined {
	const selectedModel = apiConfiguration?.ollamaModelId
	if (!selectedModel) return undefined

	if (Object.keys(ollamaModels).length > 0 && selectedModel in ollamaModels) {
		return undefined
	}

	if (routerModels.data?.ollama && Object.keys(routerModels.data.ollama).length > 0) {
		const availableModels = Object.keys(routerModels.data.ollama)
		if (!availableModels.includes(selectedModel)) {
			return t("settings:validation.modelAvailability", { modelId: selectedModel })
		}
	}

	return undefined
}

export const Ollama = ({ apiConfiguration, setApiConfigurationField }: OllamaProps) => {
	const { t } = useAppTranslation()

	const [ollamaModels, setOllamaModels] = useState<ModelRecord>({})
	const routerModels = useRouterModels()

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(field: K, transform?: (event: E) => ProviderSettings[K]) =>
			(event: E | Event) => {
				setApiConfigurationField(
					field,
					transform
						? transform(event as E)
						: (inputEventTransform(event as { target: HTMLInputElement }) as ProviderSettings[K]),
				)
			},
		[setApiConfigurationField],
	)

	const onMessage = useCallback((event: MessageEvent) => {
		const message: ExtensionMessage = event.data

		if (message.type === "ollamaModels") {
			const newModels = message.ollamaModels ?? {}
			setOllamaModels(newModels)
		}
	}, [])

	useEvent("message", onMessage)

	useEffect(() => {
		rootStore.settings.requestOllamaModels()
	}, [])

	const modelNotAvailableError = useMemo(
		() => checkModelNotAvailable(apiConfiguration, ollamaModels, routerModels, t),
		[apiConfiguration, ollamaModels, routerModels, t],
	)

	const ollamaBaseUrl = apiConfiguration?.ollamaBaseUrl
	const ollamaApiKey = apiConfiguration?.ollamaApiKey
	const ollamaNumCtx = apiConfiguration?.ollamaNumCtx

	const handleNumCtxChange = useCallback(
		(e: { target: EventTarget | null }) => {
			const rawValue = (e.target as HTMLInputElement)?.value
			if (rawValue === "") {
				setApiConfigurationField("ollamaNumCtx", undefined)
			} else {
				const numValue = parseInt(rawValue, 10)
				if (!isNaN(numValue) && numValue >= 128) {
					setApiConfigurationField("ollamaNumCtx", numValue)
				}
			}
		},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={ollamaBaseUrl || ""}
				type="url"
				onInput={handleInputChange("ollamaBaseUrl")}
				placeholder={t("settings:defaults.ollamaUrl")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.ollama.baseUrl")}</label>
			</VSCodeTextField>
			{ollamaBaseUrl && (
				<VSCodeTextField
					value={ollamaApiKey || ""}
					type="password"
					onInput={handleInputChange("ollamaApiKey")}
					placeholder={t("settings:placeholders.apiKey")}
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.ollama.apiKey")}</label>
					<div className="text-xs text-vscode-descriptionForeground mt-1">
						{t("settings:providers.ollama.apiKeyHelp")}
					</div>
				</VSCodeTextField>
			)}
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId=""
				models={ollamaModels}
				modelIdKey="ollamaModelId"
				serviceName="Ollama"
				serviceUrl="https://ollama.ai"
				errorMessage={modelNotAvailableError}
				hidePricing
			/>
			<VSCodeTextField
				value={ollamaNumCtx?.toString() || ""}
				onInput={handleNumCtxChange}
				placeholder="e.g., 4096"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.ollama.numCtx")}</label>
				<div className="text-xs text-vscode-descriptionForeground mt-1">
					{t("settings:providers.ollama.numCtxHelp")}
				</div>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground">
				{t("settings:providers.ollama.description")}
				<span className="text-vscode-errorForeground ml-1">{t("settings:providers.ollama.warning")}</span>
			</div>
		</>
	)
}
