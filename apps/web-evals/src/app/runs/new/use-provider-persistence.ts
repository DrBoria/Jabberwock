"use client"

import { useEffect, useRef } from "react"
import type { UseFormSetValue, UseFormGetValues } from "react-hook-form"

import { getModelId } from "@jabberwock/types"
import {
	loadJabberwockLastModelSelection,
	saveJabberwockLastModelSelection,
} from "@/lib/jabberwock-last-model-selection"
import type { CreateRun } from "@/lib/schemas"
import type { ModelSelection, ConfigSelection, ImportedSettings, ProviderSource } from "./utils"

type ProviderPersistenceResult = {
	prevProvider: React.MutableRefObject<ProviderSource>
	modelSelectionsByProviderRef: React.MutableRefObject<Record<string, ModelSelection[]>>
	modelValueByProviderRef: React.MutableRefObject<Record<string, string>>
}

function getConfigDefaultModel(
	provider: ProviderSource,
	importedSettings: ImportedSettings | null,
	configSelections: ConfigSelection[],
): string {
	if (provider !== "other" || !importedSettings) return ""
	const configName = configSelections[0]?.configName
	if (!configName) return ""
	return getModelId(importedSettings.apiConfigs[configName] ?? {}) ?? ""
}

export function useProviderPersistence(
	provider: ProviderSource,
	modelSelections: ModelSelection[],
	setModelSelections: (selections: ModelSelection[]) => void,
	setValue: UseFormSetValue<CreateRun>,
	getValues: UseFormGetValues<CreateRun>,
	importedSettings: ImportedSettings | null,
	configSelections: ConfigSelection[],
	applyModelIds: (ids: string[]) => void,
	selectedModelIds: string[],
): ProviderPersistenceResult {
	const prevProvider = useRef(provider)
	const modelSelectionsByProviderRef = useRef<Record<string, ModelSelection[]>>({})
	const modelValueByProviderRef = useRef<Record<string, string>>({})

	useEffect(() => {
		if (provider === prevProvider.current) return
		modelSelectionsByProviderRef.current[prevProvider.current] = modelSelections
		modelValueByProviderRef.current[prevProvider.current] = getValues("model")
		const next = modelSelectionsByProviderRef.current[provider] ?? [
			{ id: crypto.randomUUID(), model: "", popoverOpen: false },
		]
		setModelSelections(next)
		const defaultModel = next.find((s) => s.model.trim().length > 0)?.model
		const saved = modelValueByProviderRef.current[provider]
		const configDefault = getConfigDefaultModel(provider, importedSettings, configSelections)
		setValue("model", saved ?? defaultModel ?? configDefault)
		prevProvider.current = provider
	}, [
		provider,
		prevProvider,
		modelSelections,
		setModelSelections,
		setValue,
		getValues,
		importedSettings,
		configSelections,
	])

	useEffect(() => {
		if (provider !== "jabberwock") return
		if (selectedModelIds.length > 0) return
		const last = loadJabberwockLastModelSelection()
		if (last.length > 0) applyModelIds(last)
	}, [applyModelIds, provider, selectedModelIds.length])

	useEffect(() => {
		if (provider !== "jabberwock") return
		saveJabberwockLastModelSelection(selectedModelIds)
	}, [provider, selectedModelIds])

	return { prevProvider, modelSelectionsByProviderRef, modelValueByProviderRef }
}
