import React from "react"
import { MessageCircle } from "lucide-react"
import type { Notification } from "@jabberwock/types"
import { Markdown } from "./markdown"
import { ReasoningBlock } from "./reasoning-block"
import { OpenMarkdownPreviewButton } from "./open-markdown-preview-button"
import ImageBlock from "@src/features/foundation/components/ImageBlock"

interface AssistantMessageProps {
	message: Notification
	modeName: string | undefined
	isStreaming: boolean
	isLast: boolean
	t: (key: string, options?: Record<string, unknown>) => string
}

import { Container } from "@src/features/foundation/ui"
export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message, modeName, isStreaming, isLast, t }) => {
	const content = (message as { content?: unknown }).content

	return (
		<Container $preset="col" $p="0" $gap="0" className="group">
			<Container $preset="row" $p="0" $gap="10px" style={{ cursor: "default", wordBreak: "break-word" }}>
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
					content.map((block: { type: string; text?: string; partial?: boolean }, idx: number) => {
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
					<Container $preset="col" $p="0" $gap="0" style={{ marginTop: "10px" }}>
						{message.images.map((image, index) => (
							<ImageBlock key={index} imageData={image} />
						))}
					</Container>
				)}
			</div>
		</Container>
	)
}
