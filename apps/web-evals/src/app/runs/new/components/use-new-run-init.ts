"use client"

import { useCallback, useEffect, useMemo } from "react"
import { toast } from "sonner"

import { normalizeCreateRunForSubmit } from "@/lib/normalize-create-run"
import type { CreateRun } from "@/lib/schemas"
import type { ModelSelection, ConfigSelection, ImportedSettings, ProviderSource } from "../utils"
import { buildSelectionsToLaunch, launchRuns } from "../utils"

export function useModelIdsSync(
	modelSelections: ModelSelection[],
	setModelSelections: (selections: ModelSelection[]) => void,
	setValue: (name: "model", value: string) => void,
) {
	const selectedModelIds = useMemo(
		() => modelSelections.map((s) => s.model).filter((m) => m.length > 0),
		[modelSelections],
	)

	const applyModelIds = useCallback(
		(modelIds: string[]) => {
			const unique = Array.from(new Set(modelIds.map((m) => m.trim()).filter((m) => m.length > 0)))
			if (unique.length === 0) {
				setModelSelections([{ id: crypto.randomUUID(), model: "", popoverOpen: false }])
				setValue("model", "")
				return
			}
			setModelSelections(unique.map((model) => ({ id: crypto.randomUUID(), model, popoverOpen: false })))
			setValue("model", unique[0] ?? "")
		},
		[setValue, setModelSelections],
	)

	return { selectedModelIds, applyModelIds }
}

export function useLocalStorageInit(
	setValue: (name: "concurrency" | "timeout" | "suite" | "exercises", value: number | string | string[]) => void,
	setCommandExecutionTimeout: (value: number) => void,
	setTerminalShellIntegrationTimeout: (value: number) => void,
	setSelectedExercises: (exercises: string[]) => void,
) {
	useEffect(() => {
		const saved = localStorage.getItem("evals-concurrency")
		if (saved) {
			const parsed = parseInt(saved, 10)
			if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) setValue("concurrency", parsed)
		}
	}, [setValue])

	useEffect(() => {
		const saved = localStorage.getItem("evals-timeout")
		if (saved) {
			const parsed = parseInt(saved, 10)
			if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) setValue("timeout", parsed)
		}
	}, [setValue])

	useEffect(() => {
		const saved = localStorage.getItem("evals-command-execution-timeout")
		if (saved) {
			const parsed = parseInt(saved, 10)
			if (!isNaN(parsed) && parsed >= 20 && parsed <= 60) setCommandExecutionTimeout(parsed)
		}
	}, [setCommandExecutionTimeout])

	useEffect(() => {
		const saved = localStorage.getItem("evals-shell-integration-timeout")
		if (saved) {
			const parsed = parseInt(saved, 10)
			if (!isNaN(parsed) && parsed >= 30 && parsed <= 60) setTerminalShellIntegrationTimeout(parsed)
		}
	}, [setTerminalShellIntegrationTimeout])

	useEffect(() => {
		const savedSuite = localStorage.getItem("evals-suite")
		if (savedSuite === "partial") {
			setValue("suite", "partial")
			const savedExercises = localStorage.getItem("evals-exercises")
			if (savedExercises) {
				try {
					const parsed = JSON.parse(savedExercises) as string[]
					if (Array.isArray(parsed)) {
						setSelectedExercises(parsed)
						setValue("exercises", parsed)
					}
				} catch {
					/* ignore */
				}
			}
		}
	}, [setValue, setSelectedExercises])
}

export function useNewRunSubmit(
	suite: CreateRun["suite"],
	selectedExercises: string[],
	provider: ProviderSource,
	modelSelections: ModelSelection[],
	configSelections: ConfigSelection[],
	importedSettings: ImportedSettings | null,
	commandExecutionTimeout: number,
	terminalShellIntegrationTimeout: number,
	router: { push: (url: string) => void },
) {
	return useCallback(
		async (values: CreateRun) => {
			try {
				const baseValues = normalizeCreateRunForSubmit(values, selectedExercises, suite)
				if (provider === "jabberwock" && !baseValues.jobToken?.trim()) {
					toast.error("Jabberwock Cloud Token is required")
					return
				}
				const selections = buildSelectionsToLaunch(provider, configSelections, modelSelections)
				if (selections.length === 0) {
					toast.error("Please select at least one model or config")
					return
				}
				await launchRuns(
					selections,
					provider,
					baseValues,
					importedSettings,
					commandExecutionTimeout,
					terminalShellIntegrationTimeout,
					() => router.push("/"),
				)
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "An unknown error occurred.")
			}
		},
		[
			suite,
			selectedExercises,
			provider,
			modelSelections,
			configSelections,
			importedSettings,
			router,
			commandExecutionTimeout,
			terminalShellIntegrationTimeout,
		],
	)
}
