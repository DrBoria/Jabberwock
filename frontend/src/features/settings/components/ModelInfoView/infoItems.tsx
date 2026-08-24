import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import type { ModelInfo } from "@jabberwock/types"
import { formatPrice } from "@src/utils/format/formatPrice"
import {
	hasValidContextWindow,
	hasValidMaxTokens,
	getSupportsImages,
	getSupportsPromptCache,
	hasCacheReadsPrice,
	hasCacheWritesPrice,
	getCacheReadsPriceOrDefault,
	getCacheWritesPriceOrDefault,
} from "./helpers"
import { ModelInfoSupportsItem } from "./ModelInfoSupportsItem"
import type { TFunc } from "./types"

export const getGeminiInfoItem = (
	apiProvider: string | undefined,
	selectedModelId: string,
	t: TFunc,
): React.ReactNode | null => {
	if (apiProvider !== "gemini") return null
	const isProPreview = selectedModelId.includes("pro-preview")
	const isFlash = selectedModelId.includes("flash")
	const geminiMessage = isProPreview
		? t("settings:modelInfo.gemini.billingEstimate")
		: t("settings:modelInfo.gemini.freeRequests", { count: isFlash ? 15 : 2 })
	return (
		<span className="italic" key="gemini-info">
			{geminiMessage}{" "}
			<VSCodeLink href="https://ai.google.dev/pricing" className="text-sm">
				{t("settings:modelInfo.gemini.pricingDetails")}
			</VSCodeLink>
		</span>
	)
}

export const getBaseInfoItems = (
	modelInfo: ModelInfo | undefined,
	apiProvider: string | undefined,
	selectedModelId: string,
	t: TFunc,
): React.ReactNode[] => {
	const items: React.ReactNode[] = []
	if (hasValidContextWindow(modelInfo)) {
		items.push(
			<>
				<span className="font-medium">{t("settings:modelInfo.contextWindow")}</span>{" "}
				{modelInfo?.contextWindow?.toLocaleString()} tokens
			</>,
		)
	}
	if (hasValidMaxTokens(modelInfo)) {
		items.push(
			<>
				<span className="font-medium">{t("settings:modelInfo.maxTokens")}</span>{" "}
				{modelInfo?.maxTokens?.toLocaleString()} tokens
			</>,
		)
	}
	const geminiItem = getGeminiInfoItem(apiProvider, selectedModelId, t)
	if (geminiItem) items.push(geminiItem)
	items.push(
		<ModelInfoSupportsItem
			key="supports-images"
			isSupported={getSupportsImages(modelInfo)}
			supportsLabel={t("settings:modelInfo.supportsImages")}
			doesNotSupportLabel={t("settings:modelInfo.doesNotSupportImages")}
		/>,
	)
	items.push(
		<ModelInfoSupportsItem
			key="supports-prompt-cache"
			isSupported={getSupportsPromptCache(modelInfo)}
			supportsLabel={t("settings:modelInfo.supportsPromptCache")}
			doesNotSupportLabel={t("settings:modelInfo.doesNotSupportPromptCache")}
		/>,
	)
	return items
}

export const getPriceInfoItems = (modelInfo: ModelInfo | undefined, t: TFunc): React.ReactNode[] => {
	const items: React.ReactNode[] = []
	const inputPrice = modelInfo?.inputPrice
	const outputPrice = modelInfo?.outputPrice
	if (inputPrice !== undefined) {
		items.push(
			<>
				<span className="font-medium">{t("settings:modelInfo.inputPrice")}:</span> {formatPrice(inputPrice)} /
				1M tokens
			</>,
		)
	}
	if (outputPrice !== undefined) {
		items.push(
			<>
				<span className="font-medium">{t("settings:modelInfo.outputPrice")}:</span> {formatPrice(outputPrice)} /
				1M tokens
			</>,
		)
	}
	if (hasCacheReadsPrice(modelInfo)) {
		items.push(
			<>
				<span className="font-medium">{t("settings:modelInfo.cacheReadsPrice")}:</span>{" "}
				{formatPrice(getCacheReadsPriceOrDefault(modelInfo))} / 1M tokens
			</>,
		)
	}
	if (hasCacheWritesPrice(modelInfo)) {
		items.push(
			<>
				<span className="font-medium">{t("settings:modelInfo.cacheWritesPrice")}:</span>{" "}
				{formatPrice(getCacheWritesPriceOrDefault(modelInfo))} / 1M tokens
			</>,
		)
	}
	return items
}
