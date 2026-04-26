import React from "react"
import { FileDiff } from "lucide-react"
import type { ClineMessage, ClineSayTool } from "@jabberwock/types"
import { vscode } from "@src/utils/vscode"
import { toolIcon, Container } from "@src/components/ui"
import CodeAccordion from "../../../common/CodeAccordion"
import { BatchDiffApproval } from "../../BatchDiffApproval"

interface ToolRendererProps {
	message: ClineMessage
	tool: ClineSayTool
	isExpanded: boolean
	onToggleExpand: () => void
	t: (key: string, options?: any) => string
}

/** Renders file edit/diff operations (editedExistingFile, appliedDiff, newFileCreated, etc.) */
export const FileEditRenderer: React.FC<ToolRendererProps> = ({ message, tool, isExpanded, onToggleExpand, t }) => {
	const unifiedDiff = (tool.content ?? tool.diff) as string | undefined
	const onJumpToCreatedFile =
		tool.tool === "newFileCreated" && tool.path
			? () => vscode.postMessage({ type: "openFile", text: "./" + tool.path })
			: undefined

	// Batch diff request
	if (message.type === "ask" && tool.batchDiffs && Array.isArray(tool.batchDiffs)) {
		return (
			<>
				<Container preset="header" p="0">
					<FileDiff className="w-4 shrink-0" aria-label="Batch diff icon" />
					<span style={{ fontWeight: "bold" }}>{t("chat:fileOperations.wantsToApplyBatchChanges")}</span>
				</Container>
				<BatchDiffApproval files={tool.batchDiffs} ts={message.ts} />
			</>
		)
	}

	return (
		<>
			<Container preset="header" p="0">
				{tool.isProtected ? (
					<span
						className="codicon codicon-lock"
						style={{ color: "var(--vscode-editorWarning-foreground)", marginBottom: "-1.5px" }}
					/>
				) : (
					toolIcon("diff")
				)}
				<span style={{ fontWeight: "bold" }}>
					{tool.isProtected
						? t("chat:fileOperations.wantsToEditProtected")
						: tool.isOutsideWorkspace
							? t("chat:fileOperations.wantsToEditOutsideWorkspace")
							: t("chat:fileOperations.wantsToEdit")}
				</span>
			</Container>
			<div className="pl-6">
				<CodeAccordion
					path={tool.path}
					code={unifiedDiff ?? tool.content ?? tool.diff ?? ""}
					language="diff"
					progressStatus={message.progressStatus}
					isLoading={message.partial}
					isExpanded={isExpanded}
					onToggleExpand={onToggleExpand}
					onJumpToFile={onJumpToCreatedFile}
					diffStats={tool.diffStats}
				/>
			</div>
		</>
	)
}

/** Renders insertContent tool */
export const InsertContentRenderer: React.FC<ToolRendererProps> = ({
	message,
	tool,
	isExpanded,
	onToggleExpand,
	t,
}) => {
	const unifiedDiff = (tool.content ?? tool.diff) as string | undefined
	return (
		<>
			<Container preset="header" p="0">
				{tool.isProtected ? (
					<span
						className="codicon codicon-lock"
						style={{ color: "var(--vscode-editorWarning-foreground)", marginBottom: "-1.5px" }}
					/>
				) : (
					toolIcon("insert")
				)}
				<span style={{ fontWeight: "bold" }}>
					{tool.isProtected
						? t("chat:fileOperations.wantsToEditProtected")
						: tool.isOutsideWorkspace
							? t("chat:fileOperations.wantsToEditOutsideWorkspace")
							: tool.lineNumber === 0
								? t("chat:fileOperations.wantsToInsertAtEnd")
								: t("chat:fileOperations.wantsToInsertWithLineNumber", {
										lineNumber: tool.lineNumber,
									})}
				</span>
			</Container>
			<div className="pl-6">
				<CodeAccordion
					path={tool.path}
					code={unifiedDiff ?? tool.diff}
					language="diff"
					progressStatus={message.progressStatus}
					isLoading={message.partial}
					isExpanded={isExpanded}
					onToggleExpand={onToggleExpand}
					diffStats={tool.diffStats}
				/>
			</div>
		</>
	)
}
