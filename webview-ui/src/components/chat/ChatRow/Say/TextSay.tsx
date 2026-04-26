import React from "react"
import { MessageCircle } from "lucide-react"
import removeMd from "remove-markdown"
import type { ClineMessage } from "@jabberwock/types"
import { Markdown } from "../../Markdown"
import { OpenMarkdownPreviewButton } from "../../OpenMarkdownPreviewButton"
import ImageBlock from "../../../common/ImageBlock"
import { headerStyle, Container } from "@src/components/ui"

interface TextSayProps {
	message: ClineMessage
	isExpanded: boolean
	isRedundantDelegation: boolean
	isAgentSaidSummary: boolean
	modeName: string | undefined
	isStreaming: boolean
	onToggleExpand: () => void
	t: any
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
		return (
			<div className="group opacity-60 hover:opacity-100 transition-opacity">
				<Container
					preset="header"
					p="0"
					style={{ ...headerStyle, marginBottom: "4px" }}
					className="cursor-pointer"
					onClick={onToggleExpand}>
					<MessageCircle className="w-3 shrink-0" />
					<span className="text-[10px] font-bold uppercase tracking-tight">
						{modeName || "Agent"} summary
					</span>
					{!isExpanded && (
						<span className="text-[10px] ml-2 italic truncate">
							{(() => {
								const clean = removeMd(message.text || "")
									.replace(/\s+/g, " ")
									.trim()
								return clean.length > 100 ? `${clean.substring(0, 100)}...` : clean
							})()}
						</span>
					)}
				</Container>
				{isExpanded && (
					<div className="pl-4 border-l border-vscode-editorGroup-border ml-1.5">
						<Markdown markdown={message.text} partial={message.partial} />
					</div>
				)}
			</div>
		)
	}

	return (
		<div className="group">
			<Container preset="header" p="0">
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
