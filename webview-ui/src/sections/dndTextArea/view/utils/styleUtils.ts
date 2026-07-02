import { cn } from "@src/lib/utils"

export function getDndTextAreaStyles(isEditMode: boolean, isFocused: boolean, isDraggingOver: boolean) {
	return {
		containerClassName: cn(
			"flex flex-col gap-1 bg-editor-background outline-none border border-none box-border",
			isEditMode ? "p-2 w-full" : "relative px-1.5 pb-1 w-[calc(100%-16px)] ml-auto mr-auto",
		),
		innerDivClassName: cn(!isEditMode && "relative"),
		textAreaWrapperClassName: cn("chat-text-area", !isEditMode && "relative", "flex", "flex-col", "outline-none"),
		contextMenuClassName: cn(
			"absolute",
			"bottom-full",
			isEditMode ? "left-6" : "left-0",
			"right-0",
			"z-[1000]",
			isEditMode ? "-mb-3" : "mb-2",
			"filter",
			"drop-shadow-md",
		),
		borderStyle: isFocused
			? "border border-vscode-focusBorder outline outline-vscode-focusBorder"
			: isDraggingOver
				? "border-2 border-dashed border-vscode-focusBorder"
				: "border border-transparent",
		editModePadding: isEditMode ? "pr-20" : "pr-9",
		draggingBackground: isDraggingOver
			? "bg-[color-mix(in_srgb,var(--vscode-input-background)_95%,var(--vscode-focusBorder))]"
			: "bg-vscode-input-background",
	}
}

export function getPlaceholderBottomText(t: (key: string) => string, shouldDisableImages: boolean): string {
	return `\n(${t("chat:addContext")}${shouldDisableImages ? `, ${t("chat:dragFiles")}` : `, ${t("chat:dragFilesImages")}`})`
}
