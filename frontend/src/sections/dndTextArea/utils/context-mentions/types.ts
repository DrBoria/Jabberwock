export interface SearchResult {
	path: string
	type: "file" | "folder"
	label?: string
}

export enum ContextMenuOptionType {
	None = "none",
	OpenedFile = "openedFile",
	File = "file",
	Folder = "folder",
	Problems = "problems",
	Terminal = "terminal",
	URL = "url",
	Git = "git",
	NoResults = "noResults",
	Mode = "mode",
	Command = "command",
	SectionHeader = "sectionHeader",
	Goal = "goal",
}

export interface ContextMenuQueryItem {
	type: ContextMenuOptionType
	value?: string
	label?: string
	description?: string
	icon?: string
	slashCommand?: string
	secondaryText?: string
	argumentHint?: string
}
