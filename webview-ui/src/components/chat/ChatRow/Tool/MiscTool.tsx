import React from "react"
import type { ClineMessage, ClineSayTool } from "@jabberwock/types"
import { toolIcon, Container } from "@src/components/ui"
import { ToolUseBlock } from "../../../common/ToolUseBlock"
import { TodoChangeDisplay } from "../../TodoChangeDisplay"
import { getPreviousTodos } from "../utils"

interface ToolRendererProps {
	message: ClineMessage
	tool: ClineSayTool
	isNested: boolean
	isRedundantTodo: boolean
	effectiveHistory: ClineMessage[]
	t: (key: string, options?: any) => string
}

/** Renders updateTodoList tool */
export const UpdateTodoListRenderer: React.FC<ToolRendererProps> = ({
	message,
	tool,
	isRedundantTodo,
	effectiveHistory,
	isNested,
}) => {
	if (isRedundantTodo) return null
	const todos = tool.content ? JSON.parse(tool.content) : []
	const previousTodos = getPreviousTodos(effectiveHistory, message.ts)
	return <TodoChangeDisplay previousTodos={previousTodos} newTodos={todos} isNested={isNested} />
}

interface GenerateImageProps {
	message: ClineMessage
	tool: ClineSayTool
	t: (key: string, options?: any) => string
}

/** Renders generateImage tool */
export const GenerateImageRenderer: React.FC<GenerateImageProps> = ({ message, tool, t }) => (
	<>
		<Container preset="header" p="0">
			{tool.isProtected ? (
				<span
					className="codicon codicon-lock"
					style={{ color: "var(--vscode-editorWarning-foreground)", marginBottom: "-1.5px" }}
				/>
			) : (
				toolIcon("file-media")
			)}
			<span style={{ fontWeight: "bold" }}>
				{message.type === "ask"
					? tool.isProtected
						? t("chat:fileOperations.wantsToGenerateImageProtected")
						: tool.isOutsideWorkspace
							? t("chat:fileOperations.wantsToGenerateImageOutsideWorkspace")
							: t("chat:fileOperations.wantsToGenerateImage")
					: t("chat:fileOperations.didGenerateImage")}
			</span>
		</Container>
		{message.type === "ask" && (
			<div className="pl-6">
				<ToolUseBlock>
					<Container preset="col" p="8px" gap="4px">
						<div className="break-words">{tool.content}</div>
						<Container preset="row" p="0" gap="4px" className="text-xs text-vscode-descriptionForeground">
							{tool.path}
						</Container>
					</Container>
				</ToolUseBlock>
			</div>
		)}
	</>
)
