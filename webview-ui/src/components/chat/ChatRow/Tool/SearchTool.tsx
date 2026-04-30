import React from "react"
import { FolderTree, ListTree } from "lucide-react"
import { Trans } from "react-i18next"
import type { ClineMessage, ClineSayTool } from "@jabberwock/types"
import { toolIcon, Container } from "@src/components/ui"
import CodeAccordion from "../../../common/CodeAccordion"

interface ToolRendererProps {
	message: ClineMessage
	tool: ClineSayTool
	isExpanded: boolean
	onToggleExpand: () => void
	t: (key: string, options?: any) => string
}

/** Renders codebaseSearch tool */
export const CodebaseSearchRenderer: React.FC<Pick<ToolRendererProps, "tool" | "t">> = ({ tool, t }) => (
	<Container preset="header" p="0">
		{toolIcon("search")}
		<span style={{ fontWeight: "bold" }}>
			{tool.path ? (
				<Trans
					t={t as any}
					i18nKey="chat:codebaseSearch.wantsToSearchWithPath"
					components={{ code: <code></code> }}
					values={{ query: tool.query, path: tool.path }}
				/>
			) : (
				<Trans
					t={t as any}
					i18nKey="chat:codebaseSearch.wantsToSearch"
					components={{ code: <code></code> }}
					values={{ query: tool.query }}
				/>
			)}
		</span>
	</Container>
)

/** Renders listFilesTopLevel / listFilesRecursive */
export const ListFilesRenderer: React.FC<ToolRendererProps> = ({ message, tool, isExpanded, onToggleExpand, t }) => {
	const isRecursive = tool.tool === "listFilesRecursive"
	const Icon = isRecursive ? FolderTree : ListTree

	return (
		<>
			<Container preset="header" p="0">
				<Icon className="w-4 shrink-0" aria-label="List files icon" />
				<span style={{ fontWeight: "bold" }}>
					{message.type === "ask"
						? tool.isOutsideWorkspace
							? isRecursive
								? t("chat:directoryOperations.wantsToViewRecursiveOutsideWorkspace")
								: t("chat:directoryOperations.wantsToViewTopLevelOutsideWorkspace")
							: isRecursive
								? t("chat:directoryOperations.wantsToViewRecursive")
								: t("chat:directoryOperations.wantsToViewTopLevel")
						: tool.isOutsideWorkspace
							? isRecursive
								? t("chat:directoryOperations.didViewRecursiveOutsideWorkspace")
								: t("chat:directoryOperations.didViewTopLevelOutsideWorkspace")
							: isRecursive
								? t("chat:directoryOperations.didViewRecursive")
								: t("chat:directoryOperations.didViewTopLevel")}
				</span>
			</Container>
			<div className="pl-6">
				<CodeAccordion
					path={tool.path}
					code={tool.content}
					language={isRecursive ? "shellsession" : "shell-session"}
					isExpanded={isExpanded}
					onToggleExpand={onToggleExpand}
				/>
			</div>
		</>
	)
}

/** Renders searchFiles tool */
export const SearchFilesRenderer: React.FC<ToolRendererProps> = ({ tool, isExpanded, onToggleExpand, t }) => (
	<>
		<Container preset="header" p="0">
			{toolIcon("search")}
			<span style={{ fontWeight: "bold" }}>
				<Trans
					t={t as any}
					i18nKey={
						tool.isOutsideWorkspace
							? "chat:directoryOperations.wantsToSearchOutsideWorkspace"
							: "chat:directoryOperations.wantsToSearch"
					}
					components={{ code: <code className="font-medium">{tool.regex}</code> }}
					values={{ regex: tool.regex }}
				/>
			</span>
		</Container>
		<div className="pl-6">
			<CodeAccordion
				path={tool.path! + (tool.filePattern ? `/(${tool.filePattern})` : "")}
				code={tool.content}
				language="shellsession"
				isExpanded={isExpanded}
				onToggleExpand={onToggleExpand}
			/>
		</div>
	</>
)
