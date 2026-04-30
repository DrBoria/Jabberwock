import React from "react"
import type { ClineMessage, ClineSayTool } from "@jabberwock/types"
import {
	FileEditRenderer,
	InsertContentRenderer,
	CodebaseSearchRenderer,
	UpdateTodoListRenderer,
	ReadFileRenderer,
	SkillRenderer,
	ListFilesRenderer,
	SearchFilesRenderer,
	SwitchModeRenderer,
	NewTaskRenderer,
	FinishTaskRenderer,
	SlashCommandRenderer,
	GenerateImageRenderer,
} from "./Tool"

interface ToolRendererProps {
	message: ClineMessage
	tool: ClineSayTool
	isExpanded: boolean
	isNested: boolean
	isRedundantTodo: boolean
	effectiveHistory: ClineMessage[]
	onToggleExpand: () => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
	t: (key: string, options?: any) => string
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
		codebaseSearch: () => <CodebaseSearchRenderer tool={tool} t={props.t as any} />,
		updateTodoList: () => <UpdateTodoListRenderer {...props} />,
		readFile: () => <ReadFileRenderer {...props} />,
		skill: () => <SkillRenderer {...props} />,
		listFilesTopLevel: () => <ListFilesRenderer {...props} />,
		listFilesRecursive: () => <ListFilesRenderer {...props} />,
		searchFiles: () => <SearchFilesRenderer {...props} />,
		switchMode: () => <SwitchModeRenderer {...props} />,
		newTask: () => <NewTaskRenderer {...props} />,
		finishTask: () => <FinishTaskRenderer t={props.t as any} />,
		runSlashCommand: () => <SlashCommandRenderer {...props} />,
		generateImage: () => <GenerateImageRenderer {...props} />,
	}

	return dispatchers[tool.tool]?.() ?? null
}
