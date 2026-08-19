"use client"

import type { JabberwockSettings } from "@jabberwock/types"

import { FormField, FormItem, FormMessage, Tabs, TabsList, TabsTrigger } from "@/components/ui"

import type { ModelSelection, ConfigSelection, ImportedSettings, ProviderSource } from "../utils"
import type { UseFormReturn } from "react-hook-form"
import type { CreateRun } from "@/lib/schemas"
import { ImportProviderSection } from "./new-run-model-import"
import { ModelPickerSection } from "./new-run-model-picker"

type ModelSelectSectionProps = {
	form: UseFormReturn<CreateRun>
	provider: ProviderSource
	setModelSource: (value: ProviderSource) => void
	importedSettings: ImportedSettings | null
	configSelections: ConfigSelection[]
	modelSelections: ModelSelection[]
	models: Array<{ id: string; name: string }> | undefined
	searchValue: string
	onFilter: ((value: string, search: string) => number) | undefined
	onImportSettings: (event: React.ChangeEvent<HTMLInputElement>) => void
	toggleConfigPopover: (id: string, open: boolean) => void
	updateConfigSelection: (id: string, configName: string) => void
	addConfigSelection: () => void
	removeConfigSelection: (id: string) => void
	toggleModelPopover: (id: string, open: boolean) => void
	updateModelSelection: (id: string, model: string) => void
	addModelSelection: () => void
	removeModelSelection: (id: string) => void
	setSearchValue: (value: string) => void
	settings: JabberwockSettings | undefined
}

export function NewRunModelSection({
	form,
	provider,
	setModelSource,
	importedSettings,
	configSelections,
	modelSelections,
	models,
	searchValue,
	onFilter,
	onImportSettings,
	toggleConfigPopover,
	updateConfigSelection,
	addConfigSelection,
	removeConfigSelection,
	toggleModelPopover,
	updateModelSelection,
	addModelSelection,
	removeModelSelection,
	setSearchValue,
	settings,
}: ModelSelectSectionProps) {
	return (
		<FormField
			control={form.control}
			name="model"
			render={() => (
				<FormItem>
					<Tabs value={provider} onValueChange={(value) => setModelSource(value as ProviderSource)}>
						<TabsList className="mb-2">
							<TabsTrigger value="other">Import</TabsTrigger>
							<TabsTrigger value="jabberwock">Jabberwock Cloud</TabsTrigger>
							<TabsTrigger value="openrouter">OpenRouter</TabsTrigger>
						</TabsList>
					</Tabs>
					{provider === "other" ? (
						<ImportProviderSection
							importedSettings={importedSettings}
							configSelections={configSelections}
							onImportSettings={onImportSettings}
							toggleConfigPopover={toggleConfigPopover}
							updateConfigSelection={updateConfigSelection}
							addConfigSelection={addConfigSelection}
							removeConfigSelection={removeConfigSelection}
							settings={settings}
						/>
					) : (
						<ModelPickerSection
							modelSelections={modelSelections}
							models={models}
							searchValue={searchValue}
							onFilter={onFilter}
							setSearchValue={setSearchValue}
							toggleModelPopover={toggleModelPopover}
							updateModelSelection={updateModelSelection}
							addModelSelection={addModelSelection}
							removeModelSelection={removeModelSelection}
						/>
					)}
					<FormMessage />
				</FormItem>
			)}
		/>
	)
}
