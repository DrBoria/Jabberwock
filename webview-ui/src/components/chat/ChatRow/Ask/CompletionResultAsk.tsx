import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import { Markdown } from "../../Markdown"
import { OpenMarkdownPreviewButton } from "../../OpenMarkdownPreviewButton"
import { Container } from "@src/components/ui"

interface CompletionResultAskProps {
	message: ClineMessage
	icon: React.ReactNode
	title: React.ReactNode
}

export const CompletionResultAsk: React.FC<CompletionResultAskProps> = ({ message, icon, title }) => {
	if (!message.text) return null

	return (
		<div className="group">
			<Container preset="header" p="0">
				{icon}
				{title}
				<OpenMarkdownPreviewButton markdown={message.text} />
			</Container>
			<div style={{ color: "var(--vscode-charts-green)", paddingTop: 10 }}>
				<Markdown markdown={message.text} partial={message.partial} />
			</div>
		</div>
	)
}
