import type { ChartConfig } from "./context"

// Helper to extract label key from payload for config lookup.
export function getPayloadConfigLabelKey(payload: unknown, payloadPayload: unknown, key: string): string {
	if (typeof payload === "object" && payload !== null && key in payload) {
		const value = (payload as Record<string, unknown>)[key]
		if (typeof value === "string") return value
	}

	if (typeof payloadPayload === "object" && payloadPayload !== null && key in payloadPayload) {
		const value = (payloadPayload as Record<string, unknown>)[key]
		if (typeof value === "string") return value
	}

	return key
}

// Helper to extract item config from a payload.
export function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
	if (typeof payload !== "object" || payload === null) {
		return undefined
	}

	const payloadPayload =
		"payload" in payload && typeof payload.payload === "object" && payload.payload !== null
			? payload.payload
			: undefined

	const configLabelKey = getPayloadConfigLabelKey(payload, payloadPayload, key)

	return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config]
}

// Helper to compute tooltip label value.
export function computeTooltipLabelValue(
	config: ChartConfig,
	payload: unknown[],
	label: React.ReactNode,
	labelKey?: string,
): React.ReactNode {
	if (!payload?.length) return null

	const [item] = payload
	const typedItem = item as { dataKey?: string; name?: string }
	const key = `${getFirstString(labelKey, typedItem.dataKey, typedItem.name, "value")}`
	const itemConfig = getPayloadConfigFromPayload(config, item, key)

	if (!labelKey && typeof label === "string") {
		const configLabel = config[label as keyof typeof config]?.label
		return configLabel || label
	}

	return itemConfig?.label
}

export function getFirstString(...values: (string | undefined | null)[]): string {
	for (const value of values) {
		if (value) return value
	}
	return "value"
}
