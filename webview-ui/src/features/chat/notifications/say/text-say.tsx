import React from "react"
import { MessageCircle } from "lucide-react"
import removeMd from "remove-markdown"
import type { ClineMessage } from "@jabberwock/types"
import { Markdown } from "../../messages-list/markdown"
import { OpenMarkdownPreviewButton } from "../../messages-list/open-markdown-preview-button"
import ImageBlock from "@src/components/common/ImageBlock"
import { headerStyle, Container } from "@src/components/ui"

interface TextSayProps {
	message: ClineMessage
	isExpanded: boolean
	isRedundantDelegation: boolean
	isAgentSaidSummary: boolean
	modeName: string | undefined
	isStreaming: boolean
	onToggleExpand: () => void
	t: (key: string, options?: Record<string, unknown>) => string
}

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
		// Extract the "said" part from messages like "🪃 Orchestrator said: some text"
		const saidMatch = message.text?.match(/^(\p{So}|\p{S})?\s*\w+(\s+\w+)?\s+said:?\s*(.*)/iu)
		const bodyText = saidMatch?.[3]?.trim() || message.text || ""

		return (
			<div className="group opacity-50 hover:opacity-100 transition-opacity">
				<Container
					$preset="header"
					$p="0"
					style={{ ...headerStyle, marginBottom: "4px" }}
					className="cursor-pointer"
					onClick={onToggleExpand}>
					<span className="text-[10px] font-mono text-vscode-descriptionForeground">
						{/* {modeName || "Agent"} said */}
					</span>
					{!isExpanded && bodyText && (
						<span className="text-[10px] ml-2 italic text-vscode-descriptionForeground truncate">
							{(() => {
								const clean = removeMd(bodyText).replace(/\s+/g, " ").trim()
								return clean.length > 100 ? `${clean.substring(0, 100)}...` : clean
							})()}
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
