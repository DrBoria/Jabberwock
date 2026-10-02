import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { MessageCircleWarning } from "lucide-react"

import { useCopyButton } from "./use-copy"
import { CodeBlock } from "@src/features/foundation"

export const DiffErrorRow: React.FC<{
	errorTitle: string | null
	message: string
	showCopyButton?: boolean
	isExpanded: boolean
	onToggleExpand: () => void
}> = ({ errorTitle, message, showCopyButton, isExpanded, onToggleExpand }) => {
	const { showCopySuccess, handleCopy } = useCopyButton(message)

	return (
		<div className="mt-0 overflow-hidden mb-2 pr-1 group">
			<div
				className="font-sm text-vscode-editor-foreground flex items-center justify-between cursor-pointer"
				onClick={onToggleExpand}>
				<div className="flex items-center gap-2 flex-grow text-vscode-errorForeground">
					<MessageCircleWarning className="w-4" />
					<span className="text-vscode-errorForeground font-bold grow cursor-pointer">{errorTitle}</span>
				</div>
				<div className="flex items-center transition-opacity opacity-0 group-hover:opacity-100">
					{showCopyButton && (
						<VSCodeButton
							appearance="icon"
							className="p-0.75 h-6 mr-1 text-vscode-editor-foreground flex items-center justify-center bg-transparent"
							onClick={handleCopy}>
							<span className={`codicon codicon-${showCopySuccess ? "check" : "copy"}`} />
						</VSCodeButton>
					)}
					<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`} />
				</div>
			</div>
			{isExpanded && (
				<div className="px-2 py-1 mt-2 bg-vscode-editor-background ml-6 rounded-lg">
					<CodeBlock source={message} language="text" />
				</div>
			)}
		</div>
	)
}
