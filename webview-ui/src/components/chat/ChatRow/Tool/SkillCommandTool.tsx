import React from "react"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"
import type { ClineSayTool } from "@jabberwock/types"
import { toolIcon, Container } from "@src/components/ui"
import { ToolUseBlockHeader } from "../../../common/ToolUseBlock"

interface ToolRendererProps {
	tool: ClineSayTool
	isExpanded: boolean
	onToggleExpand: () => void
	t: (key: string, options?: any) => string
}

/** Renders skill tool */
export const SkillRenderer: React.FC<ToolRendererProps> = ({ tool, isExpanded, onToggleExpand, t }) => {
	return (
		<>
			<Container preset="header" p="0">
				{toolIcon("book")}
				<span style={{ fontWeight: "bold" }}>{t("chat:skill.wantsToLoad")}</span>
			</Container>
			<Container
				theme="card"
				preset="col"
				gap="0"
				mt="4px"
				style={{ overflow: "hidden", cursor: "pointer" }}
				onClick={onToggleExpand}>
				<ToolUseBlockHeader
					className="group"
					style={{
						display: "grid",
						gridTemplateColumns: "1fr auto",
						alignItems: "center",
						padding: "10px 12px",
					}}>
					<Container preset="row" p="0" gap="8px">
						<span style={{ fontWeight: "500", fontSize: "var(--vscode-font-size)" }}>{tool.skill}</span>
						{tool.source && (
							<VSCodeBadge style={{ fontSize: "calc(var(--vscode-font-size) - 2px)" }}>
								{tool.source}
							</VSCodeBadge>
						)}
					</Container>
					<span
						className={`codicon codicon-chevron-${isExpanded ? "up" : "down"} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}></span>
				</ToolUseBlockHeader>
				{isExpanded && (tool.args || tool.description) && (
					<Container
						preset="col"
						gap="8px"
						p="12px 16px"
						style={{ borderTop: "1px solid var(--vscode-editorGroup-border)" }}>
						{tool.description && (
							<div style={{ color: "var(--vscode-descriptionForeground)" }}>{tool.description}</div>
						)}
						{tool.args && (
							<div>
								<span style={{ fontWeight: "500" }}>Arguments: </span>
								<span style={{ color: "var(--vscode-descriptionForeground)" }}>{tool.args}</span>
							</div>
						)}
					</Container>
				)}
			</Container>
		</>
	)
}

/** Renders runSlashCommand tool (ask variant) */
export const SlashCommandRenderer: React.FC<ToolRendererProps> = ({ tool, isExpanded, onToggleExpand, t }) => {
	return (
		<>
			<Container preset="header" p="0">
				{toolIcon("play")}
				<span style={{ fontWeight: "bold" }}>{t("chat:slashCommand.wantsToRun")}</span>
			</Container>
			<Container
				theme="card"
				preset="col"
				gap="0"
				mt="4px"
				style={{ overflow: "hidden", cursor: "pointer" }}
				onClick={onToggleExpand}>
				<ToolUseBlockHeader
					className="group"
					style={{
						display: "grid",
						gridTemplateColumns: "1fr auto",
						alignItems: "center",
						padding: "10px 12px",
					}}>
					<Container preset="row" p="0" gap="8px">
						<span style={{ fontWeight: "500", fontSize: "var(--vscode-font-size)" }}>/{tool.command}</span>
						{tool.source && (
							<VSCodeBadge style={{ fontSize: "calc(var(--vscode-font-size) - 2px)" }}>
								{tool.source}
							</VSCodeBadge>
						)}
					</Container>
					<span
						className={`codicon codicon-chevron-${isExpanded ? "up" : "down"} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}></span>
				</ToolUseBlockHeader>
				{isExpanded && (tool.args || tool.description) && (
					<Container
						preset="col"
						gap="8px"
						p="12px 16px"
						style={{ borderTop: "1px solid var(--vscode-editorGroup-border)" }}>
						{tool.args && (
							<div>
								<span style={{ fontWeight: "500" }}>Arguments: </span>
								<span style={{ color: "var(--vscode-descriptionForeground)" }}>{tool.args}</span>
							</div>
						)}
						{tool.description && (
							<div style={{ color: "var(--vscode-descriptionForeground)" }}>{tool.description}</div>
						)}
					</Container>
				)}
			</Container>
		</>
	)
}
