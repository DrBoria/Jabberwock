import { useMemo } from "react"
import { getSnapshot } from "mobx-state-tree"
import type { Goal } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { ContextMenuOptionType } from "../../utils/context-mentions/context-mentions"
import type { IDynamicTextAreaStore } from "../../store"

import type { ContextMenuQueryItem } from "../../utils/context-mentions/context-mentions"

export function useQueryItems(
	filePaths: string[] | undefined,
	openedTabs: Array<{ path?: string }> | undefined,
	textAreaStore: IDynamicTextAreaStore,
) {
	return useMemo(() => {
		const gitCommits = getSnapshot(textAreaStore.gitCommits) as ContextMenuQueryItem[]
		const taskGoals: Goal[] = (rootStore.extensionState.currentTaskItem as { goals?: Goal[] })?.goals ?? []
		return [
			{ type: ContextMenuOptionType.Problems, value: "problems" },
			{ type: ContextMenuOptionType.Terminal, value: "terminal" },
			...gitCommits,
			...taskGoals.map((g, i) => ({
				type: ContextMenuOptionType.Goal,
				value: `Goal #${i + 1}`,
				label: g.text,
				description: g.text,
			})),
			...(openedTabs || [])
				.filter((tab) => tab.path)
				.map((tab) => ({
					type: ContextMenuOptionType.OpenedFile,
					value: "/" + tab.path,
				})),
			...(filePaths || [])
				.map((file) => "/" + file)
				.filter((path) => !(openedTabs || []).some((tab) => tab.path && "/" + tab.path === path))
				.map((path) => ({
					type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
					value: path,
				})),
		]
	}, [filePaths, textAreaStore.gitCommits, openedTabs])
}
