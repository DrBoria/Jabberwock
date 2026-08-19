"use client"

import { useCallback } from "react"

import {
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Tabs,
	TabsList,
	TabsTrigger,
	MultiSelect,
	Button,
} from "@/components/ui"

import type { UseFormReturn } from "react-hook-form"
import type { CreateRun } from "@/lib/schemas"

function getLanguages(exercises: string[] | undefined): string[] {
	if (!exercises) return []
	const langs = new Set<string>()
	for (const path of exercises) {
		const lang = path.split("/")[0]
		if (lang) langs.add(lang)
	}
	return Array.from(langs).sort()
}

export function NewRunExerciseSection({
	form,
	exercisesData,
	selectedExercises,
	setSelectedExercises,
	suite,
	setValue,
}: {
	form: UseFormReturn<CreateRun>
	exercisesData: string[] | undefined
	selectedExercises: string[]
	setSelectedExercises: React.Dispatch<React.SetStateAction<string[]>>
	suite: string
	setValue: (name: "suite" | "exercises", value: string | string[]) => void
}) {
	const languages = getLanguages(exercisesData)

	const getExercisesForLanguage = useCallback(
		(lang: string) => {
			if (!exercisesData) return []
			return exercisesData.filter((path) => path.startsWith(`${lang}/`))
		},
		[exercisesData],
	)

	const isLanguageSelected = useCallback(
		(lang: string) => {
			const langExercises = getExercisesForLanguage(lang)
			return langExercises.length > 0 && langExercises.every((ex) => selectedExercises.includes(ex))
		},
		[getExercisesForLanguage, selectedExercises],
	)

	const isLanguagePartiallySelected = useCallback(
		(lang: string) => {
			const langExercises = getExercisesForLanguage(lang)
			const selectedCount = langExercises.filter((ex) => selectedExercises.includes(ex)).length
			return selectedCount > 0 && selectedCount < langExercises.length
		},
		[getExercisesForLanguage, selectedExercises],
	)

	const toggleLanguage = useCallback(
		(lang: string) => {
			const langExercises = getExercisesForLanguage(lang)
			const allSelected = langExercises.every((ex) => selectedExercises.includes(ex))
			let newSelected: string[]
			if (allSelected) {
				newSelected = selectedExercises.filter((ex) => !ex.startsWith(`${lang}/`))
			} else {
				const existing = new Set(selectedExercises)
				for (const ex of langExercises) existing.add(ex)
				newSelected = Array.from(existing)
			}
			setSelectedExercises(newSelected)
			setValue("exercises", newSelected)
			localStorage.setItem("evals-exercises", JSON.stringify(newSelected))
		},
		[getExercisesForLanguage, selectedExercises, setSelectedExercises, setValue],
	)

	return (
		<FormField
			control={form.control}
			name="suite"
			render={() => (
				<FormItem>
					<FormLabel>Exercises</FormLabel>
					<div className="flex items-center gap-2 flex-wrap">
						<Tabs
							value={suite}
							onValueChange={(value) => {
								setValue("suite", value as "full" | "partial")
								localStorage.setItem("evals-suite", value)
								if (value === "full") {
									setSelectedExercises([])
									setValue("exercises", [])
									localStorage.removeItem("evals-exercises")
								}
							}}>
							<TabsList>
								<TabsTrigger value="full">All</TabsTrigger>
								<TabsTrigger value="partial">Some</TabsTrigger>
							</TabsList>
						</Tabs>
						{suite === "partial" && languages.length > 0 && (
							<div className="flex items-center gap-1 flex-wrap">
								{languages.map((lang) => (
									<Button
										key={lang}
										type="button"
										variant={
											isLanguageSelected(lang)
												? "default"
												: isLanguagePartiallySelected(lang)
													? "secondary"
													: "outline"
										}
										size="sm"
										onClick={() => toggleLanguage(lang)}
										className="text-xs capitalize">
										{lang}
									</Button>
								))}
							</div>
						)}
					</div>
					{suite === "partial" && (
						<MultiSelect
							options={exercisesData?.map((path) => ({ value: path, label: path })) || []}
							value={selectedExercises}
							onValueChange={(value) => {
								setSelectedExercises(value)
								setValue("exercises", value)
								localStorage.setItem("evals-exercises", JSON.stringify(value))
							}}
							placeholder="Select"
							variant="inverted"
							maxCount={4}
						/>
					)}
					<FormMessage />
				</FormItem>
			)}
		/>
	)
}
