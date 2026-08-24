import React from "react"
import { Eye, FileCode2 } from "lucide-react"
import type { Notification, SayToolData } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { formatPathTooltip } from "@src/utils/format/formatPathTooltip"

import { ToolUseBlock, ToolUseBlockHeader } from "@src/features/foundation/components/code/ToolUseBlock"
import { PathTooltip } from "@src/shared/ui/tooltips/PathTooltip"
import { headerStyle } from "@src/features/foundation/ui/utils/header-style"
import { BatchFilePermission } from "../../../notifications/batch/file-permission"

interface ToolRendererProps {
	message: Notification
	tool: SayToolData
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
	t: (key: string, options?: Record<string, unknown>) => string
}

interface BatchReadFileRendererProps {
	files: NonNullable<SayToolData["batchFiles"]>
	ts: number
	onBatchFileResponse: ((response: { [key: string]: boolean }) => void) | undefined
	t: (key: string, options?: Record<string, unknown>) => string
}

const BatchReadFileRenderer: React.FC<BatchReadFileRendererProps> = ({ files, ts, onBatchFileResponse, t }) => (
	<>
		<div style={headerStyle}>
			<Eye className="w-4 shrink-0" aria-label="View files icon" />
			<span style={{ fontWeight: "bold" }}>{t("chat:fileOperations.wantsToReadMultiple")}</span>
		</div>
		<BatchFilePermission
			files={files}
			onPermissionResponse={(response) => {
				onBatchFileResponse?.(response)
			}}
			ts={ts}
		/>
	</>
)

function getReadFileLabel(
	message: Notification,
	tool: SayToolData,
	t: (key: string, options?: Record<string, unknown>) => string,
): string {
	if (message.type !== "ask") return t("chat:fileOperations.didRead")
	if (tool.isOutsideWorkspace) return t("chat:fileOperations.wantsToReadOutsideWorkspace")
	if (tool.additionalFileCount && tool.additionalFileCount > 0) {
		return t("chat:fileOperations.wantsToReadAndXMore", { count: tool.additionalFileCount })
	}
	return t("chat:fileOperations.wantsToRead")
}

/** Renders readFile tool */
export const ReadFileRenderer: React.FC<ToolRendererProps> = ({ message, tool, onBatchFileResponse, t }) => {
	const isBatchRequest = message.type === "ask" && tool.batchFiles && Array.isArray(tool.batchFiles)

	if (isBatchRequest) {
		return (
			<BatchReadFileRenderer
				files={tool.batchFiles ?? []}
				ts={message.ts}
				onBatchFileResponse={onBatchFileResponse}
				t={t}
			/>
		)
	}

	return (
		<>
			<div style={headerStyle}>
				<FileCode2 className="w-4 shrink-0" aria-label="Read file icon" />
				<span style={{ fontWeight: "bold" }}>{getReadFileLabel(message, tool, t)}</span>
			</div>
			<div className="pl-6">
				<ToolUseBlock>
					<ToolUseBlockHeader
						className="group"
						onClick={() =>
							rootStore.settings.openFile(
								tool.content ?? "",
								tool.startLine ? { line: tool.startLine } : undefined,
							)
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
