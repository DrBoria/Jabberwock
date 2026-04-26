import React from "react"
import { Eye, FileCode2 } from "lucide-react"
import type { ClineMessage, ClineSayTool } from "@jabberwock/types"
import { vscode } from "@src/utils/vscode"
import { formatPathTooltip } from "@src/utils/formatPathTooltip"
import { headerStyle } from "@src/components/ui"
import { ToolUseBlock, ToolUseBlockHeader } from "../../../common/ToolUseBlock"
import { PathTooltip } from "../../../ui/PathTooltip"
import { BatchFilePermission } from "../../BatchFilePermission"

interface ToolRendererProps {
	message: ClineMessage
	tool: ClineSayTool
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
	t: (key: string, options?: any) => string
}

/** Renders readFile tool */
export const ReadFileRenderer: React.FC<ToolRendererProps> = ({ message, tool, onBatchFileResponse, t }) => {
	const isBatchRequest = message.type === "ask" && tool.batchFiles && Array.isArray(tool.batchFiles)

	if (isBatchRequest) {
		return (
			<>
				<div style={headerStyle}>
					<Eye className="w-4 shrink-0" aria-label="View files icon" />
					<span style={{ fontWeight: "bold" }}>{t("chat:fileOperations.wantsToReadMultiple")}</span>
				</div>
				<BatchFilePermission
					files={tool.batchFiles || []}
					onPermissionResponse={(response) => {
						onBatchFileResponse?.(response)
					}}
					ts={message?.ts}
				/>
			</>
		)
	}

	return (
		<>
			<div style={headerStyle}>
				<FileCode2 className="w-4 shrink-0" aria-label="Read file icon" />
				<span style={{ fontWeight: "bold" }}>
					{message.type === "ask"
						? tool.isOutsideWorkspace
							? t("chat:fileOperations.wantsToReadOutsideWorkspace")
							: tool.additionalFileCount && tool.additionalFileCount > 0
								? t("chat:fileOperations.wantsToReadAndXMore", {
										count: tool.additionalFileCount,
									})
								: t("chat:fileOperations.wantsToRead")
						: t("chat:fileOperations.didRead")}
				</span>
			</div>
			<div className="pl-6">
				<ToolUseBlock>
					<ToolUseBlockHeader
						className="group"
						onClick={() =>
							vscode.postMessage({
								type: "openFile",
								text: tool.content,
								values: tool.startLine ? { line: tool.startLine } : undefined,
							})
						}>
						{tool.path?.startsWith(".") && <span>.</span>}
						<PathTooltip content={formatPathTooltip(tool.path, tool.reason)}>
							<span className="whitespace-nowrap overflow-hidden text-ellipsis text-left mr-2 rtl">
								{formatPathTooltip(tool.path, tool.reason)}
							</span>
						</PathTooltip>
						<div style={{ flexGrow: 1 }}></div>
						<span
							className="codicon codicon-link-external opacity-0 group-hover:opacity-100 transition-opacity"
							style={{ fontSize: 13.5, margin: "1px 0" }}
						/>
					</ToolUseBlockHeader>
				</ToolUseBlock>
			</div>
		</>
	)
}
