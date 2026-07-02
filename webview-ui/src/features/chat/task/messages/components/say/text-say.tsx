import React from "react"
import { MessageCircle } from "lucide-react"
import removeMd from "remove-markdown"
import type { Notification } from "@jabberwock/types"
import { Markdown } from "../message-parts/markdown"
import { OpenMarkdownPreviewButton } from "../message-parts/open-markdown-preview-button"
import ImageBlock from "@src/features/foundation/components/image/ImageBlock"
import { Container } from "@src/shared/ui/layouts/Container"
import { headerStyle } from "@src/features/foundation/ui/utils/header-style"

interface TextSayProps {
	message: Notification
	isExpanded: boolean
	isRedundantDelegation: boolean
	isAgentSaidSummary: boolean
	modeName: string | undefined
	isStreaming: boolean
	onToggleExpand: () => void
	t: (key: string, options?: Record<string, unknown>) => string
}

function truncateText(text: string, maxLength: number): string {
	const clean = removeMd(text).replace(/\s+/g, " ").trim()
	if (clean.length > maxLength) {
		return `${clean.substring(0, maxLength)}...`
	}
	return clean
}

function extractSaidBody(text: string | undefined): string | undefined {
	const saidMatch = text?.match(/^(\p{So}|\p{S})?\s*\w+(\s+\w+)?\s+said:?\s*(.*)/iu)
	return saidMatch?.[3]?.trim() || text || ""
}

interface AgentSaidSummaryProps {
	bodyText: string | undefined
	isExpanded: boolean
	message: Notification
	onToggleExpand: () => void
}

const AgentSaidSummary: React.FC<AgentSaidSummaryProps> = ({ bodyText, isExpanded, message, onToggleExpand }) => (
	<div className="group opacity-50 hover:opacity-100 transition-opacity">
		<Container
			$preset="header"
			$p="0"
			style={{ ...headerStyle, marginBottom: "4px" }}
			className="cursor-pointer"
			onClick={onToggleExpand}>
			<span className="text-[10px] font-mono text-vscode-descriptionForeground" />
			{!isExpanded && bodyText && (
				<span className="text-[10px] ml-2 italic text-vscode-descriptionForeground truncate">
					{truncateText(bodyText, 100)}
				</span>
			)}
		</Container>
		{isExpanded && bodyText && (
			<div className="pl-4 border-l border-vscode-editorGroup-border ml-1.5 opacity-60">
				<Markdown markdown={bodyText} partial={message.partial} />
			</div>
		)}
	</div>
)

export const TextSay: React.FC<TextSayProps> = ({
	message,
	isExpanded,
	isRedundantDelegation,
	isAgentSaidSummary,
	modeName,
	isStreaming: _isStreaming,
	onToggleExpand,
	t,
}) => {
	if (isRedundantDelegation) return null

	if (isAgentSaidSummary) {
		const bodyText = extractSaidBody(message.text)

		return (
			<AgentSaidSummary
				bodyText={bodyText}
				isExpanded={isExpanded}
				message={message}
				onToggleExpand={onToggleExpand}
			/>
		)
	}

	return (
		<div className="group">
			<Container $preset="header" $p="0">
				<MessageCircle className="w-4 shrink-0" aria-label="Speech bubble icon" />
				<span style={{ fontWeight: "bold" }}>
					{modeName
						? t("chat:text.jabberwockSaid").replace("Jabberwock", modeName)
						: t("chat:text.jabberwockSaid")}
				</span>
				<OpenMarkdownPreviewButton markdown={message.text} />
			</Container>
			<div className="pl-6">
				<Markdown markdown={message.text} partial={message.partial} />
				{message.images && message.images.length > 0 && (
					<div style={{ marginTop: "10px" }}>
						{message.images.map((image, index) => (
							<ImageBlock key={index} imageData={image} />
						))}
					</div>
				)}
			</div>
		</div>
	)
}
