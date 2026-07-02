import React from "react"
import type { Notification, SayToolData } from "@jabberwock/types"
import { FileEditRenderer, InsertContentRenderer } from "../tool/file-edit-tool"
import { ReadFileRenderer } from "../tool/read-file-tool"
import { SkillRenderer, SlashCommandRenderer } from "../tool/skill-command-tool"
import { CodebaseSearchRenderer, ListFilesRenderer, SearchFilesRenderer } from "../tool/search-tool"
import { SwitchModeRenderer, NewTaskRenderer, FinishTaskRenderer } from "../tool/mode-task-tool"
import { UpdateTodoListRenderer, GenerateImageRenderer } from "../tool/misc-tool"

interface ToolRendererProps {
	message: Notification
	tool: SayToolData
	isExpanded: boolean
	isNested: boolean
	isRedundantTodo: boolean
	effectiveHistory: Notification[]
	onToggleExpand: () => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
	t: (key: string, options?: Record<string, unknown>) => string
}

/** Main ToolRenderer - dispatches to sub-renderers via object-literal pattern */
export const ToolRenderer: React.FC<ToolRendererProps> = (props) => {
	const { tool } = props

	const dispatchers: Record<string, () => React.ReactNode> = {
		editedExistingFile: () => <FileEditRenderer {...props} />,
		appliedDiff: () => <FileEditRenderer {...props} />,
		newFileCreated: () => <FileEditRenderer {...props} />,
		searchAndReplace: () => <FileEditRenderer {...props} />,
		search_and_replace: () => <FileEditRenderer {...props} />,
		search_replace: () => <FileEditRenderer {...props} />,
		edit: () => <FileEditRenderer {...props} />,
		edit_file: () => <FileEditRenderer {...props} />,
		apply_patch: () => <FileEditRenderer {...props} />,
		apply_diff: () => <FileEditRenderer {...props} />,
		insertContent: () => <InsertContentRenderer {...props} />,
		codebaseSearch: () => <CodebaseSearchRenderer tool={tool} />,
		updateTodoList: () => <UpdateTodoListRenderer {...props} />,
		readFile: () => <ReadFileRenderer {...props} />,
		skill: () => <SkillRenderer {...props} />,
		listFilesTopLevel: () => <ListFilesRenderer {...props} />,
		listFilesRecursive: () => <ListFilesRenderer {...props} />,
		searchFiles: () => <SearchFilesRenderer {...props} />,
		switchMode: () => <SwitchModeRenderer {...props} />,
		newTask: () => <NewTaskRenderer {...props} />,
		finishTask: () => <FinishTaskRenderer t={props.t} />,
		runSlashCommand: () => <SlashCommandRenderer {...props} />,
		generateImage: () => <GenerateImageRenderer {...props} />,
	}

	return dispatchers[tool.tool]?.() ?? null
}
