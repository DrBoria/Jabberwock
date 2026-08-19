import { useState, useEffect, useMemo } from "react"
import { Fzf } from "fzf"

import { highlightFzfMatch } from "@src/utils/text/highlighter"
import { rootStore } from "@src/features/store"

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

interface TaskItem {
	ts?: number
	task: string
	totalCost?: number
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	workspace?: string
}

export const useTaskSearch = () => {
	const s = rootStore.extensionState
	const taskHistory = s.taskHistory
	const cwd = s.cwd
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")
	const [showAllWorkspaces, setShowAllWorkspaces] = useState(false)

	useEffect(() => {
		if (searchQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!searchQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [searchQuery, sortOption, lastNonRelevantSort])

	const presentableTasks = useMemo(() => {
		let tasks = taskHistory.filter((item) => item.ts && typeof item.task === "string")
		if (!showAllWorkspaces && cwd) {
			tasks = tasks.filter((item) => item.workspace === cwd)
		}
		return tasks
	}, [taskHistory, showAllWorkspaces, cwd])

	const fzf = useMemo(() => {
		return new Fzf<typeof presentableTasks>(presentableTasks, {
			selector: (item) => item.task,
		})
	}, [presentableTasks])

	const sortComparators = useMemo(() => {
		const sortByOldest = (a: TaskItem, b: TaskItem) => (a.ts ?? 0) - (b.ts ?? 0)
		const sortByMostExpensive = (a: TaskItem, b: TaskItem) => (b.totalCost ?? 0) - (a.totalCost ?? 0)
		const sortByMostTokens = (a: TaskItem, b: TaskItem) => {
			const aTokens = (a.tokensIn ?? 0) + (a.tokensOut ?? 0) + (a.cacheWrites ?? 0) + (a.cacheReads ?? 0)
			const bTokens = (b.tokensIn ?? 0) + (b.tokensOut ?? 0) + (b.cacheWrites ?? 0) + (b.cacheReads ?? 0)
			return bTokens - aTokens
		}
		const sortByMostRelevant = (a: TaskItem, b: TaskItem) => (searchQuery ? 0 : (b.ts ?? 0) - (a.ts ?? 0))
		const sortByNewest = (a: TaskItem, b: TaskItem) => (b.ts ?? 0) - (a.ts ?? 0)

		return {
			oldest: sortByOldest,
			mostExpensive: sortByMostExpensive,
			mostTokens: sortByMostTokens,
			mostRelevant: sortByMostRelevant,
			newest: sortByNewest,
		} satisfies Record<SortOption, (a: TaskItem, b: TaskItem) => number>
	}, [searchQuery])

	const tasks = useMemo(() => {
		let results = presentableTasks

		if (searchQuery) {
			const searchResults = fzf.find(searchQuery)
			results = searchResults.map((result) => {
				const positions = Array.from(result.positions)
				const taskEndIndex = result.item.task.length

				return {
					...result.item,
					highlight: highlightFzfMatch(
						result.item.task,
						positions.filter((p) => p < taskEndIndex),
					),
					workspace: result.item.workspace,
				}
			})
		}

		return [...results].sort(sortComparators[sortOption])
	}, [presentableTasks, searchQuery, fzf, sortOption, sortComparators])

	return {
		tasks,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		lastNonRelevantSort,
		setLastNonRelevantSort,
		showAllWorkspaces,
		setShowAllWorkspaces,
	}
}
