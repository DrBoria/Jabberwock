import React from "react"
import { cn } from "@src/lib/utils"
import { Container } from "@src/shared/ui/layouts/Container"
import type { PlaceholderBottomProps } from "../types"

export const PlaceholderBottom: React.FC<PlaceholderBottomProps> = ({
	isEditMode,
	hasInputValue,
	placeholderBottomText,
}) => {
	if (hasInputValue) {
		return null
	}

	return (
		<Container
			className={cn(
				"absolute left-2 z-30 flex items-center h-8 font-vscode-font-family text-vscode-editor-font-size leading-vscode-editor-line-height",
				isEditMode ? "pr-20" : "pr-9",
			)}
			style={{
				bottom: "0.75rem",
				color: "color-mix(in oklab, var(--vscode-input-foreground) 50%, transparent)",
				userSelect: "none",
				pointerEvents: "none",
			}}>
			{placeholderBottomText}
		</Container>
	)
}
