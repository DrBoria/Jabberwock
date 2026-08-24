import React from "react"
import type { Notification } from "@jabberwock/types"
import { Markdown } from "../../../messages/components/message-parts/markdown"
import { OpenMarkdownPreviewButton } from "../../../messages/components/message-parts/open-markdown-preview-button"
import { Container } from "@src/shared/ui/layouts/Container"

interface CompletionResultAskProps {
	message: Notification
	icon: React.ReactNode
	title: React.ReactNode
}

export const CompletionResultAsk: React.FC<CompletionResultAskProps> = ({ message, icon, title }) => {
	if (!message.text) return null

	return (
		<div className="group">
			<Container $preset="header" $p="0">
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
