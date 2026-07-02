import type React from "react"

import type { ToolRendererProps } from "./types.js"
import { getToolCategory } from "./types.js"

import { FileReadTool } from "./renderers/FileReadTool.js"
import { FileWriteTool } from "./renderers/FileWriteTool.js"
import { SearchTool } from "./renderers/SearchTool.js"
import { CommandTool } from "./renderers/CommandTool.js"
import { ModeTool } from "./renderers/ModeTool.js"
import { CompletionTool } from "./renderers/CompletionTool.js"
import { GenericTool } from "./renderers/GenericTool.js"

const CATEGORY_RENDERERS: Record<string, React.FC<ToolRendererProps>> = {
	"file-read": FileReadTool,
	"file-write": FileWriteTool,
	search: SearchTool,
	command: CommandTool,
	mode: ModeTool,
	completion: CompletionTool,
	other: GenericTool,
}

export function getToolRenderer(toolName: string): React.FC<ToolRendererProps> {
	const category = getToolCategory(toolName)
	return CATEGORY_RENDERERS[category] || GenericTool
}
