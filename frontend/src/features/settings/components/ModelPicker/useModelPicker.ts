import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import { useSelectedModel } from "@/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"
import { useEscapeKey } from "@src/hooks/escape-key/useEscapeKey"
import type { ProviderSettings, ModelInfo, OrganizationAllowList } from "@jabberwock/types"
import type { ModelIdKey, UseModelPickerState } from "./types"
import { getActiveProvider, getDisplayValue, getModelIds, cleanupTimeout } from "./helpers"

export function useModelPicker(
	defaultModelId: string,
	models: Record<string, ModelInfo> | null,
	modelIdKey: ModelIdKey,
	apiConfiguration: ProviderSettings,
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void,
	organizationAllowList: OrganizationAllowList | undefined,
	valueTransform: ((modelId: string) => unknown) | undefined,
	onModelChange: ((modelId: string) => void) | undefined,
	displayTransform: ((value: unknown) => string) | undefined,
): UseModelPickerState {
	const [open, setOpen] = useState(false)
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const isInitialized = useRef(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const selectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const { id: selectedModelId, info: selectedModelInfo } = useSelectedModel(apiConfiguration)
	const displayValue = useMemo(
		() => getDisplayValue(displayTransform, apiConfiguration, modelIdKey, selectedModelId),
		[displayTransform, apiConfiguration, modelIdKey, selectedModelId],
	)
	const activeProvider = useMemo(() => getActiveProvider(apiConfiguration), [apiConfiguration])
	const modelIds = useMemo(
		() => getModelIds(models, activeProvider, organizationAllowList, selectedModelId),
		[models, activeProvider, organizationAllowList, selectedModelId],
	)
	const onSelect = useCallback(
		(modelId: string) => {
			if (!modelId) return
			setOpen(false)
			const valueToStore = valueTransform ? valueTransform(modelId) : modelId
			setApiConfigurationField(modelIdKey, valueToStore as ProviderSettings[ModelIdKey])
			onModelChange?.(modelId)
			cleanupTimeout(selectTimeoutRef)
			selectTimeoutRef.current = setTimeout(() => setSearchValue(""), 100)
		},
		[modelIdKey, setApiConfigurationField, valueTransform, onModelChange],
	)
	const onOpenChange = useCallback((open: boolean) => {
		setOpen(open)
		if (!open) {
			cleanupTimeout(closeTimeoutRef)
			closeTimeoutRef.current = setTimeout(() => setSearchValue(""), 100)
		}
	}, [])
	const onClearSearch = useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])
	useEffect(() => {
		if (!selectedModelId && !isInitialized.current) {
			const initialValue = modelIds.includes(selectedModelId) ? selectedModelId : defaultModelId
			setApiConfigurationField(modelIdKey, initialValue, false)
		}
		isInitialized.current = true
	}, [modelIds, setApiConfigurationField, modelIdKey, selectedModelId, defaultModelId])
	useEffect(
		() => () => {
			cleanupTimeout(selectTimeoutRef)
			cleanupTimeout(closeTimeoutRef)
		},
		[],
	)
	useEscapeKey(open, () => setOpen(false))
	return {
		open,
		setOpen,
		searchValue,
		setSearchValue,
		isDescriptionExpanded,
		setIsDescriptionExpanded,
		selectedModelId,
		selectedModelInfo,
		displayValue,
		modelIds,
		onSelect,
		onOpenChange,
		onClearSearch,
	}
}
