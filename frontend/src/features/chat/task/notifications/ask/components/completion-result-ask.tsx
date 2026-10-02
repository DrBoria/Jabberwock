import React from "react"
import type { Notification } from "@jabberwock/types"
import { Markdown } from "@src/features/chat/task/messages/components/message-parts/markdown"
import { OpenMarkdownPreviewButton } from "@src/features/chat/task/messages/components/message-parts/markdown"
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
