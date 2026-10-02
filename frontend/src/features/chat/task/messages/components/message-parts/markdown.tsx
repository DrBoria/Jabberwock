import React, { memo, useState } from "react"
import { SquareArrowOutUpRight } from "lucide-react"
import { hasComplexMarkdown } from "@src/utils/text/markdown"
import { rootStore } from "@src/features/store"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useCopyToClipboard } from "@sections/dndTextArea/utils/clipboard/main"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard"
import { MarkdownBlock } from "@src/features/foundation"

export const Markdown = memo(({ markdown, partial }: { markdown?: string; partial?: boolean }) => {
	const [isHovering, setIsHovering] = useState(false)

	// Shorter feedback duration for copy button flash.
	const { copyWithFeedback } = useCopyToClipboard(200)

	if (!markdown || markdown.length === 0) {
		return null
	}

	return (
		<div
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
			style={{ position: "relative" }}>
			<div style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
				<MarkdownBlock markdown={markdown} />
			</div>
			{markdown && !partial && isHovering && (
				<div
					style={{
						position: "absolute",
						bottom: "-4px",
						right: "8px",
						opacity: 0,
						animation: "fadeIn 0.2s ease-in-out forwards",
						borderRadius: "4px",
					}}>
					<style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1.0; } }`}</style>
					<StandardTooltip content="Copy as markdown">
						<VSCodeButton
							className="copy-button"
							appearance="icon"
							style={{
								height: "24px",
								border: "none",
								background: "var(--vscode-editor-background)",
								transition: "background 0.2s ease-in-out",
							}}
							onClick={async () => {
								const success = await copyWithFeedback(markdown)
								if (success) {
									const button = document.activeElement as HTMLElement
									if (button) {
										button.style.background = "var(--vscode-button-background)"
										setTimeout(() => {
											button.style.background = ""
										}, 200)
									}
								}
							}}>
							<span className="codicon codicon-copy" />
						</VSCodeButton>
					</StandardTooltip>
				</div>
			)}
		</div>
	)
})

interface OpenMarkdownPreviewButtonProps {
	markdown: string | undefined
	className?: string
}

export const OpenMarkdownPreviewButton = memo(({ markdown, className }: OpenMarkdownPreviewButtonProps) => {
	if (!hasComplexMarkdown(markdown)) {
		return null
	}

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (markdown) {
			rootStore.settings.openMarkdownPreview(markdown)
		}
	}

	return (
		<StandardTooltip content="Open in preview">
			<button
				onClick={handleClick}
				className={`opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${className ?? ""}`}
				aria-label="Open markdown in preview">
				<SquareArrowOutUpRight className="w-4 h-4" />
			</button>
		</StandardTooltip>
	)
})
