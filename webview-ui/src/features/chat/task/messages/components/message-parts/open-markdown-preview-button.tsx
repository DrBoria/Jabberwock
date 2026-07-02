import React, { memo } from "react"
import { SquareArrowOutUpRight } from "lucide-react"

import { hasComplexMarkdown } from "@src/utils/text/markdown"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { rootStore } from "@src/features/store"

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
