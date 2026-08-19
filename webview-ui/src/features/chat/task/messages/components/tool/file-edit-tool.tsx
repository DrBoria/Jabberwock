import React from "react"
import { FileDiff } from "lucide-react"
import type { Notification, SayToolData } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { toolIcon } from "@src/shared/ui/icons/toolIcon"
import { Container } from "@src/shared/ui/layouts/Container"
import CodeAccordion from "@src/features/foundation/components/code/CodeAccordion"
import { BatchDiffApproval } from "../../../notifications/batch/diff-approval"

interface ToolRendererProps {
	message: Notification
	tool: SayToolData
	isExpanded: boolean
	onToggleExpand: () => void
	t: (key: string, options?: Record<string, unknown>) => string
}

function getFileEditHeaderLabel(
	tool: SayToolData,
	t: (key: string, options?: Record<string, unknown>) => string,
): string {
	if (tool.isProtected) return t("chat:fileOperations.wantsToEditProtected")
	if (tool.isOutsideWorkspace) return t("chat:fileOperations.wantsToEditOutsideWorkspace")
	return t("chat:fileOperations.wantsToEdit")
}

function getFileEditIcon(tool: SayToolData): React.ReactNode {
	if (tool.isProtected) {
		return (
			<span
				className="codicon codicon-lock"
				style={{ color: "var(--vscode-editorWarning-foreground)", marginBottom: "-1.5px" }}
			/>
		)
	}
	return toolIcon("diff")
}

interface BatchDiffRendererProps {
	message: Notification
	batchDiffs: NonNullable<SayToolData["batchDiffs"]>
	t: (key: string, options?: Record<string, unknown>) => string
}

const BatchDiffRenderer: React.FC<BatchDiffRendererProps> = ({ message, batchDiffs, t }) => (
	<>
		<Container $preset="header" $p="0">
			<FileDiff className="w-4 shrink-0" aria-label="Batch diff icon" />
			<span style={{ fontWeight: "bold" }}>{t("chat:fileOperations.wantsToApplyBatchChanges")}</span>
		</Container>
		<BatchDiffApproval files={batchDiffs} ts={message.ts} />
	</>
)

/** Renders file edit/diff operations (editedExistingFile, appliedDiff, newFileCreated, etc.) */
export const FileEditRenderer: React.FC<ToolRendererProps> = ({ message, tool, isExpanded, onToggleExpand, t }) => {
	const unifiedDiff = (tool.content ?? tool.diff) as string | undefined
	const onJumpToCreatedFile =
		tool.tool === "newFileCreated" && tool.path ? () => rootStore.settings.openFile("./" + tool.path) : undefined

	if (message.type === "ask" && tool.batchDiffs && Array.isArray(tool.batchDiffs)) {
		return <BatchDiffRenderer message={message} batchDiffs={tool.batchDiffs} t={t} />
	}

	return (
		<>
			<Container $preset="header" $p="0">
				{getFileEditIcon(tool)}
				<span style={{ fontWeight: "bold" }}>{getFileEditHeaderLabel(tool, t)}</span>
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

function getInsertHeaderLabel(
	tool: SayToolData,
	t: (key: string, options?: Record<string, unknown>) => string,
): string {
	if (tool.isProtected) return t("chat:fileOperations.wantsToEditProtected")
	if (tool.isOutsideWorkspace) return t("chat:fileOperations.wantsToEditOutsideWorkspace")
	if (tool.lineNumber === 0) return t("chat:fileOperations.wantsToInsertAtEnd")
	return t("chat:fileOperations.wantsToInsertWithLineNumber", {
		lineNumber: tool.lineNumber,
	})
}

function getInsertIcon(tool: SayToolData): React.ReactNode {
	if (tool.isProtected) {
		return (
			<span
				className="codicon codicon-lock"
				style={{ color: "var(--vscode-editorWarning-foreground)", marginBottom: "-1.5px" }}
			/>
		)
	}
	return toolIcon("insert")
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
			<Container $preset="header" $p="0">
				{getInsertIcon(tool)}
				<span style={{ fontWeight: "bold" }}>{getInsertHeaderLabel(tool, t)}</span>
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
