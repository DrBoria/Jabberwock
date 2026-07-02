"use client"

import { useCallback } from "react"
import { z } from "zod"
import { toast } from "sonner"

import { EVALS_SETTINGS, getModelId, globalSettingsSchema, providerSettingsSchema } from "@jabberwock/types"
import type { JabberwockSettings } from "@jabberwock/types"

import type { ModelSelection, ConfigSelection, ImportedSettings } from "./utils"

export function useNewRunSelections(
	modelSelections: ModelSelection[],
	setModelSelections: React.Dispatch<React.SetStateAction<ModelSelection[]>>,
	configSelections: ConfigSelection[],
	setConfigSelections: React.Dispatch<React.SetStateAction<ConfigSelection[]>>,
	importedSettings: ImportedSettings | null,
	setImportedSettings: React.Dispatch<React.SetStateAction<ImportedSettings | null>>,
	setValue: (name: "model" | "settings", value: string | JabberwockSettings | undefined) => void,
	clearErrors: (name?: "settings") => void,
) {
	const addModelSelection = useCallback(
		() => setModelSelections((prev) => [...prev, { id: crypto.randomUUID(), model: "", popoverOpen: false }]),
		[setModelSelections],
	)
	const removeModelSelection = useCallback(
		(id: string) => setModelSelections((prev) => prev.filter((s) => s.id !== id)),
		[setModelSelections],
	)
	const updateModelSelection = useCallback(
		(id: string, model: string) => {
			setModelSelections((prev) => prev.map((s) => (s.id === id ? { ...s, model, popoverOpen: false } : s)))
			setValue("model", model)
		},
		[setModelSelections, setValue],
	)
	const toggleModelPopover = useCallback(
		(id: string, open: boolean) =>
			setModelSelections((prev) => prev.map((s) => (s.id === id ? { ...s, popoverOpen: open } : s))),
		[setModelSelections],
	)

	const addConfigSelection = useCallback(
		() => setConfigSelections((prev) => [...prev, { id: crypto.randomUUID(), configName: "", popoverOpen: false }]),
		[setConfigSelections],
	)
	const removeConfigSelection = useCallback(
		(id: string) => setConfigSelections((prev) => prev.filter((s) => s.id !== id)),
		[setConfigSelections],
	)
	const updateConfigSelection = useCallback(
		(id: string, configName: string) => {
			setConfigSelections((prev) => prev.map((s) => (s.id === id ? { ...s, configName, popoverOpen: false } : s)))
			if (importedSettings) {
				const ps = importedSettings.apiConfigs[configName] ?? {}
				setValue("model", getModelId(ps) ?? "")
				setValue("settings", {
					...EVALS_SETTINGS,
					...ps,
					...importedSettings.globalSettings,
				} as JabberwockSettings)
			}
		},
		[importedSettings, setConfigSelections, setValue],
	)
	const toggleConfigPopover = useCallback(
		(id: string, open: boolean) =>
			setConfigSelections((prev) => prev.map((s) => (s.id === id ? { ...s, popoverOpen: open } : s))),
		[setConfigSelections],
	)

	const onImportSettings = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0]
			if (!file) return
			clearErrors("settings")
			try {
				const { providerProfiles, globalSettings } = z
					.object({
						providerProfiles: z.object({
							currentApiConfigName: z.string(),
							apiConfigs: z.record(z.string(), providerSettingsSchema),
						}),
						globalSettings: globalSettingsSchema,
					})
					.parse(JSON.parse(await file.text()))
				setImportedSettings({
					apiConfigs: providerProfiles.apiConfigs,
					globalSettings,
					currentApiConfigName: providerProfiles.currentApiConfigName,
				})
				const defaultConfigName = providerProfiles.currentApiConfigName
				setConfigSelections([{ id: crypto.randomUUID(), configName: defaultConfigName, popoverOpen: false }])
				const providerSettings = providerProfiles.apiConfigs[defaultConfigName] ?? {}
				setValue("model", getModelId(providerSettings) ?? "")
				setValue("settings", {
					...EVALS_SETTINGS,
					...providerSettings,
					...globalSettings,
				} as JabberwockSettings)
				event.target.value = ""
			} catch (e) {
				console.error(e)
				toast.error(e instanceof Error ? e.message : "An unknown error occurred.")
			}
		},
		[clearErrors, setValue, setImportedSettings, setConfigSelections],
	)

	return {
		addModelSelection,
		removeModelSelection,
		updateModelSelection,
		toggleModelPopover,
		addConfigSelection,
		removeConfigSelection,
		updateConfigSelection,
		toggleConfigPopover,
		onImportSettings,
	}
}
