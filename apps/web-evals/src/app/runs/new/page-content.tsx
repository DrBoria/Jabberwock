"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { createRunSchema, CONCURRENCY_DEFAULT, TIMEOUT_DEFAULT, ITERATIONS_DEFAULT } from "@/lib/schemas"
import type { CreateRun, ExecutionMethod } from "@/lib/schemas"
import { getExercises } from "@/actions/exercises"
import { useOpenRouterModels } from "@/hooks/use-open-router-models"
import { useJabberwockCloudModels } from "@/hooks/use-jabberwock-cloud-models"

import type { ModelSelection, ConfigSelection, ImportedSettings, ProviderSource } from "./utils"
import { useProviderPersistence } from "./use-provider-persistence"
import { useNewRunSelections } from "./use-new-run-selections"
import { NewRunModelSection } from "./components/new-run-model-section"
import { NewRunExerciseSection } from "./components/new-run-exercise-section"
import { NewRunSliderSection, TerminalTimeoutSection } from "./components/new-run-timeout-section"
import {
	CloudTokenSection,
	ExecutionMethodSection,
	DescriptionSection,
	SubmitButton,
	CloseButton,
} from "./components/new-run-form-sections"
import { useModelIdsSync, useLocalStorageInit, useNewRunSubmit } from "./components/use-new-run-init"

export function NewRun() {
	const router = useRouter()
	const [provider, setModelSource] = useState<ProviderSource>("other")
	const [commandExecutionTimeout, setCommandExecutionTimeout] = useState(20)
	const [terminalShellIntegrationTimeout, setTerminalShellIntegrationTimeout] = useState(30)
	const [modelSelections, setModelSelections] = useState<ModelSelection[]>([
		{ id: crypto.randomUUID(), model: "", popoverOpen: false },
	])
	const [importedSettings, setImportedSettings] = useState<ImportedSettings | null>(null)
	const [configSelections, setConfigSelections] = useState<ConfigSelection[]>([
		{ id: crypto.randomUUID(), configName: "", popoverOpen: false },
	])
	const [selectedExercises, setSelectedExercises] = useState<string[]>([])
	const [executionMethod, setExecutionMethod] = useState<ExecutionMethod>("vscode")

	const openRouter = useOpenRouterModels()
	const jabberwockCloud = useJabberwockCloudModels()
	const models = provider === "openrouter" ? openRouter.data : jabberwockCloud.data
	const searchValue = provider === "openrouter" ? openRouter.searchValue : jabberwockCloud.searchValue
	const setSearchValue = provider === "openrouter" ? openRouter.setSearchValue : jabberwockCloud.setSearchValue
	const onFilter = provider === "openrouter" ? openRouter.onFilter : jabberwockCloud.onFilter
	const exercises = useQuery({ queryKey: ["getExercises"], queryFn: () => getExercises() })

	const form = useForm<CreateRun>({
		resolver: zodResolver(createRunSchema),
		defaultValues: {
			model: "",
			description: "",
			suite: "full",
			exercises: [],
			settings: undefined,
			concurrency: CONCURRENCY_DEFAULT,
			timeout: TIMEOUT_DEFAULT,
			iterations: ITERATIONS_DEFAULT,
			jobToken: "",
			executionMethod: "vscode",
		},
	})
	const {
		register,
		setValue,
		clearErrors,
		watch,
		getValues,
		formState: { isSubmitting },
	} = form
	const [suite] = watch(["suite"])
	const settings = watch("settings")

	useEffect(() => {
		register("exercises")
	}, [register])

	const { selectedModelIds, applyModelIds } = useModelIdsSync(modelSelections, setModelSelections, setValue)

	useLocalStorageInit(
		setValue as (
			name: "concurrency" | "timeout" | "suite" | "exercises",
			value: number | string | string[],
		) => void,
		setCommandExecutionTimeout,
		setTerminalShellIntegrationTimeout,
		setSelectedExercises,
	)

	useProviderPersistence(
		provider,
		modelSelections,
		setModelSelections,
		setValue,
		getValues,
		importedSettings,
		configSelections,
		applyModelIds,
		selectedModelIds,
	)

	const {
		addModelSelection,
		removeModelSelection,
		updateModelSelection,
		toggleModelPopover,
		addConfigSelection,
		removeConfigSelection,
		updateConfigSelection,
		toggleConfigPopover,
		onImportSettings,
	} = useNewRunSelections(
		modelSelections,
		setModelSelections,
		configSelections,
		setConfigSelections,
		importedSettings,
		setImportedSettings,
		setValue,
		clearErrors,
	)

	const onSubmit = useNewRunSubmit(
		suite,
		selectedExercises,
		provider,
		modelSelections,
		configSelections,
		importedSettings,
		commandExecutionTimeout,
		terminalShellIntegrationTimeout,
		router,
	)

	return (
		<>
			<FormProvider {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="flex flex-col justify-center divide-y divide-primary *:py-5">
					<NewRunModelSection
						form={form}
						provider={provider}
						setModelSource={setModelSource}
						importedSettings={importedSettings}
						configSelections={configSelections}
						modelSelections={modelSelections}
						models={models}
						searchValue={searchValue}
						onFilter={onFilter}
						onImportSettings={onImportSettings}
						toggleConfigPopover={toggleConfigPopover}
						updateConfigSelection={updateConfigSelection}
						addConfigSelection={addConfigSelection}
						removeConfigSelection={removeConfigSelection}
						toggleModelPopover={toggleModelPopover}
						updateModelSelection={updateModelSelection}
						addModelSelection={addModelSelection}
						removeModelSelection={removeModelSelection}
						setSearchValue={setSearchValue}
						settings={settings}
					/>
					{provider === "jabberwock" && <CloudTokenSection form={form} />}
					<NewRunExerciseSection
						form={form}
						exercisesData={exercises.data}
						selectedExercises={selectedExercises}
						setSelectedExercises={setSelectedExercises}
						suite={suite}
						setValue={setValue as (name: "suite" | "exercises", value: string | string[]) => void}
					/>
					<NewRunSliderSection form={form} />
					<TerminalTimeoutSection
						commandExecutionTimeout={commandExecutionTimeout}
						setCommandExecutionTimeout={setCommandExecutionTimeout}
						terminalShellIntegrationTimeout={terminalShellIntegrationTimeout}
						setTerminalShellIntegrationTimeout={setTerminalShellIntegrationTimeout}
					/>
					<ExecutionMethodSection
						executionMethod={executionMethod}
						setExecutionMethod={setExecutionMethod}
						form={form}
					/>
					<DescriptionSection form={form} />
					<SubmitButton isSubmitting={isSubmitting} />
				</form>
			</FormProvider>
			<CloseButton />
		</>
	)
}
