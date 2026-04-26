import React from "react"
import { MessageCircle } from "lucide-react"
import type { ClineMessage } from "@jabberwock/types"
import { Markdown } from "../Markdown"
import { ReasoningBlock } from "../ReasoningBlock"
import { OpenMarkdownPreviewButton } from "../OpenMarkdownPreviewButton"
import ImageBlock from "../../common/ImageBlock"

interface AssistantMessageProps {
	message: ClineMessage
	modeName: string | undefined
	isStreaming: boolean
	isLast: boolean
	t: (key: string, options?: any) => string
}

import { Container } from "@src/components/ui"
export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message, modeName, isStreaming, isLast, t }) => {
	const content = (message as any).content

	return (
		<Container preset="col" p="0" gap="0" className="group">
			<Container preset="row" p="0" gap="10px" style={{ cursor: "default", wordBreak: "break-word" }}>
				<MessageCircle className="w-4 shrink-0" aria-label="Speech bubble icon" />
				<span style={{ fontWeight: "bold" }}>
					{modeName
						? t("chat:text.jabberwockSaid").replace("Jabberwock", modeName)
						: t("chat:text.jabberwockSaid")}
				</span>
				<div style={{ flexGrow: 1 }} />
				{message.text && <OpenMarkdownPreviewButton markdown={message.text} />}
			</Container>
			<div className="pl-6 space-y-2 mt-1">
				{Array.isArray(content) && content.length > 0 ? (
					content.map((block: any, idx: number) => {
						if (block.type === "reasoning") {
							return (
								<ReasoningBlock
									key={`reasoning-${idx}`}
									content={block.text || ""}
									ts={message.ts}
									isStreaming={isStreaming}
									isLast={isLast}
								/>
							)
						}
						if (block.type === "text") {
							return <Markdown key={`text-${idx}`} markdown={block.text || ""} partial={block.partial} />
						}
						return null
					})
				) : (
					<Markdown markdown={message.text || ""} partial={message.partial} />
				)}
				{message.images && message.images.length > 0 && (
					<Container preset="col" p="0" gap="0" style={{ marginTop: "10px" }}>
						{message.images.map((image, index) => (
							<ImageBlock key={index} imageData={image} />
						))}
					</Container>
				)}
			</div>
		</Container>
	)
}
