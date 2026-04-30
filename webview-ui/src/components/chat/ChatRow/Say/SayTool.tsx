import React from "react"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"
import type { ClineMessage, ClineSayTool } from "@jabberwock/types"
import { safeJsonParse } from "@shared/core"
import { ToolUseBlock, ToolUseBlockHeader } from "../../../common/ToolUseBlock"
import { toolIcon, Container } from "@src/components/ui"

interface SayToolProps {
	message: ClineMessage
	t: any
}

const formatBytes = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Renders say tool messages (runSlashCommand, readCommandOutput) */
export const SayTool: React.FC<SayToolProps> = ({ message, t }) => {
	const sayTool = safeJsonParse<ClineSayTool>(message.text)
	if (!sayTool) return null

	const dispatchers: Record<string, () => React.ReactNode> = {
		runSlashCommand: () => {
			return (
				<>
					<Container preset="header" p="0">
						{toolIcon("terminal-cmd")}
						<span style={{ fontWeight: "bold" }}>{t("chat:slashCommand.didRun")}</span>
					</Container>
					<div className="pl-6">
						<ToolUseBlock>
							<ToolUseBlockHeader
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-start",
									gap: "4px",
									padding: "10px 12px",
								}}>
								<Container preset="row" w="100%" p="0">
									<span style={{ fontWeight: "500", fontSize: "var(--vscode-font-size)" }}>
										/{sayTool.command}
									</span>
									{sayTool.args && (
										<span
											style={{
												color: "var(--vscode-descriptionForeground)",
												fontSize: "var(--vscode-font-size)",
											}}>
											{sayTool.args}
										</span>
									)}
								</Container>
								{sayTool.description && (
									<div
										style={{
											color: "var(--vscode-descriptionForeground)",
											fontSize: "calc(var(--vscode-font-size) - 1px)",
										}}>
										{sayTool.description}
									</div>
								)}
								{sayTool.source && (
									<Container preset="row" p="0" gap="4px">
										<VSCodeBadge style={{ fontSize: "calc(var(--vscode-font-size) - 2px)" }}>
											{sayTool.source}
										</VSCodeBadge>
									</Container>
								)}
							</ToolUseBlockHeader>
						</ToolUseBlock>
					</div>
				</>
			)
		},
		readCommandOutput: () => {
			const isSearch = sayTool.searchPattern !== undefined
			let infoText = ""
			if (isSearch) {
				const matchText =
					sayTool.matchCount !== undefined
						? sayTool.matchCount === 1
							? "1 match"
							: `${sayTool.matchCount} matches`
						: ""
				infoText = `search: "${sayTool.searchPattern}"${matchText ? ` • ${matchText}` : ""}`
			} else if (
				sayTool.readStart !== undefined &&
				sayTool.readEnd !== undefined &&
				sayTool.totalBytes !== undefined
			) {
				infoText = `${formatBytes(sayTool.readStart)} - ${formatBytes(sayTool.readEnd)} of ${formatBytes(sayTool.totalBytes)}`
			} else if (sayTool.totalBytes !== undefined) {
				infoText = formatBytes(sayTool.totalBytes)
			}
			return (
				<Container preset="header" p="0">
					{toolIcon("file-code")}
					<span style={{ fontWeight: "bold" }}>{t("chat:readCommandOutput.title")}</span>
					{infoText && (
						<span className="text-xs" style={{ color: "var(--vscode-descriptionForeground)" }}>
							({infoText})
						</span>
					)}
				</Container>
			)
		},
	}

	return dispatchers[sayTool.tool]?.() ?? null
}
